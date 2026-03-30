import React from "react";
import { Box, Text } from "ink";
import type { QueueStats } from "../../core/types.js";

interface StatsBarProps {
  stats: QueueStats;
}

export function StatsBar({ stats }: StatsBarProps) {
  return React.createElement(
    Box,
    { borderStyle: "round", borderColor: "gray", paddingX: 1 },
    React.createElement(Text, { dimColor: true }, "Waiting: "),
    React.createElement(Text, { color: "gray" }, String(stats.waiting)),
    React.createElement(Text, { dimColor: true }, "  Processing: "),
    React.createElement(Text, { color: "yellow" }, String(stats.processing)),
    React.createElement(Text, { dimColor: true }, "  Completed: "),
    React.createElement(Text, { color: "green" }, String(stats.completed)),
    React.createElement(Text, { dimColor: true }, "  Failed: "),
    React.createElement(Text, { color: "red" }, String(stats.failed)),
    stats.stalled > 0
      ? React.createElement(
          React.Fragment,
          null,
          React.createElement(Text, { dimColor: true }, "  Stalled: "),
          React.createElement(Text, { color: "yellow" }, String(stats.stalled)),
        )
      : null,
  );
}
