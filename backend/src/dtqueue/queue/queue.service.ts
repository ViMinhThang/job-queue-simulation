import { Injectable } from '@nestjs/common';
import { RedisConnectionService } from '../redis-connection/redis-connection.service';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Job, JobOptions, PayLoadType } from './interfaces/queue-job';

export interface QueueStats {
  waiting: number;
  processing: number;
  completed: number;
  failed: number;
  stalled: number;
}

const SAMPLE_JOBS = [
  'processImage',
  'sendNotification',
  'generateReport',
  'syncData',
  'backupDatabase',
  'sendEmail',
  'processPayment',
  'validateUser',
  'cacheWarmup',
  'runAnalytics',
];

@Injectable()
export class QueueService extends RedisConnectionService {
  constructor(configService: ConfigService) {
    super(configService);
  }

  async addJob<T extends PayLoadType>(
    jobName: string,
    payload: T,
    options: JobOptions,
  ) {
    const idempotency = randomUUID();
    const job: Job<T> = {
      id: idempotency,
      jobName: jobName,
      retryCount: 0,
      state: 'waiting',
      timeIn: new Date(),
      payload: payload,
      options: options,
    };
    await this._client.rpush('waitingQueue', JSON.stringify(job));
    console.log(`${jobName} has been added`);
    this.emit('added', job);
  }

  async getStats(): Promise<QueueStats> {
    // TODO: Implement - return counts from Redis queues
    return {
      waiting: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      stalled: 0,
    };
  }

  async getAllJobs(state?: string): Promise<Job[]> {
    // TODO: Implement - return jobs from Redis queues
    return [];
  }

  async spawnRandomJob(
    jobName?: string,
    processingTime?: number,
  ): Promise<Job> {
    // TODO: Implement
    // 1. Generate random job or use provided jobName
    // 2. Add to waitingQueue with processingTime in payload
    // 3. Set up setTimeout to simulate I/O
    // 4. After timeout, move to completed (or failed ~10%)
    const id = randomUUID();
    return {
      id,
      jobName:
        jobName || SAMPLE_JOBS[Math.floor(Math.random() * SAMPLE_JOBS.length)],
      retryCount: 0,
      state: 'waiting',
      timeIn: new Date(),
      payload: {
        processingTime: processingTime || 3000,
      } as unknown as PayLoadType,
      options: { retryTime: 3 },
    };
  }

  async deleteJob(id: string): Promise<void> {
    // TODO: Implement - remove job from all queues
  }

  async moveJob(id: string, state: string): Promise<void> {
    // TODO: Implement - move job to different queue
  }

  async clearCompleted(): Promise<void> {
    // TODO: Implement - clear completed queue
  }

  async clearFailed(): Promise<void> {
    // TODO: Implement - clear failed queue
  }

  async clearAll(): Promise<void> {
    // TODO: Implement - clear all queues
  }
}
