export type JobState = "waiting" | "delayed" | "active" | "completed" | "failed";

export interface JobOptions {
  /**
   * Total number of times a job may run. `attempts: 3` means one first try and
   * two retries. Keeping the name close to BullMQ makes the learning transfer
   * easier when you revisit a production queue later.
   */
  attempts?: number;
  /**
   * Wait before a failed job is put back into the waiting queue.
   * A function is useful for exponential backoff exercises.
   */
  backoffMs?: number | ((attemptsMade: number, error: unknown) => number);
  /** Wait before the first attempt. */
  delayMs?: number;
}

export interface Job<Data = unknown, Result = unknown> {
  id: string;
  queueName: string;
  name: string;
  data: Data;
  state: JobState;
  attemptsMade: number;
  maxAttempts: number;
  backoffMs?: JobOptions["backoffMs"];
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  delayUntil?: Date;
  result?: Result;
  error?: SerializedError;
}

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
}

export interface QueueStats {
  waiting: number;
  delayed: number;
  active: number;
  completed: number;
  failed: number;
  total: number;
}

export interface WorkerOptions {
  concurrency?: number;
  /**
   * Start immediately by default so examples stay short. Set this to false
   * when a test wants to subscribe to events before work begins.
   */
  autorun?: boolean;
}

export type Processor<Data, Result> = (job: Readonly<Job<Data, Result>>) => Result | Promise<Result>;

export interface WaitForIdleOptions {
  timeoutMs?: number;
}
