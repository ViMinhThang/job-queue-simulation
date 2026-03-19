import { Injectable, Logger } from '@nestjs/common';
import { RedisConnectionService } from '../redis-connection/redis-connection.service';
import { Job, PayLoadType } from '../queue/interfaces/queue-job';
import { Interval } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { STALL_THRESHOLD_SECONDS } from '../queue/queue.service';
import { EventEmitter } from 'node:events';

@Injectable()
export class WorkerService extends EventEmitter {
  private readonly logger = new Logger(WorkerService.name);

  private stallThreshold = STALL_THRESHOLD_SECONDS;
  private lockId: string;
  private isRunning = false;
  private concurrency = 4;

  constructor(private readonly redis: RedisConnectionService) {
    super();
    this.on('success', (job: Job<PayLoadType>) => {
      // Nothing special here, just cleanup elsewhere
    });
    this.on('failed', (job: Job<PayLoadType>) => {
      this.logger.warn(
        `Job ${job.jobName} failed, retrying... (${job.retryCount}/${job.options.retryTime})`,
      );
    });

    this.on('exceeded', (job: Job<PayLoadType>) => {
      this.logger.error(
        `Job ${job.jobName} exceeded max retries (${job.options.retryTime}), permanently failed.`,
      );
      void this.redis.client.rpush('failedQueue', JSON.stringify(job));
    });
  }

