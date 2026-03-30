import React, { useState, useEffect } from "react";
import { Box, useApp, useInput, Text } from "ink";
import { JobList } from "./components/job-list.js";
import { OutputPanel } from "./components/output-panel.js";
import { StatsBar } from "./components/stats-bar.js";
import { HeartbeatRow } from "./components/heartbeat-row.js";
import { Header } from "./components/header.js";
import { CommandBar } from "./components/command-bar.js";
import { useQueue } from "./hooks/use-queue.js";
import { useCommandEngine } from "./hooks/use-command-engine.js";
import { config } from "../core/config.js";

interface AppProps {
  concurrency: number;
}

export function App({ concurrency: initialConcurrency }: AppProps) {
  const { exit } = useApp();
  const [selected, setSelected] = useState(0);
  const [interactionMode, setInteractionMode] = useState<"command" | "nav">("command");
  const [output, setOutput] = useState<{ stdout: string[]; stderr: string[] }>({
    stdout: [], stderr: [],
  });

  // 1. Hook for Queue/Worker logic
  const {
    jobs, stats, ready, workerRunning, concurrency,
    setWorkerRunning, setConcurrency, lastRefreshAt, heartbeats, queue, refresh
  } = useQueue(initialConcurrency);

  // 2. Hook for Command logic
  const {
    commandInput, setCommandInput, suggestions, handleSubmit, handleHistory
  } = useCommandEngine({
    jobs, selected, setSelected, setWorkerRunning, setConcurrency,
    queue, refresh, exit: () => {
      // Ensure cleanup before exit
      refresh(); // final state sync
      exit();
    }
  });

  // UI Setup: Clear screen on mount
  useEffect(() => {
    process.stdout.write("\x1b[2J\x1b[H");
  }, []);

  // Output polling for selected job
  useEffect(() => {
    if (!queue || jobs.length === 0) return;
    const job = jobs[selected];
    if (!job) return;

    let cancelled = false;
    const loadOutput = async () => {
      const out = await queue.getOutput(job.id);
      if (!cancelled) setOutput(out);
    };
    loadOutput();
    const interval = setInterval(loadOutput, config.ui.outputIntervalMs);
    return () => { cancelled = true; clearInterval(interval); };
  }, [jobs, selected, queue]);

  // Global Input handling (Ctrl+C, Escape)
  useInput((input, key) => {
    if (key.escape) {
      setInteractionMode((m) => (m === "command" ? "nav" : "command"));
      setCommandInput("");
      return;
    }

    if (interactionMode === "nav") {
      if (key.upArrow) {
        setSelected((s) => Math.max(0, s - 1));
        return;
      }
      if (key.downArrow) {
        setSelected((s) => Math.min(jobs.length - 1, s + 1));
        return;
      }
    }

    if (interactionMode === "command") {
      if (key.upArrow) {
        handleHistory("up");
        return;
      }
      if (key.downArrow) {
        handleHistory("down");
        return;
      }
    }

    if (key.ctrl && input === "c") {
      exit();
    }
  });

  if (!ready) {
    return React.createElement(
      Box, null,
      React.createElement(Text, { color: "yellow" }, "Connecting to Redis..."),
    );
  }

  return React.createElement(
    Box,
    { flexDirection: "column", height: "100%" },
    React.createElement(Header, { workerRunning }),
    React.createElement(HeartbeatRow, { jobs, heartbeats, lastRefreshAt }),
    React.createElement(JobList, { jobs, selected, interactionMode }),
    React.createElement(OutputPanel, { job: jobs[selected] ?? null, output }),
    React.createElement(CommandBar, { 
      commandInput, 
      setCommandInput, 
      onSubmit: handleSubmit, 
      suggestions,
      interactionMode
    }),
  );
}
