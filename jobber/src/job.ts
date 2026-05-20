import { randomUUID } from "node:crypto";
import type { Job, JobOptions, SerializedError } from "./types.js";

export function createJob<Data, Result>(
  queueName: string,
  name: string,
  data: Data,
  options: JobOptions,
): Job<Data, Result> {
  const now = new Date();

  return {
    id: randomUUID(),
    queueName,
    name,
    data,
    state: "waiting",
    attemptsMade: 0,
    maxAttempts: Math.max(1, Math.floor(options.attempts ?? 1)),
    backoffMs: options.backoffMs,
    createdAt: now,
    updatedAt: now,
  };
}

export function snapshotJob<Data, Result>(job: Job<Data, Result>): Job<Data, Result> {
  return { ...job };
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: "Error",
    message: String(error),
  };
}
