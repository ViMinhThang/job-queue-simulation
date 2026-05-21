import assert from "node:assert/strict";
import test from "node:test";
import { Queue, StaleJobError, Worker } from "../src/index.js";

test("worker never runs more than the configured concurrency", async () => {
  const queue = new Queue<number, number>("bounded");
  let active = 0;
  let maxActive = 0;

  const worker = new Worker(
    queue,
    async (job) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await sleep(25);
      active -= 1;
      return job.data * 2;
    },
    { concurrency: 2, autorun: false },
  );

  for (let i = 0; i < 8; i += 1) {
    await queue.add("double", i);
  }

  worker.start();
  await queue.waitForIdle({ timeoutMs: 1_000 });
  await worker.close();

  assert.equal(maxActive, 2);
  assert.equal(queue.getStats().completed, 8);
});

test("failed jobs retry until attempts are exhausted or the job succeeds", async () => {
  const queue = new Queue<{ failUntil: number }, string>("retries");
  const attempts: number[] = [];

  const worker = new Worker(queue, async (job) => {
    attempts.push(job.attemptsMade);
    if (job.attemptsMade < job.data.failUntil) {
      throw new Error("not yet");
    }
    return "ok";
  });

  const job = await queue.add("flaky", { failUntil: 3 }, { attempts: 3, backoffMs: 5 });
  await queue.waitForIdle({ timeoutMs: 1_000 });
  await worker.close();

  assert.deepEqual(attempts, [1, 2, 3]);
  assert.equal(queue.getJob(job.id)?.state, "completed");
});

test("pause keeps jobs waiting until resume releases backpressure", async () => {
  const queue = new Queue<number, number>("pause");
  queue.pause();

  const worker = new Worker(queue, async (job) => job.data + 1);
  await queue.add("increment", 1);

  await sleep(25);
  assert.equal(queue.getStats().waiting, 1);
  assert.equal(queue.getStats().active, 0);

  queue.resume();
  await queue.waitForIdle({ timeoutMs: 1_000 });
  await worker.close();

  assert.equal(queue.getStats().completed, 1);
});

test("worker heartbeats while a job is active", async () => {
  const queue = new Queue<number, number>("heartbeats");
  let heartbeatCount = 0;

  queue.on("heartbeat", () => {
    heartbeatCount += 1;
  });

  const worker = new Worker(
    queue,
    async (job) => {
      await sleep(35);
      return job.data;
    },
    { heartbeatIntervalMs: 5, stallTimeoutMs: 100 },
  );

  const job = await queue.add("keepalive", 1);
  await queue.waitForIdle({ timeoutMs: 1_000 });
  await worker.close();

  assert.ok(heartbeatCount > 1);
  assert.equal(queue.getJob(job.id)?.state, "completed");
});

test("stalled recovery requeues an active job whose heartbeat expired", async () => {
  const queue = new Queue<number, number>("stalled");
  const added = await queue.add("stalls", 1, { attempts: 2 });
  const active = await queue.take();

  await sleep(20);
  const recovered = queue.recoverStalled(5);

  assert.equal(recovered.length, 1);
  assert.equal(recovered[0]?.id, added.id);
  assert.equal(recovered[0]?.stalledCount, 1);
  assert.equal(queue.getStats().waiting, 1);

  await assert.rejects(
    () => queue.complete(active.id, 1, active.lockToken),
    StaleJobError,
  );
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
