import { Job, QueueStats, WorkerStatus, AddJobRequest, JobState } from './types';
import { mockQueueService } from './mock-service';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export type ConnectionMode = 'real' | 'mock';

export interface SimulationStatus {
  isSimulating: boolean;
  simulateRate: number;
}

export interface QueueAPI {
  getAllJobs: () => Promise<Job[]>;
  getJobsByState: (state: JobState) => Promise<Job[]>;
  getQueueStats: () => Promise<QueueStats>;
  getWorkerStatus: () => Promise<WorkerStatus>;
  getSimulationStatus: () => Promise<SimulationStatus>;
  spawnRandomJob: () => Promise<Job>;
  addJob: (request: AddJobRequest) => Promise<Job>;
  deleteJob: (id: string) => Promise<void>;
  moveJob: (id: string, newState: JobState) => Promise<void>;
  startWorker: () => Promise<void>;
  stopWorker: () => Promise<void>;
  startSimulation: () => Promise<void>;
  stopSimulation: () => Promise<void>;
  setSimulateRate: (value: number) => Promise<void>;
  setConcurrency: (value: number) => Promise<void>;
  setProcessingSpeed: (value: number) => Promise<void>;
  clearCompleted: () => Promise<void>;
  clearFailed: () => Promise<void>;
  clearAll: () => Promise<void>;
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

  async moveJob(id: string, newState: JobState) {
    const res = await fetch(`${API_BASE}/queue/jobs/${id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: newState }),
    });
    if (!res.ok) throw new Error('Failed to move job');
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

  async startSimulation() {
    throw new Error('Simulation not available in real mode');
  },

  async stopSimulation() {
    throw new Error('Simulation not available in real mode');
  },

  async setSimulateRate(_value: number) {
    throw new Error('Simulation not available in real mode');
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

  subscribe() {
    return () => {};
  },
};

const mockAPI: QueueAPI = {
  getAllJobs: () => Promise.resolve(mockQueueService.getAllJobs()),
  getJobsByState: (state) => Promise.resolve(mockQueueService.getJobsByState(state)),
  getQueueStats: () => Promise.resolve(mockQueueService.getQueueStats()),
  getWorkerStatus: () => Promise.resolve(mockQueueService.getWorkerStatus()),
  getSimulationStatus: () => Promise.resolve(mockQueueService.getSimulationStatus()),
  spawnRandomJob: () => mockQueueService.spawnRandomJob(),
  addJob: (request) => mockQueueService.addJob(request),
  deleteJob: (id) => mockQueueService.deleteJob(id),
  moveJob: (id, newState) => mockQueueService.moveJob(id, newState),
  startWorker: () => mockQueueService.startWorker(),
  stopWorker: () => mockQueueService.stopWorker(),
  startSimulation: () => mockQueueService.simulateJobs(true),
  stopSimulation: () => mockQueueService.simulateJobs(false),
  setSimulateRate: (value) => Promise.resolve(mockQueueService.setSimulateRate(value)),
  setConcurrency: (value) => Promise.resolve(mockQueueService.setConcurrency(value)),
  setProcessingSpeed: (value) => Promise.resolve(mockQueueService.setProcessingSpeed(value)),
  clearCompleted: () => mockQueueService.clearCompleted(),
  clearFailed: () => mockQueueService.clearFailed(),
  clearAll: () => mockQueueService.clearAll(),
  subscribe: (listener) => mockQueueService.subscribe(listener),
};

export async function detectConnectionMode(): Promise<ConnectionMode> {
  try {
    const res = await fetch(`${API_BASE}/queue/status`, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(2000) 
    });
    return res.ok ? 'real' : 'mock';
  } catch {
    return 'mock';
  }
}

export function useQueueAPI(mode: ConnectionMode): QueueAPI {
  return mode === 'real' ? realAPI : mockAPI;
}

export { realAPI, mockAPI };
