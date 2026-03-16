import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisConnectionService } from '../redis-connection/redis-connection.service';
import { Job, PayLoadType } from '../queue/interfaces/queue-job';
import { Interval } from '@nestjs/schedule';

@Injectable()
export class WorkerService extends RedisConnectionService {
  private handlers = new Map<string, (payload: any) => Promise<void>>();
  private stallThreshold = 30;
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

  @Interval(60000)
  async stalledDetection() {
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

  register(jobName: string, handler: (payload: PayLoadType) => Promise<void>) {
    this.handlers.set(jobName, handler);
  }
}
