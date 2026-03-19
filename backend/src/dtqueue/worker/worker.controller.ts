import { Controller, Post, Body, Get } from '@nestjs/common';
import { WorkerService } from './worker.service';

@Controller('worker')
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}

  @Post('start')
  async startWorkerWithConcurrency(@Body() body?: { concurrency?: number }) {
    const concurrency = (body && body.concurrency) ? body.concurrency : 4;
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
  setConcurrency(@Body() body: { value: number }) {
    this.workerService.setConcurrency(body.value);
    return { status: 'updated', concurrency: body.value };
  }

  @Post('speed')
  setSpeed(@Body() body: { value: number }) {
    this.workerService.setProcessingSpeed(body.value);
    return { status: 'updated', speed: body.value };
  }

  @Post('stop')
  async stopWorker() {
    await this.workerService.stopWorker();
    return { status: 'stopped' };
  }
}
