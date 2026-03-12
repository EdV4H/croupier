import { useState, useRef, useEffect } from "react";
import type { CSSProperties } from "react";
import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
import type { EmojiClickData } from "emoji-picker-react";

interface EmotePickerProps {
  players: string[];
  currentPlayerId: string;
  onSend: (emoji: string, targetPlayerId: string) => void;
}

export function EmotePicker({ players, currentPlayerId, onSend }: EmotePickerProps) {
  const [open, setOpen] = useState(false);
  const [targetPlayer, setTargetPlayer] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const others = players.filter((p) => p !== currentPlayerId);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        setTargetPlayer(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    if (targetPlayer) {
      onSend(emojiData.emoji, targetPlayer);
      setOpen(false);
      setTargetPlayer(null);
    }
  };

  if (others.length === 0) return null;

  return (
    <div style={containerStyle} ref={panelRef}>
      <button style={triggerStyle} onClick={() => {
        setOpen(!open);
        setTargetPlayer(null);
      }}>
        React
      </button>

      {open && (
        <div style={panelStyle}>
          {/* Player selection */}
          <div style={playerListStyle}>
            <span style={labelStyle}>Send to:</span>
            {others.map((pid) => {
              const displayName = pid.startsWith("bot:") ? pid.slice(4) : pid;
              const isSelected = targetPlayer === pid;
              return (
                <button
                  key={pid}
                  style={{
                    ...playerBtnStyle,
                    background: isSelected ? "#3b82f6" : "#1e293b",
                    color: isSelected ? "#fff" : "#94a3b8",
                    borderColor: isSelected ? "#3b82f6" : "#334155",
                  }}
                  onClick={() => setTargetPlayer(pid)}
                >
                  {displayName}
                  {pid.startsWith("bot:") && <span style={botTagStyle}>Bot</span>}
                </button>
              );
            })}
          </div>

          {/* Emoji picker — only shown after selecting a player */}
          {targetPlayer && (
            <div style={pickerWrapperStyle}>
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                reactionsDefaultOpen={true}
                emojiStyle={EmojiStyle.NATIVE}
                theme={Theme.DARK}
                width="100%"
                height={60}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const containerStyle: CSSProperties = {
  position: "relative",
};

const triggerStyle: CSSProperties = {
  background: "none",
  border: "1px solid #334155",
  borderRadius: 6,
  color: "#94a3b8",
  padding: "0.4rem 0.8rem",
  cursor: "pointer",
  fontSize: "0.85rem",
};

const panelStyle: CSSProperties = {
  position: "absolute",
  top: "100%",
  right: 0,
  marginTop: 4,
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 10,
  padding: "0.6rem",
  zIndex: 50,
  minWidth: 260,
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
};

const playerListStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
  flexWrap: "wrap",
};

const labelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: "0.75rem",
  fontWeight: 600,
};

const playerBtnStyle: CSSProperties = {
  border: "1px solid #334155",
  borderRadius: 6,
  padding: "0.25rem 0.6rem",
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: 500,
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25rem",
};

const botTagStyle: CSSProperties = {
  color: "#f59e0b",
  fontSize: "0.6rem",
  fontWeight: 600,
  background: "#422006",
  padding: "0 0.2rem",
  borderRadius: 3,
};

const pickerWrapperStyle: CSSProperties = {
  borderTop: "1px solid #253545",
  paddingTop: "0.4rem",
};
