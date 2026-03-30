import { useState, useEffect, useRef, useCallback } from "react";
import { createRedisClient } from "../../core/redis.js";
import { Queue } from "../../core/queue.js";
import { Worker } from "../../core/worker.js";
import { config } from "../../core/config.js";
import type { Job, QueueStats } from "../../core/types.js";

export function useQueue(initialConcurrency: number) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<QueueStats>({
    waiting: 0, processing: 0, completed: 0, failed: 0, stalled: 0,
  });
  const [ready, setReady] = useState(false);
  const [workerRunning, setWorkerRunning] = useState(false);
  const [concurrency, setConcurrency] = useState(initialConcurrency);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [heartbeats, setHeartbeats] = useState<Record<string, number>>({});

  const workerRef = useRef<Worker | null>(null);
  const queueRef = useRef<Queue | null>(null);
  const redisRef = useRef<ReturnType<typeof createRedisClient> | null>(null);

  const refresh = useCallback(async () => {
    if (!queueRef.current) return;
    try {
      const [newJobs, newStats] = await Promise.all([
        queueRef.current.getJobs(),
        queueRef.current.getStats(),
      ]);
      setJobs(newJobs);
      setStats(newStats);

      const processingIds = newJobs.filter(j => j.state === "processing").map(j => j.id);
      if (processingIds.length > 0) {
        const hb = await queueRef.current.getJobHeartbeatTTLs(processingIds);
        setHeartbeats(hb);
      } else {
        setHeartbeats({});
      }

      setLastRefreshAt(new Date());
    } catch (err) {
      // Silently handle refresh errors (typical on cleanup)
    }
  }, []);

  useEffect(() => {
    (async () => {
      const redis = createRedisClient();
      await redis.connect();
      redisRef.current = redis;

      queueRef.current = new Queue(redis);
      workerRef.current = new Worker(redis);

      setReady(true);
      await refresh();
    })();

    const interval = setInterval(refresh, config.ui.refreshIntervalMs);

    return () => {
      clearInterval(interval);
      workerRef.current?.stop().catch(() => {});
      redisRef.current?.quit().catch(() => {});
    };
  }, [refresh]);

  useEffect(() => {
    if (!workerRef.current) return;
    if (workerRunning) {
      workerRef.current.start(concurrency);
    } else {
      workerRef.current.stop().catch(() => {});
    }
  }, [workerRunning, concurrency]);

  return {
    jobs,
    stats,
    ready,
    workerRunning,
    concurrency,
    setWorkerRunning,
    setConcurrency,
    lastRefreshAt,
    heartbeats,
    queue: queueRef.current,
    refresh,
  };
}
