import { Job, QueueStats, WorkerStatus, AddJobRequest, JobState, BenchmarkConfig, Heartbeat } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface SimulationStatus {
  isSimulating: boolean;
  simulateRate: number;
}

export interface QueueAPI {
  getAllJobs: () => Promise<Job[]>;
  getJobsByState: (state: JobState) => Promise<Job[]>;
  getQueueStats: () => Promise<QueueStats>;
  getWorkerStatus: () => Promise<WorkerStatus>;
  getHeartbeats: () => Promise<Heartbeat[]>;
  getSimulationStatus: () => Promise<SimulationStatus>;
  spawnRandomJob: () => Promise<Job>;
  addJob: (request: AddJobRequest) => Promise<Job>;
  deleteJob: (id: string) => Promise<void>;
  startWorker: () => Promise<void>;
  stopWorker: () => Promise<void>;
  setConcurrency: (value: number) => Promise<void>;
  setProcessingSpeed: (value: number) => Promise<void>;
  clearCompleted: () => Promise<void>;
  clearFailed: () => Promise<void>;
  clearAll: () => Promise<void>;
  runBenchmark: (config: BenchmarkConfig) => Promise<{ total: number }>;
  subscribe: (listener: () => void) => () => void;
}

const realAPI: QueueAPI = {
  async getAllJobs() {
    const res = await fetch(`${API_BASE}/queue/jobs`);
    if (!res.ok) throw new Error('Failed to fetch jobs');
    return res.json();
  },

  async getJobsByState(state: JobState) {
    const res = await fetch(`${API_BASE}/queue/jobs?state=${state}`);
    if (!res.ok) throw new Error('Failed to fetch jobs');
    return res.json();
  },

  async getQueueStats() {
    const res = await fetch(`${API_BASE}/queue/status`);
    if (!res.ok) throw new Error('Failed to fetch queue stats');
    return res.json();
  },

  async getWorkerStatus() {
    const res = await fetch(`${API_BASE}/worker/status`);
    if (!res.ok) throw new Error('Failed to fetch worker status');
    return res.json();
  },

  async getHeartbeats() {
    const res = await fetch(`${API_BASE}/worker/heartbeats`);
    if (!res.ok) throw new Error('Failed to fetch heartbeats');
    return res.json();
  },

  async getSimulationStatus() {
    return { isSimulating: false, simulateRate: 3000 };
  },

  async spawnRandomJob() {
    const res = await fetch(`${API_BASE}/queue/spawn`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to spawn job');
    return res.json();
  },

  async addJob(request: AddJobRequest) {
    const res = await fetch(`${API_BASE}/queue/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!res.ok) throw new Error('Failed to add job');
    return res.json();
  },

  async deleteJob(id: string) {
    const res = await fetch(`${API_BASE}/queue/jobs/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete job');
  },

  async startWorker() {
    const res = await fetch(`${API_BASE}/worker/start`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to start worker');
  },

  async stopWorker() {
    const res = await fetch(`${API_BASE}/worker/stop`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to stop worker');
  },

  async setConcurrency(value: number) {
    const res = await fetch(`${API_BASE}/worker/concurrency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
    if (!res.ok) throw new Error('Failed to set concurrency');
  },

  async setProcessingSpeed(value: number) {
    const res = await fetch(`${API_BASE}/worker/speed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
    if (!res.ok) throw new Error('Failed to set processing speed');
  },

  async clearCompleted() {
    const res = await fetch(`${API_BASE}/queue/completed`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to clear completed');
  },

  async clearFailed() {
    const res = await fetch(`${API_BASE}/queue/failed`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to clear failed');
  },

  async clearAll() {
    const res = await fetch(`${API_BASE}/queue/all`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to clear all');
  },

  async runBenchmark(config: BenchmarkConfig) {
    const res = await fetch(`${API_BASE}/queue/benchmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Failed to run benchmark');
    return res.json();
  },

  subscribe() {
    return () => {};
  },
};

export function useQueueAPI(): QueueAPI {
  return realAPI;
}

export { realAPI };
