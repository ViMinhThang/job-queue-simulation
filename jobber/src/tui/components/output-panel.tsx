import React from "react";
import { Box, Text } from "ink";
import type { Job } from "../../core/types.js";

interface OutputPanelProps {
  job: Job | null;
  output: { stdout: string[]; stderr: string[] };
}

export function OutputPanel({ job, output }: OutputPanelProps) {
  if (!job) {
    return React.createElement(
      Box,
      { borderStyle: "round", borderColor: "gray", paddingX: 1, flexDirection: "column", height: 6 },
      React.createElement(Text, { dimColor: true }, "Select a job to view output"),
    );
  }

  const allLines: Array<{ text: string; type: "stdout" | "stderr" }> = [
    ...output.stdout.map((text) => ({ text, type: "stdout" as const })),
    ...output.stderr.map((text) => ({ text, type: "stderr" as const })),
  ];

  // Show last lines that fit
  const maxLines = 4;
  const visibleLines = allLines.slice(-maxLines);

  return React.createElement(
    Box,
    { borderStyle: "round", borderColor: "gray", paddingX: 1, flexDirection: "column", height: 6 },
    React.createElement(
      Text,
      { bold: true },
      "Output: ",
      React.createElement(Text, { color: "cyan" }, job.name),
      job.exitCode !== null
        ? React.createElement(
            Text,
            { dimColor: true },
            ` (exit ${job.exitCode})`,
          )
        : null,
    ),
    visibleLines.length === 0
      ? React.createElement(Text, { dimColor: true }, job.state === "waiting" ? "  (waiting to start)" : "  (no output yet)")
      : visibleLines.map((line, i) =>
          React.createElement(
            Text,
            { key: i, color: line.type === "stderr" ? "red" : undefined },
            line.type === "stderr" ? "E " : "> ",
            line.text,
          ),
        ),
  );
}
