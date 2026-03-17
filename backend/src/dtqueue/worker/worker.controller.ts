import { Controller, Post, Body } from '@nestjs/common';
import { WorkerService } from './worker.service';

@Controller('worker')
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}

  @Post('start')
  async startWorkerWithConcurrency(@Body() body: { concurrency?: number }) {
    const concurrency = body.concurrency || 4;
    await this.workerService.processJobs(concurrency);
    return { status: 'started', concurrency };
  }

  @Post('stop')
  async stopWorker() {
    await this.workerService.stopWorker();
    return { status: 'stopped' };
  }
}
