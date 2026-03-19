import { Injectable, Logger } from '@nestjs/common';
import { RedisConnectionService } from '../redis-connection/redis-connection.service';
import { randomUUID } from 'node:crypto';
import { Job, JobOptions, PayLoadType } from './interfaces/queue-job';
import { EventEmitter } from 'node:events';

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
export class QueueService extends EventEmitter {
  private readonly logger = new Logger(QueueService.name);

  constructor(private readonly redis: RedisConnectionService) {
    super();
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
    await this.redis.client.rpush('waitingQueue', JSON.stringify(job));
    this.logger.log(`${jobName} has been added`);
    this.emit('added', job);
    return job;
  }

  async getStats(): Promise<QueueStats> {
    const [waiting, processing, completed, failed, lastRecovered] = await Promise.all([
      this.redis.client.llen('waitingQueue'),
      this.redis.client.llen('processingQueue'),
      this.redis.client.llen('completedQueue'),
      this.redis.client.llen('failedQueue'),
      this.redis.client.get('stats:last_stalled_recovery'),
    ]);

    const processingJobs = await this.redis.client.lrange('processingQueue', 0, -1);
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
      const items = await this.redis.client.lrange(queueName, 0, -1);
      for (const item of items) {
        try {
          const job = JSON.parse(item) as Job<PayLoadType>;
          if (queueName === 'waitingQueue') job.state = 'waiting';
          else if (queueName === 'processingQueue') job.state = 'processing';
          else if (queueName === 'completedQueue') job.state = 'completed';
          else if (queueName === 'failedQueue') job.state = 'failed';

          allJobs.push(job);
        } catch (e) {
          this.logger.error(`Failed to parse job from ${queueName}:`, item);
        }
      }
    }

    return allJobs;
  }


  async deleteJob(id: string): Promise<void> {
    const queueNames = ['waitingQueue', 'processingQueue', 'completedQueue', 'failedQueue'];
    for (const queueName of queueNames) {
      const items = await this.redis.client.lrange(queueName, 0, -1);
      for (const item of items) {
        const job = JSON.parse(item) as Job<PayLoadType>;
        if (job.id === id) {
          await this.redis.client.lrem(queueName, 1, item);
          return;
        }
      }
    }
  }

  async clearCompleted(): Promise<void> {
    await this.redis.client.del('completedQueue');
  }

  async clearFailed(): Promise<void> {
    await this.redis.client.del('failedQueue');
  }

  async clearAll(): Promise<void> {
    await this.redis.client.del('waitingQueue');
    await this.redis.client.del('processingQueue');
    await this.redis.client.del('completedQueue');
    await this.redis.client.del('failedQueue');
    await this.redis.client.del('stats:last_stalled_recovery');
  }
}