  private async simulateIO(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async runWithHeartBeat(
    job: Job<PayLoadType>,
    processingTime: number,
    withHeartbeat = true,
  ): Promise<void> {
    if (!withHeartbeat) {
      await this.simulateIO(processingTime);
      return;
    }

    const heartbeatKey = `heartbeat:${job.id}`;
    const interval = setInterval(() => {
      void this.redis.client.set(heartbeatKey, Date.now(), 'EX', this.stallThreshold);
    }, 5000);
    await this.redis.client.set(heartbeatKey, Date.now(), 'EX', this.stallThreshold);
    try {
      await this.simulateIO(processingTime);
    } finally {
      clearInterval(interval);
      await this.redis.client.del(heartbeatKey);
    }
  }

  async processJob() {
    if (!this.isRunning) return;
    const jobData = await this.redis.client.lmove(
      'waitingQueue',
      'processingQueue',
      'LEFT',
      'LEFT',
    );
    if (!jobData) return;

    const job = JSON.parse(jobData) as Job<PayLoadType>;
    job.state = 'processing';
    job.timeIn = new Date();
    const processingTime = job.payload.processingTime || 3000;
    const isStallScenario = job.jobName === 'stallMe';
    const minStallDurationMs = (this.stallThreshold + 35) * 1000;
    const actualProcessingTime = isStallScenario
      ? Math.max(processingTime, minStallDurationMs)
      : processingTime;

    this.logger.log(`Started processing: ${job.jobName} (ID: ${job.id})`);
    this.logger.log(`Simulating I/O for ${actualProcessingTime}ms...`);

    try {
      if (job.jobName === 'failMe') {
        throw new Error('Simulated job failure');
      }

      await this.runWithHeartBeat(job, actualProcessingTime, !isStallScenario);

      this.logger.log(`Finished: ${job.jobName} (ID: ${job.id})`);

      const removed = await this.redis.client.lrem('processingQueue', 1, jobData);
      if (removed === 0) {
        this.logger.warn(
          `Job ${job.id} was already removed from processingQueue (likely marked stalled).`,
        );
        return;
      }

      job.state = 'completed';
      await this.redis.client.rpush('completedQueue', JSON.stringify(job));
      this.emit('success', job);
    } catch (e) {
      this.logger.error(`Error in job ${job.jobName}:`, e);
      job.retryCount += 1;
      job.state = 'failed';

      const removed = await this.redis.client.lrem('processingQueue', 1, jobData);
      if (removed === 0) {
        this.logger.warn(
          `Job ${job.id} was already removed from processingQueue (likely marked stalled).`,
        );
        return;
      }

      if (job.retryCount < job.options.retryTime) {
        await this.redis.client.rpush('waitingQueue', JSON.stringify(job));
        this.emit('failed', job);
      } else {
        this.emit('exceeded', job);
      }
    }
  }

  async isStalled(job: Job<PayLoadType>): Promise<boolean> {
    const heartbeat = await this.redis.client.get(`heartbeat:${job.id}`);
    // No heartbeat key = worker stopped updating = stalled
    if (!heartbeat) return true;
    // Key exists but old (defensive, shouldn't happen with EX)
    const age = (Date.now() - Number(heartbeat)) / 1000;
    return age > this.stallThreshold;
  }

  async acquireLock() {
    this.lockId = randomUUID();
    const result = await this.redis.client.set(
      'lock:stalledDetection',
      this.lockId,
      'PX',
      30000,
      'NX',
    );
    return result == 'OK';
  }

  async releaseLock() {
    const script = `
      if redis.call("GET",KEYS[1]) == ARGV[1] then
        return redis.call("DEL",KEYS[1])
      else
        return 0
      end
      `;
    await this.redis.client.eval(script, 1, 'lock:stalledDetection', this.lockId);
  }

  @Interval(60000)
  async stalledDetection() {
    const acquired = await this.acquireLock();
    if (!acquired) return;

    const watchDog = setInterval(() => {
      void this.redis.client.expire('lock:stalledDetection', 30);
    }, 10000);

    try {
      const jobs = await this.redis.client.lrange('processingQueue', 0, -1);
      let recoveredCount = 0;
      for (const job of jobs) {
        const jobData = JSON.parse(job) as Job<PayLoadType>;
        if (await this.isStalled(jobData)) {
          const removed = await this.redis.client.lrem('processingQueue', 1, job);
          if (removed === 0) {
            continue;
          }

          recoveredCount++;
          jobData.state = 'stalled';
          await this.redis.client.rpush('stalledQueue', JSON.stringify(jobData));
        }
      }
      if (recoveredCount > 0) {
        this.logger.log(`Detected and moved ${recoveredCount} stalled jobs.`);
        await this.redis.client.set('stats:last_stalled_recovery', recoveredCount);
      }
    } finally {
      clearInterval(watchDog);
      await this.releaseLock();
    }
  }


  @Interval(1000)
  async processJobs() {
    if (!this.isRunning) return;
    const jobs = Array(Math.min(this.concurrency, 10)).fill(null);
    await Promise.all(jobs.map(() => this.processJob()));
  }

  getWorkerStatus() {
    return {
      isRunning: this.isRunning,
      concurrency: this.concurrency,
      jobsProcessedPerMinute: 0,
      averageWaitTime: 0,
    };
  }

  async getActiveHeartbeats(): Promise<{ jobId: string; lastPing: number }[]> {
    let cursor = '0';
    const keys: string[] = [];

    do {
      const [nextCursor, batch] = await this.redis.client.scan(
        cursor,
        'MATCH',
        'heartbeat:*',
        'COUNT',
        100,
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    const uniqueKeys = [...new Set(keys)];
    if (uniqueKeys.length === 0) return [];
    
    const values = await this.redis.client.mget(uniqueKeys);
    return uniqueKeys
      .map((key, i) => ({
        jobId: key.replace('heartbeat:', ''),
        lastPing: Number(values[i]),
      }))
      .sort((a, b) => b.lastPing - a.lastPing); // Newest ping first
  }

  setConcurrency(value: number) {
    this.concurrency = Math.max(1, Math.min(10, value));
  }

  async startWorker(): Promise<{ message: string }> {
    this.isRunning = true;
    return { message: 'Worker started' };
  }

  async stopWorker(): Promise<{ message: string }> {
    this.logger.log('Stopping worker...');
    this.isRunning = false;
    return { message: 'Worker stopped' };
  }
}
