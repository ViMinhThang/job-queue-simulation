import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisConnectionService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisConnectionService.name);
  private readonly _client: Redis;

  constructor(private readonly configService: ConfigService) {
    this._client = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: parseInt(this.configService.get<string>('REDIS_PORT', '6379')),
    });
    this._client.on('connect', () => {
      this.logger.log('Redis connected');
    });
    this._client.on('error', (err) => {
      this.logger.error('Redis error', err);
    });
  }

  get client(): Redis {
    return this._client;
  }

  async onModuleDestroy() {
    await this._client.quit();
  }
}
