import { useRef, useEffect } from "react";
import type { CSSProperties } from "react";
import type { EmoteEvent } from "../hooks/use-game-state.js";

interface EmoteOverlayProps {
  emotes: EmoteEvent[];
}

export function EmoteOverlay({ emotes }: EmoteOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    for (const emote of emotes) {
      if (renderedRef.current.has(emote.id)) continue;
      renderedRef.current.add(emote.id);

      const toEl = document.querySelector(`[data-player-id="${CSS.escape(emote.targetPlayerId)}"]`);
      if (!toEl) continue;

      const containerRect = container.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      const toX = toRect.left + toRect.width / 2 - containerRect.left;
      const toY = toRect.top + toRect.height / 2 - containerRect.top;

      // Randomly enter from left or right edge
      const fromLeft = Math.random() < 0.5;
      const fromX = fromLeft ? -30 : containerRect.width + 30;
      const fromY = toY + (Math.random() - 0.5) * 80;

      const emojiEl = document.createElement("div");
      emojiEl.textContent = emote.emoji;
      emojiEl.style.cssText = `
        position: absolute;
        font-size: 2rem;
        pointer-events: none;
        z-index: 100;
        will-change: transform, opacity;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
      `;
      container.appendChild(emojiEl);

      // Quadratic Bézier: P0=start, P1=control (apex), P2=target
      const cpX = (fromX + toX) / 2;
      const cpY = Math.min(fromY, toY) - 120;

      const flyDuration = 1200;
      const bounceDuration = 800;
      const fadeDuration = 400;
      const totalDuration = flyDuration + bounceDuration + fadeDuration;
      const startTime = performance.now();

      // Damped bounce: recoil toward the side it came from
      const recoilDir = fromX < toX ? -1 : 1; // bounce back toward entry side
      const bounceOffset = (t: number): { dx: number; dy: number } => {
        const wave = Math.sin(t * Math.PI * 2) * Math.exp(-3 * t);
        return { dx: recoilDir * 60 * wave, dy: -20 * Math.abs(wave) };
      };

      const tick = (now: number) => {
        const elapsed = now - startTime;

        if (elapsed < flyDuration) {
          // Flying phase — quadratic Bézier
          const t = elapsed / flyDuration;
          const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
          const x = (1 - ease) ** 2 * fromX + 2 * (1 - ease) * ease * cpX + ease ** 2 * toX;
          const y = (1 - ease) ** 2 * fromY + 2 * (1 - ease) * ease * cpY + ease ** 2 * toY;
          emojiEl.style.left = `${x}px`;
          emojiEl.style.top = `${y}px`;
          emojiEl.style.opacity = `${0.8 + 0.2 * ease}`;
          emojiEl.style.transform = "translate(-50%, -50%)";
          requestAnimationFrame(tick);
        } else if (elapsed < flyDuration + bounceDuration) {
          // Bounce phase — damped bounces at target
          const bt = (elapsed - flyDuration) / bounceDuration;
          const { dx, dy } = bounceOffset(bt);
          emojiEl.style.left = `${toX + dx}px`;
          emojiEl.style.top = `${toY + dy}px`;
          emojiEl.style.opacity = "1";
          emojiEl.style.transform = "translate(-50%, -50%)";
          requestAnimationFrame(tick);
        } else if (elapsed < totalDuration) {
          // Fade out
          const ft = (elapsed - flyDuration - bounceDuration) / fadeDuration;
          emojiEl.style.left = `${toX}px`;
          emojiEl.style.top = `${toY}px`;
          emojiEl.style.opacity = `${1 - ft}`;
          emojiEl.style.transform = "translate(-50%, -50%)";
          requestAnimationFrame(tick);
        } else {
          emojiEl.remove();
          renderedRef.current.delete(emote.id);
        }
      };
      requestAnimationFrame(tick);
    }
  }, [emotes]);

  return <div ref={containerRef} style={overlayStyle} />;
}

const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  zIndex: 100,
  overflow: "hidden",
};
