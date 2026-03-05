import { useState } from "react";
import type { CSSProperties } from "react";

interface FacilitatorControlsProps {
  phase: string;
  dispatch: (action: string, payload?: unknown) => void;
}

export function FacilitatorControls({ phase, dispatch }: FacilitatorControlsProps) {
  const [taskTitle, setTaskTitle] = useState("");
  const [estimate, setEstimate] = useState("");

  return (
    <div style={containerStyle}>
      <span style={labelStyle}>Facilitator Controls</span>

      {phase === "idle" && (
        <div style={rowStyle}>
          <input
            style={inputStyle}
            type="text"
            placeholder="Task title..."
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && taskTitle.trim()) {
                dispatch("selectTask", { id: `T${Date.now()}`, title: taskTitle.trim() });
                setTaskTitle("");
              }
            }}
          />
          <button
            style={{
              ...btnStyle,
              opacity: taskTitle.trim() ? 1 : 0.5,
            }}
            onClick={() => {
              if (taskTitle.trim()) {
                dispatch("selectTask", { id: `T${Date.now()}`, title: taskTitle.trim() });
                setTaskTitle("");
              }
            }}
          >
            Select Task
          </button>
        </div>
      )}

      {phase === "discussion" && (
        <button style={btnStyle} onClick={() => dispatch("startVoting")}>
          Start Voting
        </button>
      )}

      {phase === "voting" && (
        <button style={btnStyle} onClick={() => dispatch("reveal")}>
          Reveal Cards
        </button>
      )}

      {phase === "evaluation" && (
        <div style={rowStyle}>
          <input
            style={inputStyle}
            type="text"
            placeholder="Final estimate..."
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && estimate.trim()) {
                dispatch("recordEstimate", { estimate: estimate.trim() });
                setEstimate("");
              }
            }}
          />
          <button
            style={{
              ...btnStyle,
              opacity: estimate.trim() ? 1 : 0.5,
            }}
            onClick={() => {
              if (estimate.trim()) {
                dispatch("recordEstimate", { estimate: estimate.trim() });
                setEstimate("");
              }
            }}
          >
            Record Estimate
          </button>
          <button
            style={{ ...btnStyle, background: "#4a5568" }}
            onClick={() => dispatch("startVoting")}
          >
            Re-Vote
          </button>
        </div>
      )}

      {phase === "consensus" && (
        <button style={btnStyle} onClick={() => dispatch("resetForNextTask")}>
          Next Task
        </button>
      )}
    </div>
  );
}

const containerStyle: CSSProperties = {
  background: "#1a2332",
  borderRadius: 16,
  padding: 12,
  border: "1px solid #253545",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const labelStyle: CSSProperties = {
  color: "#7a8fa3",
  fontSize: "0.8rem",
  fontWeight: 600,
};

const rowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const btnStyle: CSSProperties = {
  background: "#2dd4bf",
  color: "#0f172a",
  border: "none",
  borderRadius: 20,
  padding: "0.5rem 1.2rem",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const inputStyle: CSSProperties = {
  background: "#0f172a",
  color: "#e2e8f0",
  border: "1px solid #253545",
  borderRadius: 8,
  padding: "0.5rem 0.8rem",
  fontSize: "0.85rem",
  outline: "none",
  flex: 1,
  minWidth: 120,
};
