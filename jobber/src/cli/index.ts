import { Command } from "commander";
import { createRedisClient, withRedis } from "../core/redis.js";
import { Queue } from "../core/queue.js";
import { Worker } from "../core/worker.js";
import type { Job } from "../core/types.js";
import { render } from "ink";
import React from "react";
import { App } from "../tui/app.js";

const program = new Command();

program
  .name("jobber")
  .description("CLI job queue manager. Enqueue shell commands, watch them run.")
  .version("1.0.0");

program
  .command("enqueue")
  .description("Add a shell command to the job queue")
  .argument("<command>", "Shell command to execute")
  .option("-n, --name <name>", "Human-readable job name")
  .option("-r, --retries <n>", "Number of retries on failure", "0")
  .action(async (cmd: string, opts: { name?: string; retries: string }) => {
    await withRedis(async (redis) => {
      const queue = new Queue(redis);
      const job = await queue.addJob(cmd, opts.name, parseInt(opts.retries, 10));
      console.log(`Queued: ${job.name}`);
      console.log(`  ID: ${job.id}`);
      console.log(`  Command: ${job.command}`);
      if (job.options.retries > 0) {
        console.log(`  Retries: ${job.options.retries}`);
      }
    });
  });

program
  .command("status")
  .description("Show queue status")
  .action(async () => {
    await withRedis(async (redis) => {
      const queue = new Queue(redis);
      const stats = await queue.getStats();

      console.log("\n  Queue Status");
      console.log("  ─────────────────────────");
      console.log(`  Waiting:    ${stats.waiting}`);
      console.log(`  Processing: ${stats.processing}`);
      console.log(`  Completed:  ${stats.completed}`);
      console.log(`  Failed:     ${stats.failed}`);
      console.log(`  Stalled:    ${stats.stalled}`);
      console.log();

      const jobs = await queue.getJobs();
      if (jobs.length > 0) {
        console.log("  Jobs:");
        for (const job of jobs) {
          const icon =
            job.state === "waiting" ? "○" :
            job.state === "processing" ? "◌" :
            job.state === "completed" ? "✓" :
            job.state === "failed" ? "✗" : "△";
          console.log(`    ${icon} ${job.name} [${job.state}]`);
        }
        console.log();
      }
    });
  });

program
  .command("logs")
  .description("Show output for a job")
  .argument("<id>", "Job ID")
  .action(async (id: string) => {
    await withRedis(async (redis) => {
      const queue = new Queue(redis);
      const job = await queue.getJob(id);
      if (!job) {
        console.error(`Job not found: ${id}`);
        process.exit(1);
      }

      const output = await queue.getOutput(id);

      console.log(`\n  ${job.name} [${job.state}]`);
      console.log(`  Command: ${job.command}`);
      if (job.exitCode !== null) {
        console.log(`  Exit code: ${job.exitCode}`);
      }
      console.log();

      if (output.stdout.length > 0) {
        console.log("  stdout:");
        for (const line of output.stdout) {
          console.log(`    ${line}`);
        }
      }
      if (output.stderr.length > 0) {
        console.log("  stderr:");
        for (const line of output.stderr) {
          console.log(`    ${line}`);
        }
      }
      if (output.stdout.length === 0 && output.stderr.length === 0) {
        console.log("  (no output)");
      }
      console.log();
    });
  });

program
  .command("clear")
  .description("Clear jobs from the queue")
  .option("--completed", "Clear completed jobs")
  .option("--failed", "Clear failed jobs")
  .option("--stalled", "Clear stalled jobs")
  .option("--all", "Clear all jobs")
  .action(async (opts: { completed?: boolean; failed?: boolean; stalled?: boolean; all?: boolean }) => {
    await withRedis(async (redis) => {
      const queue = new Queue(redis);

      if (opts.all) {
        await queue.clear("all");
        console.log("Cleared all queues.");
      } else if (opts.completed) {
        await queue.clear("completed");
        console.log("Cleared completed jobs.");
      } else if (opts.failed) {
        await queue.clear("failed");
        console.log("Cleared failed jobs.");
      } else if (opts.stalled) {
        await queue.clear("stalled");
        console.log("Cleared stalled jobs.");
      } else {
        console.log("Specify --completed, --failed, --stalled, or --all");
      }
    });
  });

program
  .command("start")
  .description("Start the job worker (headless mode)")
  .option("-c, --concurrency <n>", "Max parallel jobs", "4")
  .action(async (opts: { concurrency: string }) => {
    const redis = createRedisClient("start");
    await redis.connect();

    const worker = new Worker(redis);
    const concurrency = parseInt(opts.concurrency, 10);

    worker.on("processing", (job: Job) => {
      console.log(`▶ Processing: ${job.name}`);
    });
    worker.on("success", (job: Job) => {
      console.log(`✓ Done: ${job.name} (exit ${job.exitCode})`);
    });
    worker.on("failed", (job: Job) => {
      console.log(`✗ Failed: ${job.name} (exit ${job.exitCode}, retry ${job.retryCount}/${job.options.retries})`);
    });
    worker.on("retry", (job: Job) => {
      console.log(`↻ Retrying: ${job.name} (${job.retryCount}/${job.options.retries})`);
    });
    worker.on("stalled", (job: Job) => {
      console.log(`△ Stalled: ${job.name}`);
    });

    const shutdown = async () => {
      console.log("\nShutting down...");
      await worker.stop();
      await redis.quit();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    process.on("beforeExit", shutdown);

    worker.start(concurrency);
    console.log(`Worker started (concurrency: ${concurrency})`);
    console.log("Press Ctrl+C to stop.\n");

    await new Promise<void>(() => {});
  });

program
  .command("tui")
  .description("Launch interactive TUI dashboard")
  .option("-c, --concurrency <n>", "Max parallel jobs", "4")
  .action(async (opts: { concurrency: string }) => {
    const result = render(React.createElement(App, { concurrency: parseInt(opts.concurrency, 10) }));
    await result.waitUntilExit();
  });

program.parse();
