# Queue Lab

Queue Lab is a small TypeScript queue library for revising async concurrency concepts.
It is intentionally in-memory and compact, so you can read the whole implementation
without Redis, Lua scripts, or worker-process orchestration getting in the way.

It is inspired by the mental model of BullMQ: producers add jobs to a queue, workers
consume jobs with bounded concurrency, failed jobs can retry, and queue state moves
through a clear lifecycle.

## Install

```bash
npm install
```

## Example

```ts
import { Queue, Worker } from "queue-lab";

const queue = new Queue<number, number>("math");

const worker = new Worker(
  queue,
  async (job) => {
    await sleep(100);
    return job.data * 2;
  },
  { concurrency: 2 },
);

await queue.add("double", 21);
await queue.waitForIdle();

console.log(queue.getStats());
await worker.close();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

Run the included demo:

```bash
npm run example
```

## What To Study

- `src/worker.ts`: bounded concurrency using worker lanes.
- `src/queue.ts`: Promise-based waiting instead of polling.
- `src/queue.ts`: pause/resume as backpressure.
- `src/queue.ts`: delayed jobs and retry scheduling.
- `test/queue.test.ts`: proof that concurrency stays capped.

## Not Production Yet

This is a learning library. A production BullMQ-style system would need durable
storage, atomic cross-process state transitions, distributed locks, stalled-job
recovery, metrics, repeatable jobs, priorities, and stronger typed events.
