import { Injectable } from '@nestjs/common';
import { RedisConnectionService } from '../redis-connection/redis-connection.service';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Job, JobOptions, PayLoadType } from './interfaces/queue-job';

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
}
