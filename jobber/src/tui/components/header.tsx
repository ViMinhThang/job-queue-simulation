import React from "react";
import { Box, Text } from "ink";

interface HeaderProps {
  workerRunning: boolean;
}

export function Header({ workerRunning }: HeaderProps) {
  return React.createElement(
    Box,
    { borderStyle: "round", borderColor: "cyan", paddingX: 1, justifyContent: "space-between" },
    React.createElement(Text, { bold: true, color: "cyan" }, "jobber"),
    workerRunning
      ? React.createElement(Text, { color: "green", bold: true }, "worker: ON")
      : React.createElement(Text, { color: "red", bold: true }, "worker: OFF"),
  );
}
