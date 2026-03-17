import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisConnectionService } from '../redis-connection/redis-connection.service';
import { Job, PayLoadType } from '../queue/interfaces/queue-job';
import { Interval } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';

@Injectable()
export class WorkerService extends RedisConnectionService {
  private handlers = new Map<string, (payload: any) => Promise<void>>();
  private stallThreshold = 30;
  private lockId: string;
  constructor(configService: ConfigService) {
    super(configService);
    this.on('success', (jobData: Job<PayLoadType>) => {
      void this._client.lrem('processingQueue', 1, JSON.stringify(jobData));
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
  @Interval(5000)
  async processJob() {
    const jobData: string = await this._client.lmove(
      'waitingQueue',
      'processingQueue',
      'LEFT',
      'LEFT',
    );
    if (!jobData) return;
    const job = JSON.parse(jobData) as Job<PayLoadType>;

    const func = this.handlers.get(job.jobName);
    if (!func) {
      console.warn(`No handler registered for job: ${job.jobName}`);
      return;
    }
    try {
      await func(job.payload);
      this.emit('success', jobData);
    } catch (e) {
      job.retryCount += 1;
      job.state = 'failed';

      if (job.retryCount < job.options.retryTime) {
        await this._client.lrem('processingQueue', 1, jobData);
        await this._client.rpush('waitingQueue', JSON.stringify(job));
        this.emit('failed', job);
      } else {
        await this._client.lrem('processingQueue', 1, jobData);
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
        for (const job of jobs) {
          const jobData = JSON.parse(job) as Job<PayLoadType>;
          if (this.isStalled(jobData, this.stallThreshold)) {
            jobData.state = 'waiting';
            await this._client.rpush('waitingQueue', job);
            await this._client.lrem('processingQueue', 1, job);
          }
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
  @Interval(5000)
  async processJobs() {
    await Promise.all([
      this.processJob(),
      this.processJob(),
      this.processJob(),
      this.processJob(),
    ]);
  }
}
