import React from "react";
import { Box, Text } from "ink";
import type { Job } from "../../core/types.js";

interface JobListProps {
  jobs: Job[];
  selected: number;
}

const SPINNERS = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function Spinner() {
  const [frame, setFrame] = React.useState(0);
  React.useEffect(() => {
    const timer = setInterval(() => setFrame((f) => (f + 1) % SPINNERS.length), 80);
    return () => clearInterval(timer);
  }, []);
  return React.createElement(Text, { color: "yellow" }, SPINNERS[frame]);
}

const STATE_ICONS: Record<string, { icon: string; color: string }> = {
  waiting: { icon: "○", color: "gray" },
  completed: { icon: "✓", color: "green" },
  failed: { icon: "✗", color: "red" },
  stalled: { icon: "△", color: "yellow" },
};

const STATE_LABELS: Record<string, (job: Job) => { text: string; color: string }> = {
  processing: () => ({ text: "running", color: "yellow" }),
  completed: () => ({ text: "✓ done", color: "green" }),
  failed: (job) => ({ text: `✗ failed${job.exitCode !== null ? ` (${job.exitCode})` : ""}`, color: "red" }),
  stalled: () => ({ text: "△ stalled", color: "yellow" }),
};

function JobRow({ job, isSelected }: { job: Job; isSelected: boolean }) {
  const icon = STATE_ICONS[job.state];
  const label = STATE_LABELS[job.state]?.(job) ?? { text: "waiting", color: "gray" };

  return React.createElement(
    Box,
    { key: job.id },
    React.createElement(
      Text,
      { color: isSelected ? "cyan" : undefined, bold: isSelected },
      isSelected ? "▸ " : "  ",
    ),
    job.state === "processing"
      ? React.createElement(Spinner)
      : React.createElement(Text, { color: icon?.color }, icon?.icon ?? "?"),
    React.createElement(Text, null, " "),
    React.createElement(
      Text,
      { color: isSelected ? "white" : undefined, bold: isSelected, wrap: "truncate-end" },
      job.name,
    ),
    React.createElement(Text, { dimColor: true }, " "),
    React.createElement(Text, { color: label.color }, label.text),
  );
}

export function JobList({ jobs, selected }: JobListProps) {
  if (jobs.length === 0) {
    return React.createElement(
      Box,
      { borderStyle: "round", borderColor: "gray", paddingX: 1, flexGrow: 1 },
      React.createElement(Text, { dimColor: true }, "No jobs. Press [a] to add a command."),
    );
  }

  return React.createElement(
    Box,
    { borderStyle: "round", borderColor: "gray", paddingX: 1, flexDirection: "column", flexGrow: 1 },
    React.createElement(Text, { dimColor: true }, `Jobs (${jobs.length})`),
    ...jobs.map((job, i) =>
      React.createElement(JobRow, {
        key: job.id,
        job,
        isSelected: i === selected,
      }),
    ),
  );
}
