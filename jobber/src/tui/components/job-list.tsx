import React from "react";
import { Box, Text } from "ink";
import type { Job } from "../../core/types.js";

interface JobListProps {
  jobs: Job[];
  selected: number;
  interactionMode: "command" | "nav";
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

function JobItem({ job, isSelected, interactionMode }: { job: Job; isSelected: boolean, interactionMode: "command" | "nav" }) {
  const shortId = job.id.slice(0, 4);
  const color = isSelected && interactionMode === "nav" ? "white" : undefined;
  const bgColor = isSelected && interactionMode === "nav" ? "blue" : undefined;

  return React.createElement(
    Box,
    { key: job.id, paddingX: 1, backgroundColor: bgColor },
    React.createElement(Text, { dimColor: !isSelected || interactionMode !== "nav", color: isSelected && interactionMode === "nav" ? "cyan" : "gray" }, `[${shortId}] `),
    job.state === "processing" && React.createElement(Spinner),
    React.createElement(Text, { color, bold: isSelected && interactionMode === "nav", wrap: "truncate-end" }, ` ${job.name}`),
  );
}

function Column({ title, color, children, count }: { title: string; color: string; children?: React.ReactNode; count: number }) {
  return React.createElement(
    Box,
    { flexDirection: "column", flexGrow: 1, flexBasis: 0, minWidth: 20 },
    React.createElement(
      Box,
      { borderStyle: "single", borderColor: color, paddingX: 1, justifyContent: "space-between" },
      React.createElement(Text, { color, bold: true }, title),
      React.createElement(Text, { dimColor: true }, count.toString())
    ),
    React.createElement(Box, { flexDirection: "column", paddingTop: 1 }, children)
  );
}

export function JobList({ jobs, selected, interactionMode }: JobListProps) {
  if (jobs.length === 0) {
    return React.createElement(
      Box,
      { borderStyle: "round", borderColor: "gray", paddingX: 1, flexGrow: 1, justifyContent: "center", alignItems: "center" },
      React.createElement(Text, { dimColor: true }, "No jobs. Type a command to start!"),
    );
  }

  const waiting = jobs.filter(j => j.state === "waiting");
  const processing = jobs.filter(j => j.state === "processing");
  const completed = jobs.filter(j => j.state === "completed");
  const failed = jobs.filter(j => j.state === "failed");
  const stalled = jobs.filter(j => j.state === "stalled");

  const selectedJob = jobs[selected];

  const renderJob = (job: Job) => 
    React.createElement(JobItem, { 
      key: job.id, 
      job, 
      isSelected: selectedJob?.id === job.id,
      interactionMode
    });

  return React.createElement(
    Box,
    { borderStyle: "round", borderColor: "gray", paddingX: 1, flexDirection: "row", flexGrow: 1, gap: 1 },
    React.createElement(Column, { title: "Waiting", color: "gray", count: waiting.length }, waiting.map(renderJob)),
    React.createElement(Column, { title: "Running", color: "yellow", count: processing.length }, processing.map(renderJob)),
    React.createElement(Column, { title: "Completed", color: "green", count: completed.length }, completed.map(renderJob)),
    React.createElement(Column, { title: "Failed", color: "red", count: failed.length }, failed.map(renderJob)),
    React.createElement(Column, { title: "Stalled", color: "yellow", count: stalled.length }, stalled.map(renderJob)),
  );
}
