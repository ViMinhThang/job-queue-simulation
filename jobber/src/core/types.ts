import { randomUUID } from "node:crypto";
import { config } from "./config.js";

export type JobState = "waiting" | "processing" | "completed" | "failed" | "stalled";

export interface JobOptions {
  retries: number;
}

export interface Job {
  id: string;
  name: string;
  command: string;
  state: JobState;
  retryCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  exitCode: number | null;
  options: JobOptions;
}

export interface QueueStats {
  waiting: number;
  processing: number;
  completed: number;
  failed: number;
  stalled: number;
}

export function createJob(command: string, name?: string, retries = 0): Job {
  return {
    id: randomUUID(),
    name: name ?? command.slice(0, 60),
    command,
    state: "waiting",
    retryCount: 0,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    exitCode: null,
    options: { retries },
  };
}

export const QUEUE_KEYS: Record<JobState, string> = config.queue.keys;

export const STALL_THRESHOLD_SECONDS = config.worker.stallThresholdSeconds;
