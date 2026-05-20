import { Queue, Worker } from "../dist/index.js";

const queue = new Queue<number, number>("demo");
let active = 0;
let maxActive = 0;

const worker = new Worker(
  queue,
  async (job) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    console.log(`start job ${job.data}; active=${active}`);

    await sleep(200);

    active -= 1;
    console.log(`finish job ${job.data}; active=${active}`);
    return job.data * 2;
  },
  { concurrency: 2 },
);

for (let i = 1; i <= 6; i += 1) {
  await queue.add("double", i);
}

await queue.waitForIdle();
await worker.close();

console.log(`max active jobs: ${maxActive}`);
console.log(queue.getStats());

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
