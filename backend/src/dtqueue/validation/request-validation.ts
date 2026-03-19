import { BadRequestException } from '@nestjs/common';
import { JobState } from '../queue/interfaces/queue-job';

const DEFAULT_RETRY_TIME = 3;
const MIN_PROCESSING_TIME = 100;
const MAX_PROCESSING_TIME = 600000;
const MIN_RETRY_TIME = 1;
const MAX_RETRY_TIME = 20;
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 10;
const MAX_BENCHMARK_COUNT = 1000;

type JsonObject = Record<string, unknown>;

interface BenchmarkGroup {
  count: number;
  processingTime: number;
}

export interface AddJobBody {
  jobName: string;
  payload: JsonObject;
  options: {
    retryTime: number;
  };
}

export interface SpawnJobBody {
  jobName: string;
  processingTime: number;
}

export interface BenchmarkBody {
  success: BenchmarkGroup;
  failed: BenchmarkGroup;
  stalled: BenchmarkGroup;
}

const JOB_STATES: JobState[] = [
  'waiting',
  'processing',
  'stalled',
  'completed',
  'failed',
];

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getObject(value: unknown, field: string): JsonObject {
  if (!isObject(value)) {
    throw new BadRequestException(`${field} must be an object`);
  }
  return value;
}

function getString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function getNumber(value: unknown, field: string): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value)
        : NaN;

  if (!Number.isFinite(parsed)) {
    throw new BadRequestException(`${field} must be a finite number`);
  }
  return parsed;
}

function getIntegerInRange(
  value: unknown,
  field: string,
  min: number,
  max: number,
): number {
  const parsed = getNumber(value, field);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new BadRequestException(`${field} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function getProcessingTime(value: unknown, field: string): number {
  return getIntegerInRange(value, field, MIN_PROCESSING_TIME, MAX_PROCESSING_TIME);
}

function getRetryTime(value: unknown): number {
  return getIntegerInRange(value, 'options.retryTime', MIN_RETRY_TIME, MAX_RETRY_TIME);
}

function getBenchmarkGroup(value: unknown, field: string): BenchmarkGroup {
  const group = getObject(value, field);
  return {
    count: getIntegerInRange(group.count, `${field}.count`, 0, MAX_BENCHMARK_COUNT),
    processingTime: getProcessingTime(
      group.processingTime,
      `${field}.processingTime`,
    ),
  };
}

export function validateStateQuery(state?: string): JobState | undefined {
  if (!state || state.trim().length === 0) {
    return undefined;
  }
  const normalized = state.trim() as JobState;
  if (!JOB_STATES.includes(normalized)) {
    throw new BadRequestException(`state must be one of: ${JOB_STATES.join(', ')}`);
  }
  return normalized;
}

export function validateAddJobBody(body: unknown): AddJobBody {
  const data = getObject(body, 'body');
  const payload = getObject(data.payload, 'payload');
  const options = data.options === undefined ? undefined : getObject(data.options, 'options');

  return {
    jobName: getString(data.jobName, 'jobName'),
    payload,
    options: {
      retryTime:
        options && options.retryTime !== undefined
          ? getRetryTime(options.retryTime)
          : DEFAULT_RETRY_TIME,
    },
  };
}

export function validateSpawnJobsBody(body: unknown): SpawnJobBody[] | null {
  if (body === undefined || body === null) {
    return null;
  }

  if (isObject(body) && Object.keys(body).length === 0) {
    return null;
  }

  if (!Array.isArray(body)) {
    throw new BadRequestException(
      'body must be an array of jobs (or empty for random spawn)',
    );
  }

  return body.map((rawJob, index) => {
    const job = getObject(rawJob, `body[${index}]`);
    return {
      jobName: getString(job.jobName, `body[${index}].jobName`),
      processingTime: getProcessingTime(
        job.processingTime,
        `body[${index}].processingTime`,
      ),
    };
  });
}

export function validateBenchmarkBody(body: unknown): BenchmarkBody {
  const data = getObject(body, 'body');
  return {
    success: getBenchmarkGroup(data.success, 'success'),
    failed: getBenchmarkGroup(data.failed, 'failed'),
    stalled: getBenchmarkGroup(data.stalled, 'stalled'),
  };
}

export function validateStartWorkerBody(body: unknown): { concurrency: number } {
  if (body === undefined || body === null) {
    return { concurrency: 4 };
  }

  if (isObject(body) && Object.keys(body).length === 0) {
    return { concurrency: 4 };
  }

  const data = getObject(body, 'body');
  if (data.concurrency === undefined) {
    return { concurrency: 4 };
  }

  return {
    concurrency: getIntegerInRange(
      data.concurrency,
      'concurrency',
      MIN_CONCURRENCY,
      MAX_CONCURRENCY,
    ),
  };
}

export function validateSetConcurrencyBody(body: unknown): { value: number } {
  const data = getObject(body, 'body');
  return {
    value: getIntegerInRange(data.value, 'value', MIN_CONCURRENCY, MAX_CONCURRENCY),
  };
}
