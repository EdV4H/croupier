import type { CSSProperties } from "react";

interface CountdownOverlayProps {
  value: number;
}

export function CountdownOverlay({ value }: CountdownOverlayProps) {
  return (
    <>
      <style>{`
        @keyframes countdown-pop-in {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
          50% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
          70% { transform: translate(-50%, -50%) scale(0.95); }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
      `}</style>
      <div style={overlayStyle}>
        <span key={value} style={numberStyle}>
          {value}
        </span>
      </div>
    </>
  );
}

const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: 24,
  background: "rgba(15,23,42,0.85)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 10,
};

const numberStyle: CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  fontSize: "7rem",
  fontWeight: 900,
  color: "#2dd4bf",
  textShadow: "0 0 40px rgba(45,212,191,0.6), 0 0 80px rgba(45,212,191,0.3)",
  animation: "countdown-pop-in 0.5s ease-out forwards",
  transform: "translate(-50%, -50%)",
};
