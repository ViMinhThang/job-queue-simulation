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
  constructor(private readonly queueService: QueueService) { }

  @Get('status')
  getStats() {
    return this.queueService.getStats();
  }

  @Get('jobs')
  getJobs(@Query('state') state: string) {
    return this.queueService.getAllJobs(state);
  }

  @Post('jobs')
  addJob(@Body() body: { jobName: string; payload: any; options?: any }) {
    return this.queueService.addJob(
      body.jobName,
      body.payload,
      body.options || { retryTime: 3 },
    );
  }

  @Post('spawn')
  async spawnJobs(@Body() body?: { jobName: string; processingTime: number }[]) {
    if (!body || !Array.isArray(body)) {
      // Spawn a single random job if no body provided
      const sampleNames = ['processImage', 'sendNotification', 'generateReport', 'syncData', 'backupDatabase'];
      const jobName = sampleNames[Math.floor(Math.random() * sampleNames.length)];
      const processingTime = Math.floor(Math.random() * 5000) + 1000;
      return await this.queueService.spawnJob(jobName, processingTime);
    }

    return Promise.all(
      body.map((job) =>
        this.queueService.spawnJob(job.jobName, job.processingTime),
      ),
    );
  }

  @Delete('jobs/:id')
  deleteJob(@Param('id') id: string) {
    return this.queueService.deleteJob(id);
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
