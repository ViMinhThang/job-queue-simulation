import dotenv from "dotenv";
dotenv.config({ quiet: true });

const prefix = process.env.JOB_QUEUE_PREFIX ?? "jobber:";

export const config = {
  redis: {
    host: process.env.REDIS_HOST ?? "localhost",
    port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
    password: process.env.REDIS_PASSWORD,
  },
  queue: {
    prefix,
    keys: {
      waiting: `${prefix}waiting`,
      processing: `${prefix}processing`,
      completed: `${prefix}completed`,
      failed: `${prefix}failed`,
      stalled: `${prefix}stalled`,
    },
  },
  worker: {
    heartbeatIntervalMs: parseInt(process.env.HEARTBEAT_INTERVAL_MS ?? "5000", 10),
    stallThresholdSeconds: parseInt(process.env.STALL_THRESHOLD_SECONDS ?? "30", 10),
    stallCheckIntervalMs: parseInt(process.env.STALL_CHECK_INTERVAL_MS ?? "60000", 10),
    lockTtlMs: parseInt(process.env.LOCK_TTL_MS ?? "30000", 10),
    lockWatchdogIntervalMs: parseInt(process.env.LOCK_WATCHDOG_INTERVAL_MS ?? "10000", 10),
    lockKey: `${prefix}lock:stall`,
    defaultConcurrency: 4,
  },
};
