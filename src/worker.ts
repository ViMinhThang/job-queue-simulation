import { EventEmitter } from "node:events";
import { StaleJobError, WorkerClosedError } from "./errors.js";
import type { Queue } from "./queue.js";
import type { Job, Processor, WorkerOptions } from "./types.js";

const DEFAULT_HEARTBEAT_INTERVAL_MS = 1_000;
const DEFAULT_STALL_CHECK_INTERVAL_MS = 1_000;
const DEFAULT_STALL_TIMEOUT_MS = 5_000;

export class Worker<Data = unknown, Result = unknown> extends EventEmitter {
  private readonly concurrency: number;
  private readonly heartbeatIntervalMs: number;
  private readonly stallCheckIntervalMs: number;
  private readonly stallTimeoutMs: number;
  private readonly abortController = new AbortController();
  private readonly lanes: Promise<void>[] = [];
  private stallTimer?: ReturnType<typeof setInterval>;
  private isStarted = false;
  private isClosed = false;

  /**
   * `activeCount` is observable teaching state. In a real distributed queue,
   * this lives in Redis or another coordinator so many processes can agree.
   */
  activeCount = 0;

  constructor(
    private readonly queue: Queue<Data, Result>,
    private readonly processor: Processor<Data, Result>,
    options: WorkerOptions = {},
  ) {
    super();
    this.concurrency = Math.max(1, Math.floor(options.concurrency ?? 1));
    this.heartbeatIntervalMs = Math.max(1, Math.floor(options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS));
    this.stallCheckIntervalMs = Math.max(1, Math.floor(options.stallCheckIntervalMs ?? DEFAULT_STALL_CHECK_INTERVAL_MS));
    this.stallTimeoutMs = Math.max(1, Math.floor(options.stallTimeoutMs ?? DEFAULT_STALL_TIMEOUT_MS));

    if (options.autorun !== false) {
      this.start();
    }
  }

  start(): void {
    if (this.isClosed) throw new WorkerClosedError();
    if (this.isStarted) return;

    this.isStarted = true;

    /**
     * Concurrency is bounded by the number of lanes we create. Each lane is just
     * an async loop: take one job, await it, then ask for another. Because there
     * are exactly N lanes, at most N processors can be in flight.
     */
    for (let laneId = 0; laneId < this.concurrency; laneId += 1) {
      this.lanes.push(this.runLane(laneId));
    }

    this.stallTimer = setInterval(() => {
      const recovered = this.queue.recoverStalled(this.stallTimeoutMs);
      for (const job of recovered) {
        this.emit("stalled", job);
      }
    }, this.stallCheckIntervalMs);
    this.stallTimer.unref?.();

    this.emit("started", { concurrency: this.concurrency });
  }

  async close(): Promise<void> {
    if (this.isClosed) return;

    this.isClosed = true;
    this.abortController.abort();
    if (this.stallTimer) clearInterval(this.stallTimer);
    await Promise.allSettled(this.lanes);
    this.emit("closed");
  }

  private async runLane(laneId: number): Promise<void> {
    while (!this.isClosed) {
      try {
        const job = await this.queue.take(this.abortController.signal);
        await this.runJob(job, laneId);
      } catch (error) {
        if (this.isClosed) return;
        this.emit("workerError", error);
      }
    }
  }

  private async runJob(job: Job<Data, Result>, laneId: number): Promise<void> {
    this.activeCount += 1;
    this.emit("active", job, { laneId, activeCount: this.activeCount });

    /**
     * The heartbeat is a renewable lease. If it stops updating, the queue can
     * assume this lane died or became stuck and recover the job.
     */
    this.queue.heartbeat(job.id, job.lockToken);
    const heartbeatTimer = setInterval(() => {
      try {
        this.queue.heartbeat(job.id, job.lockToken);
      } catch (error) {
        if (!(error instanceof StaleJobError)) this.emit("workerError", error);
      }
    }, this.heartbeatIntervalMs);
    heartbeatTimer.unref?.();

    try {
      const result = await this.processor(job);
      const completed = await this.queue.complete(job.id, result, job.lockToken);
      this.emit("completed", completed, { laneId });
    } catch (error) {
      if (error instanceof StaleJobError) {
        this.emit("stale", job, { laneId });
      } else {
        await this.handleFailure(job, error, laneId);
      }
    } finally {
      clearInterval(heartbeatTimer);
      this.activeCount -= 1;
    }
  }

  private async handleFailure(job: Job<Data, Result>, error: unknown, laneId: number): Promise<void> {
    if (job.attemptsMade < job.maxAttempts) {
      const backoffMs = getBackoffMs(job, error);
      const retried = await this.queue.retry(job.id, error, backoffMs, job.lockToken);
      this.emit("retrying", retried, { laneId, backoffMs });
      return;
    }

    const failed = await this.queue.fail(job.id, error, job.lockToken);
    this.emit("failed", failed, { laneId });
  }
}

function getBackoffMs<Data, Result>(job: Job<Data, Result>, error: unknown): number {
  const backoff = job.backoffMs;

  if (typeof backoff === "function") {
    return Math.max(0, backoff(job.attemptsMade, error));
  }

  return Math.max(0, backoff ?? 0);
}
