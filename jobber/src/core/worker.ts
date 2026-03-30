import type Redis from "ioredis";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { QUEUE_KEYS, STALL_THRESHOLD_SECONDS, type Job } from "./types.js";
import { config } from "./config.js";

const STALL_LOCK_KEY = config.worker.lockKey;

export class Worker extends EventEmitter {
  private isRunning = false;
  private concurrency = config.worker.defaultConcurrency;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private stallIntervalId: ReturnType<typeof setInterval> | null = null;
  private lockId: string | null = null;

  constructor(private redis: Redis) {
    super();
  }

  start(concurrency = config.worker.defaultConcurrency): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.concurrency = Math.max(1, Math.min(10, concurrency));

    this.intervalId = setInterval(() => {
      if (!this.isRunning) return;
      const slots = Array(this.concurrency).fill(null);
      Promise.allSettled(slots.map(() => this.processNext()));
    }, 1000);

    this.stallIntervalId = setInterval(() => {
      this.detectStalled().catch(() => {});
    }, config.worker.stallCheckIntervalMs);

    this.emit("started");
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.stallIntervalId) clearInterval(this.stallIntervalId);
    this.intervalId = null;
    this.stallIntervalId = null;
    this.emit("stopped");
  }

  setConcurrency(n: number): void {
    this.concurrency = Math.max(1, Math.min(10, n));
  }

  getStatus() {
    return { isRunning: this.isRunning, concurrency: this.concurrency };
  }

  private async processNext(): Promise<void> {
    if (!this.isRunning) return;

    const raw = await this.redis.lmove(
      QUEUE_KEYS.waiting,
      QUEUE_KEYS.processing,
      "LEFT",
      "LEFT",
    );
    if (!raw) return;

    let job: Job;
    try {
      job = JSON.parse(raw) as Job;
    } catch {
      return;
    }

    job.state = "processing";
    job.startedAt = new Date().toISOString();
    this.emit("processing", job);

    try {
      const exitCode = await this.execCommand(job.command, job.id);
      job.exitCode = exitCode;
      job.completedAt = new Date().toISOString();

      await this.cleanupProcessing(raw, job.id);

      if (exitCode === 0) {
        job.state = "completed";
        await this.redis.rpush(QUEUE_KEYS.completed, JSON.stringify(job));
        this.emit("success", job);
      } else {
        throw new Error(`Command exited with code ${exitCode}`);
      }
    } catch {
      await this.cleanupProcessing(raw, job.id);

      job.retryCount += 1;
      job.completedAt = new Date().toISOString();

      if (job.retryCount <= job.options.retries) {
        job.state = "waiting";
        await this.redis.rpush(QUEUE_KEYS.waiting, JSON.stringify(job));
        this.emit("retry", job);
      } else {
        job.state = "failed";
        job.exitCode = job.exitCode ?? 1;
        await this.redis.rpush(QUEUE_KEYS.failed, JSON.stringify(job));
        this.emit("failed", job);
      }
    }
  }

  private async cleanupProcessing(raw: string, jobId: string): Promise<void> {
    await this.redis.lrem(QUEUE_KEYS.processing, 1, raw);
    await this.redis.del(`${config.queue.prefix}heartbeat:${jobId}`);
  }

  private execCommand(command: string, jobId: string): Promise<number> {
    const heartbeatKey = `${config.queue.prefix}heartbeat:${jobId}`;
    const stdoutKey = `${config.queue.prefix}output:${jobId}:stdout`;
    const stderrKey = `${config.queue.prefix}output:${jobId}:stderr`;

    return new Promise((resolve) => {
      const updatedHeartbeat = () => {
        this.redis
          .set(heartbeatKey, String(Date.now()), "EX", STALL_THRESHOLD_SECONDS)
          .catch(() => {});
      };
      updatedHeartbeat();
      const heartbeat = setInterval(updatedHeartbeat, config.worker.heartbeatIntervalMs);

      const isWindows = process.platform === "win32";
      const shell = isWindows ? "cmd" : "sh";
      const args = isWindows ? ["/c", command] : ["-c", command];

      const child = spawn(shell, args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsVerbatimArguments: isWindows,
      });

      child.stdout.on("data", (data: Buffer) => {
        for (const line of data.toString().split("\n").filter(Boolean)) {
          this.redis.rpush(stdoutKey, line).catch(() => {});
        }
      });

      child.stderr.on("data", (data: Buffer) => {
        for (const line of data.toString().split("\n").filter(Boolean)) {
          this.redis.rpush(stderrKey, line).catch(() => {});
        }
      });

      child.on("close", (code: number | null) => {
        clearInterval(heartbeat);
        this.redis.del(heartbeatKey).catch(() => {});
        resolve(code ?? 1);
      });

      child.on("error", (err: Error) => {
        clearInterval(heartbeat);
        this.redis.del(heartbeatKey).catch(() => {});
        this.redis.rpush(stderrKey, err.message).catch(() => {});
        resolve(1);
      });
    });
  }

  private async detectStalled(): Promise<void> {
    if (!this.isRunning) return;

    const acquired = await this.acquireLock();
    if (!acquired) return;

    const watchdog = setInterval(() => {
      this.redis.expire(STALL_LOCK_KEY, Math.ceil(config.worker.lockTtlMs / 1000)).catch(() => {});
    }, config.worker.lockWatchdogIntervalMs);

    try {
      const items = await this.redis.lrange(QUEUE_KEYS.processing, 0, -1);
      for (const raw of items) {
        let job: Job;
        try {
          job = JSON.parse(raw) as Job;
        } catch {
          continue;
        }

        const heartbeat = await this.redis.get(`${config.queue.prefix}heartbeat:${job.id}`);
        if (
          !heartbeat ||
          (Date.now() - Number(heartbeat)) / 1000 > STALL_THRESHOLD_SECONDS
        ) {
          await this.redis.lrem(QUEUE_KEYS.processing, 1, raw);
          job.state = "stalled";
          await this.redis.rpush(QUEUE_KEYS.stalled, JSON.stringify(job));
          this.emit("stalled", job);
        }
      }
    } finally {
      clearInterval(watchdog);
      await this.releaseLock();
    }
  }

  private async acquireLock(): Promise<boolean> {
    this.lockId = randomUUID();
    const result = await this.redis.set(
      STALL_LOCK_KEY,
      this.lockId,
      "PX",
      config.worker.lockTtlMs,
      "NX",
    );
    return result === "OK";
  }

  private async releaseLock(): Promise<void> {
    if (!this.lockId) return;
    const script = `
      if redis.call("GET",KEYS[1]) == ARGV[1] then
        return redis.call("DEL",KEYS[1])
      else
        return 0
      end`;
    await this.redis.eval(script, 1, STALL_LOCK_KEY, this.lockId);
    this.lockId = null;
  }
}
