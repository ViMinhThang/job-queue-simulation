import { Job, QueueStats, WorkerStatus, AddJobRequest, JobState, generateRandomPayload, SAMPLE_JOB_NAMES } from './types';

const generateId = () => crypto.randomUUID();

class MockQueueService {
  private jobs: Map<string, Job> = new Map();
  private workerStatus: WorkerStatus = {
    isRunning: false,
    concurrency: 4,
    processingSpeed: 1000,
    jobsProcessedPerMinute: 0,
    averageWaitTime: 0,
  };
  private processingIntervals: NodeJS.Timeout[] = [];
  private simulateInterval: NodeJS.Timeout | null = null;
  private isSimulating = false;
  private simulateRate = 3000;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.seedInitialJobs();
  }

  private seedInitialJobs() {
    const sampleJobs: Job[] = [
      {
        id: generateId(),
        jobName: 'sendEmail',
        payload: { to: 'alice@example.com', subject: 'Welcome!' },
        state: 'waiting',
        retryCount: 0,
        timeIn: new Date(Date.now() - 60000),
        options: { retryTime: 3 },
      },
      {
        id: generateId(),
        jobName: 'processImage',
        payload: { url: 'https://example.com/photo.jpg', width: 1200 },
        state: 'waiting',
        retryCount: 0,
        timeIn: new Date(Date.now() - 30000),
        options: { retryTime: 3 },
      },
      {
        id: generateId(),
        jobName: 'sendNotification',
        payload: { userId: '123', message: 'Hello!' },
        state: 'processing',
        retryCount: 0,
        timeIn: new Date(Date.now() - 5000),
        options: { retryTime: 3 },
      },
    ];
    sampleJobs.forEach((job) => this.jobs.set(job.id, job));
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  getAllJobs(): Job[] {
    return Array.from(this.jobs.values());
  }

  getJobsByState(state: JobState): Job[] {
    return this.getAllJobs().filter((job) => job.state === state);
  }

  getQueueStats(): QueueStats {
    const jobs = this.getAllJobs();
    return {
      waiting: jobs.filter((j) => j.state === 'waiting').length,
      processing: jobs.filter((j) => j.state === 'processing').length,
      completed: jobs.filter((j) => j.state === 'completed').length,
      failed: jobs.filter((j) => j.state === 'failed').length,
      stalled: jobs.filter((j) => j.state === 'stalled').length,
    };
  }

  getWorkerStatus(): WorkerStatus {
    return { 
      ...this.workerStatus,
      isRunning: this.workerStatus.isRunning || this.isSimulating,
    };
  }

  getSimulationStatus() {
    return {
      isSimulating: this.isSimulating,
      simulateRate: this.simulateRate,
    };
  }

  async addJob(request: AddJobRequest): Promise<Job> {
    const job: Job = {
      id: generateId(),
      jobName: request.jobName,
      payload: request.payload,
      state: 'waiting',
      retryCount: 0,
      timeIn: new Date(),
      options: request.options ?? { retryTime: 3 },
    };
    this.jobs.set(job.id, job);
    this.notify();
    return job;
  }

  async spawnRandomJob(): Promise<Job> {
    const job = this.generateRandomJob();
    this.jobs.set(job.id, job);
    this.notify();
    return job;
  }

  private generateRandomJob(): Job {
    const jobName = SAMPLE_JOB_NAMES[Math.floor(Math.random() * SAMPLE_JOB_NAMES.length)];
    return {
      id: generateId(),
      jobName,
      payload: generateRandomPayload(jobName),
      state: 'waiting',
      retryCount: 0,
      timeIn: new Date(),
      options: { retryTime: Math.floor(Math.random() * 3) + 1 },
    };
  }

  async simulateJobs(enable: boolean): Promise<void> {
    if (enable && !this.isSimulating) {
      this.isSimulating = true;
      
      const spawnJob = () => {
        const job = this.generateRandomJob();
        this.jobs.set(job.id, job);
        this.notify();
      };

      spawnJob();
      this.simulateInterval = setInterval(spawnJob, this.simulateRate);
      this.notify();
    } else if (!enable && this.isSimulating) {
      this.isSimulating = false;
      if (this.simulateInterval) {
        clearInterval(this.simulateInterval);
        this.simulateInterval = null;
      }
      this.notify();
    }
  }

  async setSimulateRate(rate: number): Promise<void> {
    this.simulateRate = Math.max(500, Math.min(10000, rate));
    if (this.isSimulating) {
      if (this.simulateInterval) {
        clearInterval(this.simulateInterval);
      }
      const spawnJob = () => {
        const job = this.generateRandomJob();
        this.jobs.set(job.id, job);
        this.notify();
      };
      this.simulateInterval = setInterval(spawnJob, this.simulateRate);
    }
    this.notify();
  }

  async deleteJob(id: string): Promise<void> {
    this.jobs.delete(id);
    this.notify();
  }

  async moveJob(id: string, newState: JobState): Promise<void> {
    const job = this.jobs.get(id);
    if (job) {
      job.state = newState;
      if (newState === 'waiting') {
        job.timeIn = new Date();
      }
      this.notify();
    }
  }

  private workerCounter = 0;

  private getNextWorkerId(): string {
    this.workerCounter++;
    return `worker-${this.workerCounter}`;
  }

  async startWorker(): Promise<void> {
    if (this.workerStatus.isRunning) return;
    
    this.workerStatus.isRunning = true;
    this.notify();

    const processBatch = async () => {
      const waitingJobs = this.getJobsByState('waiting');
      const toProcess = waitingJobs.slice(0, this.workerStatus.concurrency);

      for (const job of toProcess) {
        job.state = 'processing';
        job.workerId = this.getNextWorkerId();
        this.notify();

        setTimeout(() => {
          const shouldFail = Math.random() < 0.1;
          
          if (shouldFail && job.retryCount < job.options.retryTime) {
            job.retryCount++;
            job.state = 'waiting';
            job.workerId = undefined;
            this.notify();
          } else if (shouldFail && job.retryCount >= job.options.retryTime) {
            job.state = 'failed';
            job.workerId = undefined;
            this.notify();
          } else {
            job.state = 'completed';
            job.workerId = undefined;
            this.workerStatus.jobsProcessedPerMinute++;
            this.notify();
          }
        }, this.workerStatus.processingSpeed);
      }
    };

    const interval = setInterval(processBatch, this.workerStatus.processingSpeed);
    this.processingIntervals.push(interval);
    processBatch();

    const stallCheckInterval = setInterval(() => {
      const processingJobs = this.getJobsByState('processing');
      for (const job of processingJobs) {
        const elapsed = Date.now() - new Date(job.timeIn).getTime();
        if (elapsed > 30000) {
          job.state = 'stalled';
          this.notify();
        }
      }
    }, 5000);
    this.processingIntervals.push(stallCheckInterval);
  }

  async stopWorker(): Promise<void> {
    this.workerStatus.isRunning = false;
    this.processingIntervals.forEach(clearInterval);
    this.processingIntervals = [];
    this.notify();
  }

  setConcurrency(value: number) {
    this.workerStatus.concurrency = Math.max(1, Math.min(10, value));
    this.notify();
  }

  setProcessingSpeed(value: number) {
    this.workerStatus.processingSpeed = Math.max(100, Math.min(5000, value));
    this.notify();
  }

  async clearCompleted(): Promise<void> {
    const completedJobs = this.getJobsByState('completed');
    completedJobs.forEach((job) => this.jobs.delete(job.id));
    this.notify();
  }

  async clearFailed(): Promise<void> {
    const failedJobs = this.getJobsByState('failed');
    failedJobs.forEach((job) => this.jobs.delete(job.id));
    this.notify();
  }

  async clearAll(): Promise<void> {
    this.jobs.clear();
    this.notify();
  }
}

export const mockQueueService = new MockQueueService();
