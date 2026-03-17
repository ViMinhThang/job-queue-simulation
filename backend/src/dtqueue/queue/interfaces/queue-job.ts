import { UUID } from 'node:crypto';

export interface PayLoadType {}

export interface sendEmailPayLoad extends PayLoadType {
  to: string;
  subject: string;
}
export interface resizeImagePayLoad extends PayLoadType {
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
