import type Redis from "ioredis";
import { QUEUE_KEYS, type Job, type JobState, type QueueStats, createJob } from "./types.js";
import { config } from "./config.js";

const KEY_TO_STATE = new Map(
  Object.entries(QUEUE_KEYS).map(([state, key]) => [key, state as JobState]),
);

function parseJob(raw: string, key: string): Job | null {
  try {
    const job = JSON.parse(raw) as Job;
    job.state = KEY_TO_STATE.get(key) ?? job.state;
    return job;
  } catch {
    return null;
  }
}

export class Queue {
  constructor(private redis: Redis) {}

  async addJob(command: string, name?: string, retries = 0): Promise<Job> {
    const job = createJob(command, name, retries);
    await this.redis.rpush(QUEUE_KEYS.waiting, JSON.stringify(job));
    return job;
  }

  async getStats(): Promise<QueueStats> {
    const [waiting, processing, completed, failed, stalled] = await Promise.all(
      [
        this.redis.llen(QUEUE_KEYS.waiting),
        this.redis.llen(QUEUE_KEYS.processing),
        this.redis.llen(QUEUE_KEYS.completed),
        this.redis.llen(QUEUE_KEYS.failed),
        this.redis.llen(QUEUE_KEYS.stalled),
      ],
    );
    return { waiting, processing, completed, failed, stalled };
  }

  async getJobs(state?: JobState): Promise<Job[]> {
    const keys = state
      ? [QUEUE_KEYS[state]]
      : Object.values(QUEUE_KEYS);

    const jobsMap = new Map<string, Job>();
    for (const key of keys) {
      const items = await this.redis.lrange(key, 0, -1);
      for (const raw of items) {
        const job = parseJob(raw, key);
        if (job) {
          // Map will overwrite earlier occurrences with the latest found during iteration
          jobsMap.set(job.id, job);
        }
      }
    }
    return Array.from(jobsMap.values());
  }

  async getJob(id: string): Promise<Job | null> {
    for (const [key, state] of KEY_TO_STATE) {
      const items = await this.redis.lrange(key, 0, -1);
      for (const raw of items) {
        const job = parseJob(raw, key);
        if (job && job.id === id) {
          job.state = state;
          return job;
        }
      }
    }
    return null;
  }

  async deleteJob(id: string): Promise<boolean> {
    for (const key of Object.values(QUEUE_KEYS)) {
      const items = await this.redis.lrange(key, 0, -1);
      for (const raw of items) {
        const job = parseJob(raw, key);
        if (job && job.id === id) {
          await this.redis.lrem(key, 1, raw);
          return true;
        }
      }
    }
    return false;
  }

  async getOutput(jobId: string): Promise<{ stdout: string[]; stderr: string[] }> {
    const [stdout, stderr] = await Promise.all([
      this.redis.lrange(`jobber:output:${jobId}:stdout`, 0, -1),
      this.redis.lrange(`jobber:output:${jobId}:stderr`, 0, -1),
    ]);
    return { stdout, stderr };
  }

  async clear(state: "completed" | "failed" | "stalled" | "all"): Promise<void> {
    if (state === "all") {
      await Promise.all(Object.values(QUEUE_KEYS).map((k) => this.redis.del(k)));
      return;
    }
    await this.redis.del(QUEUE_KEYS[state]);
  }

  async getJobHeartbeatTTLs(jobIds: string[]): Promise<Record<string, number>> {
    const pipeline = this.redis.pipeline();
    for (const id of jobIds) {
      pipeline.ttl(`${config.queue.prefix}heartbeat:${id}`);
    }
    const results = await pipeline.exec();
    const heartbeats: Record<string, number> = {};
    if (!results) return heartbeats;

    results.forEach((res, i) => {
      const [err, ttl] = res;
      if (!err && typeof ttl === "number" && ttl > 0) {
        heartbeats[jobIds[i]!] = ttl;
      }
    });
    return heartbeats;
  }

  async retryJob(id: string): Promise<boolean> {
    for (const key of Object.values(QUEUE_KEYS)) {
      const items = await this.redis.lrange(key, 0, -1);
      for (const raw of items) {
        const job = parseJob(raw, key);
        if (job && job.id === id) {
          await this.redis.lrem(key, 1, raw);
          
          job.state = "waiting";
          job.retryCount = 0;
          job.startedAt = null;
          job.completedAt = null;
          job.exitCode = null;
          
          await this.redis.rpush(QUEUE_KEYS.waiting, JSON.stringify(job));
          return true;
        }
      }
    }
    return false;
  }
}
