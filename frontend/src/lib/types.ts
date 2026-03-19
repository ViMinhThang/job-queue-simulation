export type JobState = 'waiting' | 'processing' | 'completed' | 'failed' | 'stalled';

export interface JobOptions {
  retryTime: number;
}

export interface Job<T = Record<string, unknown>> {
  id: string;
  jobName: string;
  retryCount: number;
  timeIn: Date;
  state: JobState;
  payload: T;
  options: JobOptions;
  workerId?: string;
}

export interface QueueStats {
  waiting: number;
  processing: number;
  completed: number;
  failed: number;
  stalled: number;
}

export interface WorkerStatus {
  isRunning: boolean;
  concurrency: number;
  processingSpeed: number;
  jobsProcessedPerMinute: number;
  averageWaitTime: number;
}

export interface AddJobRequest {
  jobName: string;
  payload: Record<string, unknown>;
  options?: JobOptions;
}

export const SAMPLE_JOB_NAMES = [
  'processImage',
  'sendNotification',
  'generateReport',
  'syncData',
  'backupDatabase',
  'sendEmail',
  'processPayment',
  'validateUser',
  'cacheWarmup',
  'runAnalytics',
  'failMe',
  'stallMe',
];

export function generateRandomPayload(jobName: string): Record<string, unknown> {
  const random = Math.random();
  
  if (jobName.includes('Email')) {
    return {
      to: `user${Math.floor(random * 1000)}@example.com`,
      subject: `Subject ${Math.floor(random * 100)}`,
      body: `Email body content ${random}`,
    };
  }
  
  if (jobName.includes('Image') || jobName.includes('Photo')) {
    return {
      url: `https://cdn.example.com/image-${Math.floor(random * 1000)}.jpg`,
      width: Math.floor(random * 2000) + 100,
      height: Math.floor(random * 2000) + 100,
      format: 'jpeg',
    };
  }
  
  if (jobName.includes('Payment') || jobName.includes('Invoice')) {
    return {
      amount: (random * 1000).toFixed(2),
      currency: 'USD',
      customerId: `cust_${Math.floor(random * 10000)}`,
      description: `Payment for order #${Math.floor(random * 100000)}`,
    };
  }
  
  if (jobName.includes('Report') || jobName.includes('Analytics')) {
    return {
      reportType: ['sales', 'users', 'revenue', 'performance'][Math.floor(random * 4)],
      period: 'last_30_days',
      format: 'pdf',
      emailTo: `admin@example.com`,
    };
  }
  
  if (jobName.includes('Data') || jobName.includes('Sync')) {
    return {
      source: 'database',
      target: 'warehouse',
      records: Math.floor(random * 10000),
      batchSize: 100,
    };
  }
  
  return {
    action: jobName,
    priority: random > 0.7 ? 'high' : 'normal',
    data: {
      id: Math.floor(random * 10000),
      value: random * 100,
      timestamp: new Date().toISOString(),
    },
  };
}

export interface BenchmarkConfig {
  success: { count: number; processingTime: number };
  failed: { count: number; processingTime: number };
  stalled: { count: number; processingTime: number };
}

export interface Heartbeat {
  jobId: string;
  lastPing: number;
}
