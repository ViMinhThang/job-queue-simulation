# Queue Lab

Queue Lab is a small TypeScript queue library for revising async concurrency concepts.
It is intentionally in-memory and compact, so you can read the whole implementation
without Redis, Lua scripts, or worker-process orchestration getting in the way.

It is inspired by the mental model of BullMQ: producers add jobs to a queue, workers
consume jobs with bounded concurrency, failed jobs can retry, and queue state moves
through a clear lifecycle.

There is no TUI or CLI in this version. The project is a library plus examples
and tests, so the concurrency code stays front and center.

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
- `src/queue.ts`: delayed jobs, retry scheduling, heartbeats, and stalled recovery.
- `src/core/*`: restored Redis command-queue core without the old TUI/CLI layer.
- `test/queue.test.ts`: proof that concurrency stays capped.

## Heartbeats And Stalled Jobs

Workers renew a heartbeat while they own a job. The queue gives each active job a
lock token; if the heartbeat expires, `recoverStalled()` clears that token and
requeues the job when attempts remain. The old worker copy can no longer complete
the job because its token is stale.

That gives you a compact place to study a real queue race condition:

```text
worker takes job -> queue assigns lock token
worker heartbeats -> queue knows the worker is alive
heartbeat expires -> queue recovers the job
old worker finishes late -> stale token blocks completion
```

## Redis Command Queue

The Redis-backed command queue is exported separately:

```ts
import {
  RedisCommandQueue,
  RedisCommandWorker,
  createRedisClient,
} from "queue-lab";
```

It restores the Redis heartbeat/stalled-job behavior without restoring the
terminal UI or command-line app.

## Not Production Yet

This is a learning library. A production BullMQ-style system would still need
atomic cross-process state transitions, stronger Redis scripts, metrics,
repeatable jobs, priorities, and stronger typed events.
