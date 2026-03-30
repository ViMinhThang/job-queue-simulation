import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface CommandBarProps {
  commandInput: string;
  setCommandInput: (val: string) => void;
  onSubmit: (val: string) => void;
  suggestions: string[];
  interactionMode: "command" | "nav";
}

export function CommandBar({ 
  commandInput, 
  setCommandInput, 
  onSubmit, 
  suggestions,
  interactionMode
}: CommandBarProps) {
  const isFocused = interactionMode === "command";
  const borderColor = isFocused ? "green" : "gray";

  return React.createElement(
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
      { borderStyle: "round", borderColor, paddingX: 1 },
      React.createElement(Text, { color: isFocused ? "green" : "gray", bold: isFocused }, "> "),
      React.createElement(TextInput, {
        value: commandInput,
        onChange: isFocused ? setCommandInput : () => {},
        onSubmit: isFocused ? onSubmit : () => {},
        placeholder: isFocused ? "Type a command or / for help..." : "[Esc] to type commands...",
      }),
    )
  );
}
