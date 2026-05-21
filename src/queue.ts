import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { QueueClosedError, StaleJobError, TimeoutError } from "./errors.js";
import { createJob, serializeError, snapshotJob } from "./job.js";
import type { Job, JobOptions, JobState, QueueStats, WaitForIdleOptions } from "./types.js";

interface WaitingConsumer<Data, Result> {
  resolve: (job: Job<Data, Result>) => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
}

const DEFAULT_IDLE_TIMEOUT_MS = 5_000;

export class Queue<Data = unknown, Result = unknown> extends EventEmitter {
  private readonly jobs = new Map<string, Job<Data, Result>>();
  private readonly waiting: Job<Data, Result>[] = [];
  private readonly consumers: WaitingConsumer<Data, Result>[] = [];
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private isPaused = false;
  private isClosed = false;

  constructor(public readonly name: string) {
    super();
  }

  async add(name: string, data: Data, options: JobOptions = {}): Promise<Job<Data, Result>> {
    this.ensureOpen();

    const job = createJob<Data, Result>(this.name, name, data, options);
    this.jobs.set(job.id, job);

    const delayMs = options.delayMs ?? 0;
    if (delayMs > 0) {
      this.delay(job, delayMs);
    } else {
      this.enqueue(job);
    }

    this.emit("added", snapshotJob(job));
    return snapshotJob(job);
  }

  async take(signal?: AbortSignal): Promise<Job<Data, Result>> {
    this.ensureOpen();

    const readyJob = this.claimNextJob();
    if (readyJob) return readyJob;

    /**
     * Workers do not poll. They park a Promise here and the queue wakes exactly
     * one consumer when a job becomes available. This is the same mental model
     * as condition variables in threaded code, expressed with Promises.
     */
    return new Promise((resolve, reject) => {
      const consumer: WaitingConsumer<Data, Result> = { resolve, reject, signal };

      consumer.onAbort = () => {
        this.removeConsumer(consumer);
        reject(new WorkerAbortError());
      };

      if (signal?.aborted) {
        reject(new WorkerAbortError());
        return;
      }

      signal?.addEventListener("abort", consumer.onAbort, { once: true });
      this.consumers.push(consumer);
    });
  }

  async complete(jobId: string, result: Result, lockToken?: string): Promise<Job<Data, Result>> {
    const job = this.getExistingJob(jobId);
    this.ensureJobOwned(job, lockToken);
    job.state = "completed";
    job.result = result;
    job.lockToken = undefined;
    job.lastHeartbeatAt = undefined;
    job.finishedAt = new Date();
    job.updatedAt = job.finishedAt;

    this.emit("completed", snapshotJob(job));
    this.emitIdleIfNeeded();
    return snapshotJob(job);
  }

  async fail(jobId: string, error: unknown, lockToken?: string): Promise<Job<Data, Result>> {
    const job = this.getExistingJob(jobId);
    this.ensureJobOwned(job, lockToken);
    job.state = "failed";
    job.error = serializeError(error);
    job.lockToken = undefined;
    job.lastHeartbeatAt = undefined;
    job.finishedAt = new Date();
    job.updatedAt = job.finishedAt;

    this.emit("failed", snapshotJob(job));
    this.emitIdleIfNeeded();
    return snapshotJob(job);
  }

  async retry(jobId: string, error: unknown, backoffMs = 0, lockToken?: string): Promise<Job<Data, Result>> {
    const job = this.getExistingJob(jobId);
    this.ensureJobOwned(job, lockToken);
    job.error = serializeError(error);
    job.lockToken = undefined;
    job.lastHeartbeatAt = undefined;
    job.startedAt = undefined;
    job.finishedAt = undefined;

    if (backoffMs > 0) {
      this.delay(job, backoffMs);
    } else {
      this.enqueue(job);
    }

    this.emit("retrying", snapshotJob(job));
    return snapshotJob(job);
  }

  heartbeat(jobId: string, lockToken?: string): Job<Data, Result> | undefined {
    const job = this.jobs.get(jobId);
    if (!job || job.state !== "active") return undefined;
    this.ensureJobOwned(job, lockToken);

    job.lastHeartbeatAt = new Date();
    job.updatedAt = job.lastHeartbeatAt;
    this.emit("heartbeat", snapshotJob(job));
    return snapshotJob(job);
  }

  recoverStalled(stallTimeoutMs: number): Job<Data, Result>[] {
    const recovered: Job<Data, Result>[] = [];
    const now = Date.now();

    for (const job of this.jobs.values()) {
      if (job.state !== "active") continue;

      const lastHeartbeatAt = job.lastHeartbeatAt?.getTime() ?? job.startedAt?.getTime() ?? 0;
      if (now - lastHeartbeatAt <= stallTimeoutMs) continue;

      /**
       * A stalled job is a lease that expired. Clearing the lock token is what
       * prevents the old worker from completing a stale copy after recovery.
       */
      job.state = "stalled";
      job.stalledCount += 1;
      job.lockToken = undefined;
      job.lastHeartbeatAt = undefined;
      job.startedAt = undefined;
      job.updatedAt = new Date();
      this.emit("stalled", snapshotJob(job));

      if (job.attemptsMade < job.maxAttempts) {
        this.enqueue(job);
      } else {
        job.state = "failed";
        job.error = {
          name: "StalledJobError",
          message: `Job stalled after ${job.attemptsMade} attempt(s).`,
        };
        job.finishedAt = new Date();
        job.updatedAt = job.finishedAt;
        this.emit("failed", snapshotJob(job));
      }

      recovered.push(snapshotJob(job));
    }

    this.emitIdleIfNeeded();
    return recovered;
  }

