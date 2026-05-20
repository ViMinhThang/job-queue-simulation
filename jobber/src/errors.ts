export class QueueClosedError extends Error {
  constructor(queueName: string) {
    super(`Queue "${queueName}" is closed.`);
    this.name = "QueueClosedError";
  }
}

export class WorkerClosedError extends Error {
  constructor() {
    super("Worker is closed.");
    this.name = "WorkerClosedError";
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}
