'use client';

import { useState, useEffect, useCallback } from 'react';
import { Job, QueueStats, WorkerStatus, AddJobRequest, JobState } from '@/lib/types';
import { useQueueAPI, ConnectionMode, SimulationStatus } from '@/lib/api';

interface UseQueueReturn {
  jobs: Job[];
  stats: QueueStats;
  workerStatus: WorkerStatus;
  simulationStatus: SimulationStatus;
  isLoading: boolean;
  error: string | null;
  connectionMode: ConnectionMode;
  spawnRandomJob: () => Promise<void>;
  addJob: (request: AddJobRequest) => Promise<void>;
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
  refresh: () => void;
}

export function useQueue(connectionMode: ConnectionMode): UseQueueReturn {
  const api = useQueueAPI(connectionMode);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<QueueStats>({ waiting: 0, processing: 0, stalled: 0, completed: 0, failed: 0 });
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus>({
    isRunning: false,
    concurrency: 4,
    processingSpeed: 1000,
    jobsProcessedPerMinute: 0,
    averageWaitTime: 0,
  });
  const [simulationStatus, setSimulationStatus] = useState<SimulationStatus>({
    isSimulating: false,
    simulateRate: 3000,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      const [jobsData, statsData, workerData, simData] = await Promise.all([
        api.getAllJobs(),
        api.getQueueStats(),
        api.getWorkerStatus(),
        api.getSimulationStatus(),
      ]);
      setJobs(jobsData);
      setStats(statsData);
      setWorkerStatus(workerData);
      setSimulationStatus(simData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    refresh();
    const unsubscribe = api.subscribe(refresh);
    const interval = setInterval(refresh, 2000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [api, refresh]);

  const addJob = async (request: AddJobRequest) => {
    await api.addJob(request);
    refresh();
  };

  const spawnRandomJob = async () => {
    await api.spawnRandomJob();
    refresh();
  };

  const deleteJob = async (id: string) => {
    await api.deleteJob(id);
    refresh();
  };

  const moveJob = async (id: string, newState: JobState) => {
    await api.moveJob(id, newState);
    refresh();
  };

  const startWorker = async () => {
    await api.startWorker();
    refresh();
  };

  const stopWorker = async () => {
    await api.stopWorker();
    refresh();
  };

  const startSimulation = async () => {
    await api.startSimulation();
    refresh();
  };

  const stopSimulation = async () => {
    await api.stopSimulation();
    refresh();
  };

  const setSimulateRate = async (value: number) => {
    await api.setSimulateRate(value);
    refresh();
  };

  const setConcurrency = async (value: number) => {
    await api.setConcurrency(value);
    refresh();
  };

  const setProcessingSpeed = async (value: number) => {
    await api.setProcessingSpeed(value);
    refresh();
  };

  const clearCompleted = async () => {
    await api.clearCompleted();
    refresh();
  };

  const clearFailed = async () => {
    await api.clearFailed();
    refresh();
  };

  const clearAll = async () => {
    await api.clearAll();
    refresh();
  };

  return {
    jobs,
    stats,
    workerStatus,
    simulationStatus,
    isLoading,
    error,
    connectionMode,
    spawnRandomJob,
    addJob,
    deleteJob,
    moveJob,
    startWorker,
    stopWorker,
    startSimulation,
    stopSimulation,
    setSimulateRate,
    setConcurrency,
    setProcessingSpeed,
    clearCompleted,
    clearFailed,
    clearAll,
    refresh,
  };
}
