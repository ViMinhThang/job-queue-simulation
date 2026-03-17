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
  lastRecoveredCount: number;
}

export const STALL_THRESHOLD_SECONDS = 30;


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
    return job;
  }

  async getStats(): Promise<QueueStats> {
    const [waiting, processing, completed, failed, lastRecovered] = await Promise.all([
      this._client.llen('waitingQueue'),
      this._client.llen('processingQueue'),
      this._client.llen('completedQueue'),
      this._client.llen('failedQueue'),
      this._client.get('stats:last_stalled_recovery'),
    ]);

    const processingJobs = await this._client.lrange('processingQueue', 0, -1);
    let stalled = 0;
    const now = new Date().getTime();
    for (const jobStr of processingJobs) {
      const job = JSON.parse(jobStr) as Job<PayLoadType>;
      if ((now - new Date(job.timeIn).getTime()) / 1000 > STALL_THRESHOLD_SECONDS) {
        stalled++;
      }
    }

    return {
      waiting,
      processing,
      completed,
      failed,
      stalled,
      lastRecoveredCount: parseInt(lastRecovered || '0'),
    };
  }

  async getAllJobs(state?: string): Promise<Job<PayLoadType>[]> {
    const queueNames = state
      ? [`${state}Queue`]
      : ['waitingQueue', 'processingQueue', 'completedQueue', 'failedQueue'];

    const allJobs: Job<PayLoadType>[] = [];

    for (const queueName of queueNames) {
      const items = await this._client.lrange(queueName, 0, -1);
      for (const item of items) {
        try {
          const job = JSON.parse(item) as Job<PayLoadType>;
          // Sync state with queue name just in case
          if (queueName === 'waitingQueue') job.state = 'waiting';
          else if (queueName === 'processingQueue') job.state = 'processing';
          else if (queueName === 'completedQueue') job.state = 'completed';
          else if (queueName === 'failedQueue') job.state = 'failed';

          allJobs.push(job);
        } catch (e) {
          console.error(`Failed to parse job from ${queueName}:`, item);
        }
      }
    }

    return allJobs;
  }

  async spawnJob(
    jobName: string,
    processingTime: number,
  ): Promise<Job<PayLoadType>> {
    const job: Job<PayLoadType> = {
      id: randomUUID(),
      jobName: jobName,
      retryCount: 0,
      state: 'waiting',
      timeIn: new Date(),
      payload: {
        processingTime: processingTime,
      },
      options: { retryTime: 3 },
    };
    await this._client.rpush('waitingQueue', JSON.stringify(job));
    console.log(`${job.jobName} has been spawned`);
    this.emit('added', job);
    return job;
  }

  async deleteJob(id: string): Promise<void> {
    const queueNames = ['waitingQueue', 'processingQueue', 'completedQueue', 'failedQueue'];
    for (const queueName of queueNames) {
      const items = await this._client.lrange(queueName, 0, -1);
      for (const item of items) {
        const job = JSON.parse(item) as Job<PayLoadType>;
        if (job.id === id) {
          await this._client.lrem(queueName, 1, item);
          return;
        }
      }
    }
  }

  async clearCompleted(): Promise<void> {
    await this._client.del('completedQueue');
  }

  async clearFailed(): Promise<void> {
    await this._client.del('failedQueue');
  }

  async clearAll(): Promise<void> {
    await this._client.del('waitingQueue');
    await this._client.del('processingQueue');
    await this._client.del('completedQueue');
    await this._client.del('failedQueue');
    await this._client.del('stats:last_stalled_recovery');
  }
}
