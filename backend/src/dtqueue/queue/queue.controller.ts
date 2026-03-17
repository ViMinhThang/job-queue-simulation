import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { QueueService } from './queue.service';

@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('status')
  getStats() {
    return this.queueService.getStats();
  }

  @Get('jobs')
  getJobs(@Query('state') state?: string) {
    return this.queueService.getAllJobs(state);
  }

  @Post('spawn')
  spawnJob(@Body() body: { jobName?: string; processingTime?: number }) {
    return this.queueService.spawnRandomJob(body.jobName, body.processingTime);
  }

  @Delete('jobs/:id')
  deleteJob(@Param('id') id: string) {
    return this.queueService.deleteJob(id);
  }

  @Post('jobs/:id/move')
  moveJob(@Param('id') id: string, @Body() body: { state: string }) {
    return this.queueService.moveJob(id, body.state);
  }

  @Delete('completed')
  clearCompleted() {
    return this.queueService.clearCompleted();
  }

  @Delete('failed')
  clearFailed() {
    return this.queueService.clearFailed();
  }

  @Delete('all')
  clearAll() {
    return this.queueService.clearAll();
  }
}
