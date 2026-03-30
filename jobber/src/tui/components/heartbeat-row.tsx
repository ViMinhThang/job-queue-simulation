import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import type { Job } from "../../core/types.js";

interface HeartbeatRowProps {
  jobs: Job[];
  heartbeats: Record<string, number>;
  lastRefreshAt: Date | null;
}

export function HeartbeatRow({ jobs, heartbeats, lastRefreshAt }: HeartbeatRowProps) {
  const [pulse, setPulse] = useState(false);
  const activeJobs = jobs.filter((j) => j.state === "processing");

  useEffect(() => {
    if (lastRefreshAt) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 300);
      return () => clearTimeout(timer);
    }
    return;
  }, [lastRefreshAt]);

  return React.createElement(
    Box,
    { paddingX: 1, marginBottom: 0, flexDirection: "row", alignItems: "center" },
    React.createElement(
      Text,
      { color: pulse ? "green" : "gray", bold: pulse },
      pulse ? "  ❤  " : "  ♡  ",
    ),
    React.createElement(
      Text,
      { color: "gray" },
      "SYSTEM HEARTBEAT ",
      React.createElement(Text, { dimColor: true }, "|"),
      " ",
    ),
    React.createElement(
      Text,
      { color: activeJobs.length > 0 ? "cyan" : "gray" },
      activeJobs.length,
      " active heartbeats ",
    ),
    activeJobs.map((j) => {
      const ttl = heartbeats[j.id];
      return React.createElement(
        Text,
        { key: j.id },
        React.createElement(Text, { color: ttl ? "green" : "gray" }, " ● "),
        React.createElement(Text, { color: "gray" }, "["),
        React.createElement(Text, { color: "cyan" }, j.id.slice(0, 4)),
        React.createElement(Text, { color: "gray" }, "] "),
        React.createElement(Text, { color: ttl && ttl < 5 ? "red" : "white" }, ttl ? `${ttl}s` : "--"),
        " ",
      );
    }),
    React.createElement(Box, { flexGrow: 1 }),
    React.createElement(
      Text,
      { color: "gray" },
      "SYNC: ",
      React.createElement(
        Text,
        { color: lastRefreshAt ? "white" : "gray" },
        lastRefreshAt ? lastRefreshAt.toLocaleTimeString() : "--:--:--",
      ),
    ),
  );
}
