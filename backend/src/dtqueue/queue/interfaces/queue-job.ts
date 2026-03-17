import { UUID } from 'node:crypto';

export interface JobPayload {
  processingTime?: number;
  [key: string]: any;
}

export type PayLoadType = JobPayload;

export interface sendEmailPayLoad extends JobPayload {
  to: string;
  subject: string;
}
export interface resizeImagePayLoad extends JobPayload {
  url: string;
  width: number;
}

export interface Job<T extends PayLoadType> {
  id: UUID;
  jobName: string;
  retryCount: number;
  timeIn: Date;
  state: string;
  payload: T;
  options: JobOptions;
}
export interface JobOptions {
  retryTime: number;
}
