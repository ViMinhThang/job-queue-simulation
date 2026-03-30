import { useState, useEffect } from "react";
import type { Job } from "../../core/types.js";
import { Queue } from "../../core/queue.js";

const COMMAND_SUGGESTIONS = [
  "/start", "/stop", "/retry", "/exit", "/help", "/clear",
  "echo \"\"", "mkdir \"\"", "ls -la", "cat \"\"", "npm run ", "node "
];

interface CommandEngineOptions {
  jobs: Job[];
  selected: number;
  setSelected: (idx: number) => void;
  setWorkerRunning: (running: boolean) => void;
  setConcurrency: (val: number) => void;
  queue: Queue | null;
  refresh: () => Promise<void>;
  exit: () => void;
}

export function useCommandEngine({
  jobs,
  selected,
  setSelected,
  setWorkerRunning,
  setConcurrency,
  queue,
  refresh,
  exit,
}: CommandEngineOptions) {
  const [commandInput, setCommandInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [originalInput, setOriginalInput] = useState("");

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
          const idArg = parts[1];
          let job: Job | undefined;
          if (idArg) {
            job = jobs.find(j => j.id.startsWith(idArg));
          } else {
            job = jobs[selected];
          }

          if (job && queue) {
            await queue.retryJob(job.id);
            await refresh();
          }
          break;
        }
        case "/select":
        case "/s": {
          const idArg = parts[1];
          if (idArg) {
            const idx = jobs.findIndex(j => j.id.startsWith(idArg));
            if (idx !== -1) setSelected(idx);
          }
          break;
        }
        case "/exit":
        case "/q":
        case "/quit":
          exit();
          break;
        case "/c":
        case "/concurrency": {
          const val = parseInt(parts[1] ?? "");
          if (!isNaN(val)) setConcurrency(Math.max(1, Math.min(10, val)));
          break;
        }
        case "/clear": {
          const arg = parts[1]?.toLowerCase() as any;
          const target = ["completed", "failed", "stalled", "all"].includes(arg) ? arg : "all";
          if (queue) {
            await queue.clear(target);
            await refresh();
          }
          break;
        }
      }
    } else {
      if (queue) {
        await queue.addJob(cmd);
        await refresh();
      }
    }

    if (cmd && (!history.length || history[history.length - 1] !== cmd)) {
      setHistory(prev => [...prev, cmd]);
    }

    setCommandInput("");
    setHistoryIndex(-1);
    setOriginalInput("");
    setSuggestions([]);
  };

  const handleHistory = (direction: "up" | "down") => {
    if (history.length === 0) return;

    let newIndex = historyIndex;
    if (direction === "up") {
      if (historyIndex === -1) setOriginalInput(commandInput);
      newIndex = Math.min(history.length - 1, historyIndex + 1);
    } else {
      newIndex = Math.max(-1, historyIndex - 1);
    }

    if (newIndex !== historyIndex) {
      setHistoryIndex(newIndex);
      if (newIndex === -1) {
        setCommandInput(originalInput);
      } else {
        setCommandInput(history[history.length - 1 - newIndex] || "");
      }
    }
  };

  return {
    commandInput,
    setCommandInput,
    suggestions,
    handleSubmit,
    handleHistory,
  };
}
