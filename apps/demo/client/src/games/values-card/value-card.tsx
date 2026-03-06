import type { CSSProperties } from "react";

interface ValueCardProps {
  name: string;
  size?: "normal" | "small";
  variant?: "hand" | "discard" | "selectable";
  selected?: boolean;
  onClick?: () => void;
}

export function ValueCard({
  name,
  size = "normal",
  variant = "hand",
  selected = false,
  onClick,
}: ValueCardProps) {
  const isSmall = size === "small" || variant === "discard";
  const isSelectable = variant === "selectable";

  const style: CSSProperties = {
    width: isSmall ? 64 : 72,
    height: isSmall ? 40 : 48,
    background: variant === "discard" ? "#152029" : "#1e2d3d",
    border: `1.5px solid ${
      selected
        ? "#2dd4bf"
        : isSelectable
          ? "#253545"
          : variant === "discard"
            ? "#1e2d3d"
            : "#253545"
    }`,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 4px",
    cursor: onClick ? "pointer" : "default",
    transition: "border-color 0.15s, transform 0.15s, box-shadow 0.15s",
    transform: selected ? "scale(1.03)" : undefined,
    boxShadow: selected
      ? "0 0 8px rgba(45,212,191,0.3)"
      : "0 2px 6px rgba(0,0,0,0.3)",
    flexShrink: 0,
  };

  const textStyle: CSSProperties = {
    color: "#e2e8f0",
    fontSize: isSmall ? "0.65rem" : "0.75rem",
    fontWeight: 600,
    textAlign: "center",
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    wordBreak: "break-all",
  };

  return (
    <div
      style={style}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (isSelectable && !selected) {
          e.currentTarget.style.borderColor = "#2dd4bf";
        }
      }}
      onMouseLeave={(e) => {
        if (isSelectable && !selected) {
          e.currentTarget.style.borderColor = "#253545";
        }
      }}
    >
      <span style={textStyle}>{name}</span>
    </div>
  );
}
