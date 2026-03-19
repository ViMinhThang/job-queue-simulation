import { Controller, Post, Body, Get } from '@nestjs/common';
import { WorkerService } from './worker.service';
import {
  validateSetConcurrencyBody,
  validateStartWorkerBody,
} from '../validation/request-validation';

@Controller('worker')
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}

  @Post('start')
  async startWorkerWithConcurrency(@Body() body?: unknown) {
    const { concurrency } = validateStartWorkerBody(body);
    await this.workerService.startWorker();
    this.workerService.setConcurrency(concurrency);
    return { status: 'started', concurrency };
  }

  @Get('status')
  getStatus() {
    return this.workerService.getWorkerStatus();
  }

  @Get('heartbeats')
  getHeartbeats() {
    return this.workerService.getActiveHeartbeats();
  }

  @Post('concurrency')
  setConcurrency(@Body() body: unknown) {
    const { value } = validateSetConcurrencyBody(body);
    this.workerService.setConcurrency(value);
    return { status: 'updated', concurrency: value };
  }

  @Post('stop')
  async stopWorker() {
    await this.workerService.stopWorker();
    return { status: 'stopped' };
  }
}
