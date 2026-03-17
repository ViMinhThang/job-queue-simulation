import { Module } from '@nestjs/common';
import { QueueService } from './queue/queue.service';
import { RedisConnectionService } from './redis-connection/redis-connection.service';
import { WorkerService } from './worker/worker.service';
import { ScheduleModule } from '@nestjs/schedule';
import { WorkerController } from './worker/worker.controller';
import { QueueController } from './queue/queue.controller';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [QueueService, RedisConnectionService, WorkerService],
  exports: [QueueService, RedisConnectionService],
  controllers: [WorkerController, QueueController],
})
export class DtqueueModule {}
