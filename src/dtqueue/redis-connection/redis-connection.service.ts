import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { EventEmitter } from 'supertest/lib/test';

@Injectable()
export class RedisConnectionService extends EventEmitter {
  protected _client: Redis;

  constructor(private readonly configService: ConfigService) {
    super();
    this._client = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: parseInt(this.configService.get<string>('REDIS_PORT', '6379')),
    });
    this._client.on('connect', () => {
      console.log('Redis connected');
    });
    this._client.on('error', (err) => {
      console.error('Redis error', err);
    });
  }
}
