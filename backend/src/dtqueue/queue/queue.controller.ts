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
import {
  validateAddJobBody,
  validateBenchmarkBody,
  validateSpawnJobsBody,
  validateStateQuery,
} from '../validation/request-validation';

@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) { }

  @Get('status')
  getStats() {
    return this.queueService.getStats();
  }

  @Get('jobs')
  getJobs(@Query('state') state?: string) {
    const validatedState = validateStateQuery(state);
    return this.queueService.getAllJobs(validatedState);
  }

  @Post('jobs')
  addJob(@Body() body: unknown) {
    const validatedBody = validateAddJobBody(body);
    return this.queueService.addJob(
      validatedBody.jobName,
      validatedBody.payload,
      validatedBody.options,
    );
  }

  @Post('spawn')
  async spawnJobs(@Body() body?: unknown) {
    const validatedBody = validateSpawnJobsBody(body);
    if (validatedBody === null) {
      const sampleNames = ['processImage', 'sendNotification', 'generateReport', 'syncData', 'backupDatabase'];
      const jobName = sampleNames[Math.floor(Math.random() * sampleNames.length)];
      const processingTime = Math.floor(Math.random() * 5000) + 1000;
      return await this.queueService.addJob(jobName, { processingTime }, { retryTime: 3 });
    }

    return Promise.all(
      validatedBody.map((job) =>
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

  @Delete('stalled')
  clearStalled() {
    return this.queueService.clearStalled();
  }

  @Delete('all')
  clearAll() {
    return this.queueService.clearAll();
  }

  @Post('benchmark')
  async runBenchmark(@Body() body: unknown) {
    const validatedBody = validateBenchmarkBody(body);
    const jobs: Promise<any>[] = [];

    for (let i = 0; i < validatedBody.success.count; i++) {
      jobs.push(
        this.queueService.addJob(
          'benchmark_success',
          { processingTime: validatedBody.success.processingTime },
          { retryTime: 3 },
        ),
      );
    }

    for (let i = 0; i < validatedBody.failed.count; i++) {
      jobs.push(
        this.queueService.addJob(
          'failMe',
          { processingTime: validatedBody.failed.processingTime },
          { retryTime: 3 },
        ),
      );
    }

    for (let i = 0; i < validatedBody.stalled.count; i++) {
      jobs.push(
        this.queueService.addJob(
          'stallMe',
          { processingTime: validatedBody.stalled.processingTime },
          { retryTime: 3 },
        ),
      );
    }

    await Promise.all(jobs);
    return { total: jobs.length };
  }
}
