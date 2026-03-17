import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisConnectionService } from '../redis-connection/redis-connection.service';
import { Job, PayLoadType } from '../queue/interfaces/queue-job';
import { Interval } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { STALL_THRESHOLD_SECONDS } from '../queue/queue.service';

@Injectable()
export class WorkerService extends RedisConnectionService {
  private handlers = new Map<string, (payload: any) => Promise<void>>();
  private stallThreshold = STALL_THRESHOLD_SECONDS;
  private lockId: string;
  private isRunning = false;
  private concurrency = 4;
  private processingSpeed = 1000;
  constructor(configService: ConfigService) {
    super(configService);
    this.on('success', (job: Job<PayLoadType>) => {
      // Nothing special here, just cleanup elsewhere
    });
    this.on('failed', (job: Job<PayLoadType>) => {
      console.warn(
        `Job ${job.jobName} failed, retrying... (${job.retryCount}/${job.options.retryTime})`,
      );
    });

    this.on('exceeded', (job: Job<PayLoadType>) => {
      console.error(
        `Job ${job.jobName} exceeded max retries (${job.options.retryTime}), permanently failed.`,
      );
      // optionally persist to a "dead letter" list in Redis
      void this._client.rpush('failedQueue', JSON.stringify(job));
    });
  }
  private async simulateIO(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  @Interval(5000)
  async processJob() {
    if (!this.isRunning) return;
    const jobData: string = await this._client.lmove(
      'waitingQueue',
      'processingQueue',
      'LEFT',
      'LEFT',
    );
    if (!jobData) return;

    const job = JSON.parse(jobData) as Job<PayLoadType>;
    const processingTime = job.payload.processingTime || 3000;

    console.log(`[Worker] Started processing: ${job.jobName} (ID: ${job.id})`);
    console.log(`[Worker] Simulating I/O for ${processingTime}ms...`);

    try {
      // Simulation triggers
      if (job.jobName === 'failMe') {
        throw new Error('Simulated job failure');
      }
      
      const actualProcessingTime = job.jobName === 'stallMe' ? 40000 : processingTime;

      await this.simulateIO(actualProcessingTime);

      console.log(`[Worker] Finished: ${job.jobName} (ID: ${job.id})`);

      await this._client.lrem('processingQueue', 1, jobData);
      job.state = 'completed';
      await this._client.rpush('completedQueue', JSON.stringify(job));
      this.emit('success', job);
    } catch (e) {
      console.error(`[Worker] Error in job ${job.jobName}:`, e);
      job.retryCount += 1;
      job.state = 'failed';

      await this._client.lrem('processingQueue', 1, jobData);

      if (job.retryCount < job.options.retryTime) {
        await this._client.rpush('waitingQueue', JSON.stringify(job));
        this.emit('failed', job);
      } else {
        this.emit('exceeded', job);
      }
    }
  }
  isStalled(job: Job<PayLoadType>, seconds: number): boolean {
    const now = new Date().getTime();
    const timeIn = new Date(job.timeIn).getTime();
    return (now - timeIn) / 1000 > seconds;
  }
  async aquireLock() {
    this.lockId = randomUUID();
    const result = await this._client.set(
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
    await this._client.eval(script, 1, 'lock:stalledDetection', this.lockId);
  }
  @Interval(60000)
  async stalledDetection() {
    const aquired = await this.aquireLock();
    let watchDog: NodeJS.Timeout | undefined;
    try {
      watchDog = setInterval(() => {
        void this._client.expire('lock:stalledDetection', 30);
      }, 10000);
      if (aquired) {
        const jobs = await this._client.lrange('processingQueue', 0, -1);
        let recoveredCount = 0;
        for (const job of jobs) {
          const jobData = JSON.parse(job) as Job<PayLoadType>;
          if (this.isStalled(jobData, this.stallThreshold)) {
            recoveredCount++;
            jobData.state = 'waiting';
            await this._client.rpush('waitingQueue', job);
            await this._client.lrem('processingQueue', 1, job);
          }
        }
        if (recoveredCount > 0) {
          console.log(`[Worker] Detected and recovered ${recoveredCount} stalled jobs.`);
          await this._client.set('stats:last_stalled_recovery', recoveredCount);
        }
      }
    } finally {
      clearInterval(watchDog);
      await this.releaseLock();
    }
  }

  register(jobName: string, handler: (payload: PayLoadType) => Promise<void>) {
    this.handlers.set(jobName, handler);
  }
  @Interval(1000) // Run more frequently
  async processJobs() {
    if (!this.isRunning) return;
    const jobs = Array(Math.min(this.concurrency, 10)).fill(null);
    await Promise.all(jobs.map(() => this.processJob()));
  }

  getWorkerStatus() {
    return {
      isRunning: this.isRunning,
      concurrency: this.concurrency,
      processingSpeed: this.processingSpeed,
      jobsProcessedPerMinute: 0, // Placeholder or implement tracking
      averageWaitTime: 0, // Placeholder or implement tracking
    };
  }

  setConcurrency(value: number) {
    this.concurrency = Math.max(1, Math.min(10, value));
  }

  setProcessingSpeed(value: number) {
    this.processingSpeed = Math.max(100, Math.min(10000, value));
  }

  async startWorker(): Promise<{ message: string }> {
    this.isRunning = true;
    return { message: 'Worker started' };
  }

  async stopWorker(): Promise<{ message: string }> {
    console.log('[Worker] Stopping worker...');
    this.isRunning = false;
    return { message: 'Worker stopped' };
  }
}
