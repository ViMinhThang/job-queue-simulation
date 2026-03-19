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
      const sampleNames = ['processImage', 'sendNotification', 'generateReport', 'syncData', 'backupDatabase'];
      const jobName = sampleNames[Math.floor(Math.random() * sampleNames.length)];
      const processingTime = Math.floor(Math.random() * 5000) + 1000;
      return await this.queueService.addJob(jobName, { processingTime }, { retryTime: 3 });
    }

    return Promise.all(
      body.map((job) =>
        this.queueService.addJob(job.jobName, { processingTime: job.processingTime }, { retryTime: 3 }),
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

  @Post('benchmark')
  async runBenchmark(
    @Body()
    body: {
      success: { count: number; processingTime: number };
      failed: { count: number; processingTime: number };
      stalled: { count: number; processingTime: number };
    },
  ) {
    const jobs: Promise<any>[] = [];

    for (let i = 0; i < body.success.count; i++) {
      jobs.push(
        this.queueService.addJob(
          'benchmark_success',
          { processingTime: body.success.processingTime },
          { retryTime: 3 },
        ),
      );
    }

    for (let i = 0; i < body.failed.count; i++) {
      jobs.push(
        this.queueService.addJob(
          'failMe',
          { processingTime: body.failed.processingTime },
          { retryTime: 3 },
        ),
      );
    }

    for (let i = 0; i < body.stalled.count; i++) {
      jobs.push(
        this.queueService.addJob(
          'stallMe',
          { processingTime: body.stalled.processingTime },
          { retryTime: 3 },
        ),
      );
    }

    await Promise.all(jobs);
    return { total: jobs.length };
  }
}
