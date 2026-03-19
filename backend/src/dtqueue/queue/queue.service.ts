import { Injectable, Logger } from '@nestjs/common';
import { RedisConnectionService } from '../redis-connection/redis-connection.service';
import { randomUUID } from 'node:crypto';
import { Job, JobOptions, JobState, PayLoadType } from './interfaces/queue-job';
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
  private readonly queueByState: Record<JobState, string> = {
    waiting: 'waitingQueue',
    processing: 'processingQueue',
    stalled: 'stalledQueue',
    completed: 'completedQueue',
    failed: 'failedQueue',
  };

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
    await this.redis.client.rpush(this.queueByState.waiting, JSON.stringify(job));
    this.logger.log(`${jobName} has been added`);
    this.emit('added', job);
    return job;
  }

  async getStats(): Promise<QueueStats> {
    const [waiting, processing, completed, failed, stalled, lastRecovered] = await Promise.all([
      this.redis.client.llen(this.queueByState.waiting),
      this.redis.client.llen(this.queueByState.processing),
      this.redis.client.llen(this.queueByState.completed),
      this.redis.client.llen(this.queueByState.failed),
      this.redis.client.llen(this.queueByState.stalled),
      this.redis.client.get('stats:last_stalled_recovery'),
    ]);

    return {
      waiting,
      processing,
      completed,
      failed,
      stalled,
      lastRecoveredCount: parseInt(lastRecovered || '0', 10) || 0,
    };
  }

  async getAllJobs(state?: JobState): Promise<Job<PayLoadType>[]> {
    const queueNames = state
      ? [this.queueByState[state]]
      : [
          this.queueByState.waiting,
          this.queueByState.processing,
          this.queueByState.stalled,
          this.queueByState.completed,
          this.queueByState.failed,
        ];

    const allJobs: Job<PayLoadType>[] = [];

    for (const queueName of queueNames) {
      const items = await this.redis.client.lrange(queueName, 0, -1);
      for (const item of items) {
        try {
          const job = JSON.parse(item) as Job<PayLoadType>;
          if (queueName === this.queueByState.waiting) job.state = 'waiting';
          else if (queueName === this.queueByState.processing) job.state = 'processing';
          else if (queueName === this.queueByState.stalled) job.state = 'stalled';
          else if (queueName === this.queueByState.completed) job.state = 'completed';
          else if (queueName === this.queueByState.failed) job.state = 'failed';

          allJobs.push(job);
        } catch {
          this.logger.error(`Failed to parse job from ${queueName}:`, item);
        }
      }
    }

    return allJobs;
  }


  async deleteJob(id: string): Promise<void> {
    const queueNames = Object.values(this.queueByState);
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
    await this.redis.client.del(this.queueByState.completed);
  }

  async clearFailed(): Promise<void> {
    await this.redis.client.del(this.queueByState.failed);
  }

  async clearStalled(): Promise<void> {
    await this.redis.client.del(this.queueByState.stalled);
  }

  async clearAll(): Promise<void> {
    await this.redis.client.del(this.queueByState.waiting);
    await this.redis.client.del(this.queueByState.processing);
    await this.redis.client.del(this.queueByState.stalled);
    await this.redis.client.del(this.queueByState.completed);
    await this.redis.client.del(this.queueByState.failed);
    await this.redis.client.del('stats:last_stalled_recovery');
  }
}
