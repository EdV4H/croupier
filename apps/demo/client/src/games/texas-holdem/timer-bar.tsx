import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

interface TimerBarProps {
  turnDeadline?: number | null;
}

export function TimerBar({ turnDeadline }: TimerBarProps) {
  const [ratio, setRatio] = useState(1);

  useEffect(() => {
    if (!turnDeadline) return;

    const totalMs = turnDeadline - Date.now();
    if (totalMs <= 0) {
      setRatio(0);
      return;
    }

    const id = setInterval(() => {
      const remaining = turnDeadline - Date.now();
      setRatio(Math.max(0, remaining / totalMs));
    }, 50);

    return () => clearInterval(id);
  }, [turnDeadline]);

  if (!turnDeadline) return null;

  const color = ratio > 0.5 ? "#22c55e" : ratio > 0.2 ? "#eab308" : "#ef4444";

  return (
    <div style={containerStyle}>
      <div
        style={{
          ...barStyle,
          width: `${ratio * 100}%`,
          background: color,
        }}
      />
    </div>
  );
}

const containerStyle: CSSProperties = {
  width: "80%",
  height: 6,
  background: "#064e3b",
  borderRadius: 3,
  overflow: "hidden",
  margin: "0.4rem auto 0",
};

const barStyle: CSSProperties = {
  height: "100%",
  borderRadius: 3,
  transition: "background 0.3s",
};