  pause(): void {
    this.ensureOpen();
    this.isPaused = true;
    this.emit("paused");
  }

  resume(): void {
    this.ensureOpen();
    this.isPaused = false;
    this.emit("resumed");
    this.flushConsumers();
  }

  getJob(jobId: string): Job<Data, Result> | undefined {
    const job = this.jobs.get(jobId);
    return job ? snapshotJob(job) : undefined;
  }

  getJobs(state?: JobState): Job<Data, Result>[] {
    return Array.from(this.jobs.values())
      .filter((job) => !state || job.state === state)
      .map(snapshotJob);
  }

  getStats(): QueueStats {
    const stats: QueueStats = {
      waiting: 0,
      delayed: 0,
      active: 0,
      stalled: 0,
      completed: 0,
      failed: 0,
      total: this.jobs.size,
    };

    for (const job of this.jobs.values()) {
      stats[job.state] += 1;
    }

    return stats;
  }

  async waitForIdle(options: WaitForIdleOptions = {}): Promise<void> {
    if (this.isIdle()) return;

    const timeoutMs = options.timeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new TimeoutError(`Queue "${this.name}" did not become idle within ${timeoutMs}ms.`));
      }, timeoutMs);

      const checkIdle = () => {
        if (!this.isIdle()) return;
        cleanup();
        resolve();
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.off("idle", checkIdle);
        this.off("completed", checkIdle);
        this.off("failed", checkIdle);
      };

      this.on("idle", checkIdle);
      this.on("completed", checkIdle);
      this.on("failed", checkIdle);
    });
  }

  close(): void {
    if (this.isClosed) return;

    this.isClosed = true;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();

    const error = new QueueClosedError(this.name);
    while (this.consumers.length > 0) {
      const consumer = this.consumers.shift()!;
      this.detachAbortListener(consumer);
      consumer.reject(error);
    }

    this.emit("closed");
  }

  private enqueue(job: Job<Data, Result>): void {
    job.state = "waiting";
    job.delayUntil = undefined;
    job.lockToken = undefined;
    job.lastHeartbeatAt = undefined;
    job.updatedAt = new Date();
    this.waiting.push(job);
    this.emit("waiting", snapshotJob(job));
    this.flushConsumers();
  }

  private delay(job: Job<Data, Result>, delayMs: number): void {
    job.state = "delayed";
    job.delayUntil = new Date(Date.now() + delayMs);
    job.updatedAt = new Date();

    const timer = setTimeout(() => {
      this.timers.delete(job.id);
      if (!this.isClosed && job.state === "delayed") {
        this.enqueue(job);
      }
    }, delayMs);

    /**
     * In Node, referenced timers keep the process alive. `unref` lets examples
     * and tests exit naturally once no real work remains.
     */
    timer.unref?.();

    this.timers.set(job.id, timer);
    this.emit("delayed", snapshotJob(job));
  }

  private claimNextJob(): Job<Data, Result> | undefined {
    if (this.isPaused || this.waiting.length === 0) return undefined;

    const job = this.waiting.shift()!;
    job.state = "active";
    job.attemptsMade += 1;
    job.lockToken = randomUUID();
    job.startedAt = new Date();
    job.lastHeartbeatAt = job.startedAt;
    job.updatedAt = job.startedAt;
    this.emit("active", snapshotJob(job));

    return snapshotJob(job);
  }

  private flushConsumers(): void {
    /**
     * This handoff is the backpressure point: one ready job wakes one waiting
     * worker lane. If no lane is waiting, the job stays queued.
     */
    while (!this.isPaused && this.waiting.length > 0 && this.consumers.length > 0) {
      const consumer = this.consumers.shift()!;
      const job = this.claimNextJob();
      if (!job) {
        this.consumers.unshift(consumer);
        return;
      }

      this.detachAbortListener(consumer);
      consumer.resolve(job);
    }
  }

  private isIdle(): boolean {
    for (const job of this.jobs.values()) {
      if (job.state === "waiting" || job.state === "delayed" || job.state === "active") {
        return false;
      }
    }
    return true;
  }

  private emitIdleIfNeeded(): void {
    if (this.isIdle()) this.emit("idle");
  }

  private getExistingJob(jobId: string): Job<Data, Result> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job "${jobId}" does not exist.`);
    return job;
  }

  private ensureJobOwned(job: Job<Data, Result>, lockToken?: string): void {
    if (lockToken && job.lockToken !== lockToken) {
      throw new StaleJobError(job.id);
    }
  }

  private removeConsumer(target: WaitingConsumer<Data, Result>): void {
    const index = this.consumers.indexOf(target);
    if (index >= 0) this.consumers.splice(index, 1);
  }

  private detachAbortListener(consumer: WaitingConsumer<Data, Result>): void {
    if (consumer.signal && consumer.onAbort) {
      consumer.signal.removeEventListener("abort", consumer.onAbort);
    }
  }

  private ensureOpen(): void {
    if (this.isClosed) throw new QueueClosedError(this.name);
  }
}

class WorkerAbortError extends Error {
  constructor() {
    super("Worker stopped while waiting for a job.");
    this.name = "WorkerAbortError";
  }
}
