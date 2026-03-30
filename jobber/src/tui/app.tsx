import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, useApp, useInput, Text } from "ink";
import TextInput from "ink-text-input";
import { createRedisClient } from "../core/redis.js";
import { Queue } from "../core/queue.js";
import { Worker } from "../core/worker.js";
import { JobList } from "./components/job-list.js";
import { OutputPanel } from "./components/output-panel.js";
import { StatsBar } from "./components/stats-bar.js";
import { Header } from "./components/header.js";
import { config } from "../core/config.js";
import type { Job, QueueStats } from "../core/types.js";

const COMMAND_SUGGESTIONS = [
  "/start", "/stop", "/retry", "/exit", "/help", "/clear",
  "echo \"\"", "mkdir \"\"", "ls -la", "cat \"\"", "npm run ", "node "
];

interface AppProps {
  concurrency: number;
}

export function App({ concurrency: initialConcurrency }: AppProps) {
  const { exit } = useApp();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<QueueStats>({
    waiting: 0, processing: 0, completed: 0, failed: 0, stalled: 0,
  });
  const [selected, setSelected] = useState(0);
  const [output, setOutput] = useState<{ stdout: string[]; stderr: string[] }>({
    stdout: [], stderr: [],
  });
  const [ready, setReady] = useState(false);
  const [workerRunning, setWorkerRunning] = useState(false);
  const [concurrency, setConcurrency] = useState(initialConcurrency);
  const [inputMode, setInputMode] = useState(true);
  const [commandInput, setCommandInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const workerRef = useRef<Worker | null>(null);
  const queueRef = useRef<Queue | null>(null);
  const redisRef = useRef<ReturnType<typeof createRedisClient> | null>(null);
  const refreshRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    process.stdout.write("\x1b[2J\x1b[H");
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const redis = createRedisClient();
      await redis.connect();
      redisRef.current = redis;

      const q = new Queue(redis);
      const w = new Worker(redis);
      queueRef.current = q;
      workerRef.current = w;

      setReady(true);

      const refresh = async () => {
        try {
          const [newJobs, newStats] = await Promise.all([q.getJobs(), q.getStats()]);
          setJobs(newJobs);
          setStats(newStats);
          setSelected((s) => Math.min(s, Math.max(0, newJobs.length - 1)));
        } catch {}
      };
      refreshRef.current = refresh;

      interval = setInterval(refresh, config.ui.refreshIntervalMs);
      await refresh();
    })();

    return () => {
      if (interval) clearInterval(interval);
      workerRef.current?.stop().catch(() => {});
      redisRef.current?.quit().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const w = workerRef.current;
    if (!w) return;
    if (workerRunning) {
      w.start(concurrency);
    } else {
      w.stop().catch(() => {});
    }
  }, [workerRunning, concurrency]);

  useEffect(() => {
    if (!queueRef.current || jobs.length === 0) return;
    const job = jobs[selected];
    if (!job) return;

    let cancelled = false;
    const loadOutput = async () => {
      const out = await queueRef.current!.getOutput(job.id);
      if (!cancelled) setOutput(out);
    };
    loadOutput();
    const interval = setInterval(loadOutput, config.ui.outputIntervalMs);
    return () => { cancelled = true; clearInterval(interval); };
  }, [jobs, selected]);

  useEffect(() => {
    if (commandInput.startsWith("/")) {
      const parts = commandInput.split(" ");
      const cmdPart = parts[0] ?? "";
      const filtered = COMMAND_SUGGESTIONS.filter(c => 
        c.startsWith(cmdPart) && c !== cmdPart
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [commandInput]);

  const handleSubmit = async (value: string) => {
    const cmd = value.trim();
    if (!cmd) return;

    if (cmd.startsWith("/")) {
      const parts = cmd.split(" ");
      const baseCmd = parts[0]?.toLowerCase();

      switch (baseCmd) {
        case "/start":
          setWorkerRunning(true);
          break;
        case "/stop":
          setWorkerRunning(false);
          break;
        case "/retry":
        case "/r": {
          const job = jobs[selected];
          if (job && queueRef.current) {
            await queueRef.current.retryJob(job.id);
            refreshRef.current?.();
          }
          break;
        }
        case "/exit":
        case "/q":
        case "/quit":
          workerRef.current?.stop().catch(() => {});
          exit();
          break;
        case "/c":
        case "/concurrency": {
          const val = parseInt(parts[1] ?? "");
          if (!isNaN(val)) setConcurrency(Math.max(1, Math.min(10, val)));
          break;
        }
        default:
          // Unknown command or just typing a shell command starting with /
          // fallback to enqueuing? No, commands must be specific slash commands.
          break;
      }
    } else {
      // Normal shell command entry
      if (queueRef.current) {
        await queueRef.current.addJob(cmd);
      }
    }

    setCommandInput("");
    setSuggestions([]);
  };

  useInput((input, key) => {
    // Selection navigation (Always Active)
    if (key.upArrow) {
      setSelected((s) => Math.max(0, s - 1));
      return;
    }
    if (key.downArrow) {
      setSelected((s) => Math.min(jobs.length - 1, s + 1));
      return;
    }

    // Capture Escape to clear input or toggle focus mode (though we want it always focused)
    if (key.escape) {
      setCommandInput("");
      setSuggestions([]);
      return;
    }

    // Ctrl+C handles exit always
    if (key.ctrl && input === "c") {
      workerRef.current?.stop().catch(() => {});
      exit();
      return;
    }

    // No more alphanumeric shortcuts (q, s, [, ], a)
    // They are now slash commands.
  });

  if (!ready) {
    return React.createElement(
      Box, null,
      React.createElement(Text, { color: "yellow" }, "Connecting to Redis..."),
    );
  }

  const selectedJob = jobs[selected] ?? null;

  return React.createElement(
    Box,
    { flexDirection: "column", height: "100%" },
    React.createElement(Header, { workerRunning }),
    React.createElement(JobList, { jobs, selected }),
    React.createElement(OutputPanel, { job: selectedJob, output }),
    
    // Command Bar (Simplified Suggestions UI)
    React.createElement(
      Box,
      { flexDirection: "column" },
      suggestions.length > 0 && React.createElement(
        Box,
        { paddingX: 1 },
        React.createElement(Text, { dimColor: true, italic: true }, 
          `Try: ${suggestions.slice(0, 5).join(", ")}${suggestions.length > 5 ? "..." : ""}`
        )
      ),
      React.createElement(
        Box,
        { borderStyle: "round", borderColor: "green", paddingX: 1 },
        React.createElement(Text, { color: "green", bold: true }, "> "),
        React.createElement(TextInput, {
          value: commandInput,
          onChange: setCommandInput,
          onSubmit: handleSubmit,
          placeholder: "Type a command or / for help...",
        }),
      )
    ),
    
    React.createElement(StatsBar, { stats }),
  );
}
