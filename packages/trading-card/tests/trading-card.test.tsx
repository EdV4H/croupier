import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TradingCard, useTradingCardContext } from "../src";
import { BURST_MS } from "../src/reveal/trading-card.reveal";

/** Minimal composition, mirroring how a consumer would assemble the card. */
const Card = (
  props: React.ComponentProps<typeof TradingCard.Root> & {
    backLinkLabel?: string;
  },
) => {
  const { backLinkLabel = "Certificate", ...rootProps } = props;
  return (
    <TradingCard.Root {...rootProps}>
      <TradingCard.Front data-testid="front">
        <TradingCard.Content>
          <TradingCard.Label>Polished</TradingCard.Label>
          <button type="button">Front action</button>
        </TradingCard.Content>
        <TradingCard.Layer data-testid="layer" />
      </TradingCard.Front>
      <TradingCard.Back data-testid="back">
        <TradingCard.Content>
          <a href="/cert">{backLinkLabel}</a>
        </TradingCard.Content>
      </TradingCard.Back>
      <TradingCard.FlipTrigger>Flip card</TradingCard.FlipTrigger>
    </TradingCard.Root>
  );
};

describe("TradingCard flipping", () => {
  it("exposes the flip control as a real button with a pressed state", () => {
    render(<Card />);
    const trigger = screen.getByRole("button", { name: "Flip card" });
    expect(trigger).toHaveAttribute("type", "button");
    expect(trigger).toHaveAttribute("aria-pressed", "false");
  });

  it("flips with the keyboard alone", async () => {
    const user = userEvent.setup();
    render(<Card />);
    const trigger = screen.getByRole("button", { name: "Flip card" });

    await user.tab();
    // The card body is not focusable, so the first stop is the front's own
    // content; keep tabbing until the trigger has focus.
    while (document.activeElement !== trigger) {
      await user.tab();
    }

    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-pressed", "true");

    await user.keyboard(" ");
    expect(trigger).toHaveAttribute("aria-pressed", "false");
  });

  it("honours defaultFlipped", () => {
    render(<Card defaultFlipped />);
    expect(screen.getByRole("button", { name: "Flip card" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("does not flip when flipping is disabled", async () => {
    const user = userEvent.setup();
    render(<Card flippable={false} />);
    const trigger = screen.getByRole("button", { name: "Flip card" });
    expect(trigger).toBeDisabled();
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-pressed", "false");
  });

  it("reports the requested face without self-updating when controlled", async () => {
    const user = userEvent.setup();
    const onFlipChange = vi.fn();
    render(<Card flipped={false} onFlipChange={onFlipChange} />);

    await user.click(screen.getByRole("button", { name: "Flip card" }));

    expect(onFlipChange).toHaveBeenCalledWith({ flipped: true });
    // Controlled: the consumer owns the value, so nothing moved on its own.
    expect(screen.getByRole("button", { name: "Flip card" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("follows the controlled value when the consumer updates it", async () => {
    const user = userEvent.setup();
    const Controlled = () => {
      const [flipped, setFlipped] = useState(false);
      return (
        <Card flipped={flipped} onFlipChange={(d) => setFlipped(d.flipped)} />
      );
    };
    render(<Controlled />);
    const trigger = screen.getByRole("button", { name: "Flip card" });

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-pressed", "true");
  });
});

describe("TradingCard pointer flip", () => {
  /**
   * A press on the card body flips it. The trigger and any other control the
   * consumer puts on the card must be exempt — otherwise the trigger's own
   * `onClick` and the card's click-to-flip both fire and cancel out, and the
   * card looks broken to a mouse user while working fine from the keyboard.
   */
  const press = (el: Element) => {
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 10, clientY: 10 });
  };

  /** The machine dispatches on a microtask, so every assertion has to settle. */
  const settle = () => waitFor(() => Promise.resolve());

  it("flips when the card body is pressed", async () => {
    render(<Card />);
    press(screen.getByTestId("front"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Flip card" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
  });

  it("does not double-toggle when the press lands on the flip trigger", async () => {
    const onFlipChange = vi.fn();
    render(<Card onFlipChange={onFlipChange} />);
    const trigger = screen.getByRole("button", { name: "Flip card" });

    // A real browser fires both: the press reaches the card, and the button
    // fires its own click. If the card flipped too, the two would cancel out.
    press(trigger);
    fireEvent.click(trigger);

    await waitFor(() =>
      expect(trigger).toHaveAttribute("aria-pressed", "true"),
    );
    expect(onFlipChange).toHaveBeenCalledTimes(1);
  });

  it("leaves the card alone when a control on the card is pressed", async () => {
    const onFlipChange = vi.fn();
    render(<Card onFlipChange={onFlipChange} />);

    press(screen.getByRole("button", { name: "Front action" }));
    await settle();

    expect(onFlipChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Flip card" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("straightens the card when the pointer leaves mid-drag", async () => {
    // A leave can arrive without a pointer up: capture may never have been
    // granted, or the OS may have taken the pointer away. Without settling
    // here the card is left tilted with nothing coming to straighten it.
    const { container } = render(<Card />);
    const root = container.querySelector<HTMLElement>("[data-part='root']");
    const front = screen.getByTestId("front");

    fireEvent.pointerDown(front, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(front, { pointerId: 1, clientX: 200, clientY: 10 });
    // The write lands in a rAF callback, so the rotation is not on the element
    // the instant the move is dispatched.
    await waitFor(() =>
      expect(
        Number(root?.style.getPropertyValue("--tc-dry").replace("deg", "")),
      ).toBeGreaterThan(0),
    );

    fireEvent.pointerLeave(front, { pointerId: 1 });
    await waitFor(() => Promise.resolve());

    expect(root?.style.getPropertyValue("--tc-drx")).toBe("0deg");
    // Settled on a whole turn, so a face is square-on rather than edge-on.
    const dry = Number(
      root?.style.getPropertyValue("--tc-dry").replace("deg", ""),
    );
    expect(Math.abs(dry % 360)).toBe(0);
  });

  it("treats a real drag as a drag, not a click", async () => {
    const onFlipChange = vi.fn();
    render(<Card onFlipChange={onFlipChange} />);
    const front = screen.getByTestId("front");

    fireEvent.pointerDown(front, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(front, { pointerId: 1, clientX: 90, clientY: 10 });
    fireEvent.pointerUp(front, { pointerId: 1, clientX: 90, clientY: 10 });
    await settle();

    expect(onFlipChange).not.toHaveBeenCalled();
  });

  it("keeps the press alive when the pointer strays off the card and back", async () => {
    // A press that jitters across the edge is still one press. Ending it on
    // `pointerleave` killed the click on the way back — and a leave mid-gesture
    // only happens when pointer capture was refused, which is exactly the
    // environment that cannot afford to lose clicks.
    const onFlipChange = vi.fn();
    const { container } = render(<Card onFlipChange={onFlipChange} />);
    const root = container.querySelector<HTMLElement>("[data-part='root']");
    const front = screen.getByTestId("front");
    if (!root) throw new Error("no root");

    fireEvent.pointerDown(front, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerLeave(root, { pointerId: 1 });
    fireEvent.pointerEnter(root, { pointerId: 1 });
    fireEvent.pointerUp(front, { pointerId: 1, clientX: 11, clientY: 11 });

    await waitFor(() =>
      expect(onFlipChange).toHaveBeenCalledWith({ flipped: true }),
    );
  });

  it("ignores a release from a pointer that never pressed the card", async () => {
    const onFlipChange = vi.fn();
    render(<Card onFlipChange={onFlipChange} />);
    const front = screen.getByTestId("front");

    fireEvent.pointerDown(front, { pointerId: 1, clientX: 10, clientY: 10 });
    // A second pointer releases over the card — a different gesture entirely.
    fireEvent.pointerUp(front, { pointerId: 2, clientX: 10, clientY: 10 });
    await settle();

    expect(onFlipChange).not.toHaveBeenCalled();
  });
});

describe("TradingCard environment changes", () => {
  /**
   * jsdom has no `matchMedia`, so the card treats a missing one as
   * "hover-capable, motion allowed". This stub adds one that can change its
   * answer afterwards, which is the case the card has to survive: the enter
   * handler already wrote the hover scale, and the move handler stands down
   * under reduced motion so it can never write the neutral value back.
   */
  const HOVER = "(hover: hover) and (pointer: fine)";
  const REDUCED = "(prefers-reduced-motion: reduce)";

  const stubMatchMedia = () => {
    const listeners = new Map<string, Set<() => void>>();
    // Start from what the card assumes when there is no `matchMedia` at all,
    // so the stub only changes when the test says so.
    const state = new Map<string, boolean>([
      [HOVER, true],
      [REDUCED, false],
    ]);
    const original = (window as { matchMedia?: unknown }).matchMedia;

    (window as unknown as { matchMedia: unknown }).matchMedia = (
      query: string,
    ) => ({
      get matches() {
        return state.get(query) ?? false;
      },
      media: query,
      addEventListener: (_: string, fn: () => void) => {
        if (!listeners.has(query)) listeners.set(query, new Set());
        listeners.get(query)?.add(fn);
      },
      removeEventListener: (_: string, fn: () => void) => {
        listeners.get(query)?.delete(fn);
      },
    });

    return {
      set(query: string, matches: boolean) {
        state.set(query, matches);
        for (const fn of listeners.get(query) ?? []) fn();
      },
      restore() {
        (window as unknown as { matchMedia: unknown }).matchMedia = original;
      },
    };
  };

  it("puts the card back to neutral when reduced motion arrives mid-hover", async () => {
    const mq = stubMatchMedia();
    try {
      const { container } = render(<Card />);
      const root = container.querySelector<HTMLElement>("[data-part='root']");
      const front = screen.getByTestId("front");
      if (!root) throw new Error("no root");

      fireEvent.pointerEnter(front, { pointerId: 1 });
      await waitFor(() =>
        expect(root.style.getPropertyValue("--tc-sc")).not.toBe(""),
      );
      expect(Number(root.style.getPropertyValue("--tc-sc"))).toBeGreaterThan(1);

      await act(async () => {
        mq.set(REDUCED, true);
      });

      // Enlarged for as long as the pointer stayed, before this was fixed.
      expect(root.style.getPropertyValue("--tc-sc")).toBe("1");
      expect(root.style.getPropertyValue("--tc-rx")).toBe("0deg");
    } finally {
      mq.restore();
    }
  });
});

describe("TradingCard setFlipped", () => {
  const Probe = ({ value }: { value: boolean | undefined }) => {
    const { setFlipped } = useTradingCardContext();
    return (
      <button type="button" onClick={() => setFlipped(value as boolean)}>
        Set
      </button>
    );
  };

  const ProbeCard = ({
    value,
    onFlipChange,
  }: {
    value: boolean | undefined;
    onFlipChange: () => void;
  }) => (
    <TradingCard.Root onFlipChange={onFlipChange}>
      <TradingCard.Front>
        <TradingCard.Content>
          <Probe value={value} />
        </TradingCard.Content>
      </TradingCard.Front>
      <TradingCard.Back>back</TradingCard.Back>
    </TradingCard.Root>
  );

  it("reports the face it moved to, not the one it left", async () => {
    // Setting context and reading it back in a following action reported the
    // *previous* face: a card turning to its back told the consumer
    // `{ flipped: false }`. Uncontrolled consumers driving anything off this
    // callback were driving it off a value one flip behind.
    const user = userEvent.setup();
    const onFlipChange = vi.fn();
    render(<ProbeCard value={true} onFlipChange={onFlipChange} />);

    await user.click(screen.getByRole("button", { name: "Set" }));

    await waitFor(() =>
      expect(onFlipChange).toHaveBeenCalledWith({ flipped: true }),
    );
  });

  it("ignores a request that names no face", async () => {
    // `Boolean(undefined)` used to read as "show the front", flipping the card
    // and reporting a change nobody asked for.
    const user = userEvent.setup();
    const onFlipChange = vi.fn();
    render(<ProbeCard value={undefined} onFlipChange={onFlipChange} />);

    await user.click(screen.getByRole("button", { name: "Set" }));
    await waitFor(() => Promise.resolve());

    expect(onFlipChange).not.toHaveBeenCalled();
  });
});

describe('TradingCard flipTrigger="card"', () => {
  /**
   * With no separate button, the card itself is the control. This is the mode
   * to reach for when the card's content is inert: nothing appears out of
   * nowhere on focus, and there is no second control to explain.
   */
  const CardAsButton = (
    props: React.ComponentProps<typeof TradingCard.Root>,
  ) => (
    <TradingCard.Root flipTrigger="card" aria-label="Values card" {...props}>
      <TradingCard.Front data-testid="front">
        <TradingCard.Content>front</TradingCard.Content>
      </TradingCard.Front>
      <TradingCard.Back data-testid="back">
        <TradingCard.Content>back</TradingCard.Content>
      </TradingCard.Back>
    </TradingCard.Root>
  );

  it("exposes the card as a pressable control", () => {
    render(<CardAsButton />);
    const card = screen.getByRole("button", { name: "Values card" });
    expect(card).toHaveAttribute("aria-pressed", "false");
    expect(card).toHaveAttribute("tabindex", "0");
  });

  it("flips on Enter and on Space", async () => {
    const user = userEvent.setup();
    render(<CardAsButton />);
    const card = screen.getByRole("button", { name: "Values card" });

    await user.tab();
    expect(card).toHaveFocus();

    await user.keyboard("{Enter}");
    await waitFor(() => expect(card).toHaveAttribute("aria-pressed", "true"));

    await user.keyboard(" ");
    await waitFor(() => expect(card).toHaveAttribute("aria-pressed", "false"));
  });

  it("still flips on a plain click", async () => {
    // The card carries `role="button"` in this mode, which the "did the press
    // land on a control?" selector also matches. Left unguarded, the card
    // decides every press landed on a control and suppresses its own flip —
    // keyboard works, mouse silently does nothing.
    const onFlipChange = vi.fn();
    render(<CardAsButton onFlipChange={onFlipChange} />);
    const card = screen.getByRole("button", { name: "Values card" });

    fireEvent.pointerDown(card, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 10, clientY: 10 });

    await waitFor(() => expect(card).toHaveAttribute("aria-pressed", "true"));
    expect(onFlipChange).toHaveBeenCalledTimes(1);
  });

  it("acts on Space release, not on the way down", async () => {
    // Native buttons activate Space on key up. Firing on key down instead both
    // diverges from every other button on the page and turns a held key into a
    // stream of flips, since key repeat keeps sending key down.
    render(<CardAsButton />);
    const card = screen.getByRole("button", { name: "Values card" });
    card.focus();

    fireEvent.keyDown(card, { key: " " });
    await waitFor(() => Promise.resolve());
    expect(card).toHaveAttribute("aria-pressed", "false");

    fireEvent.keyUp(card, { key: " " });
    await waitFor(() => expect(card).toHaveAttribute("aria-pressed", "true"));
  });

  it("does not repeat while Space is held", async () => {
    const onFlipChange = vi.fn();
    render(<CardAsButton onFlipChange={onFlipChange} />);
    const card = screen.getByRole("button", { name: "Values card" });
    card.focus();

    // Key repeat: several key down events, one release.
    fireEvent.keyDown(card, { key: " " });
    fireEvent.keyDown(card, { key: " ", repeat: true });
    fireEvent.keyDown(card, { key: " ", repeat: true });
    fireEvent.keyUp(card, { key: " " });

    await waitFor(() => expect(onFlipChange).toHaveBeenCalledTimes(1));
  });

  it("forgets a Space press the card lost focus during", async () => {
    const onFlipChange = vi.fn();
    render(<CardAsButton onFlipChange={onFlipChange} />);
    const card = screen.getByRole("button", { name: "Values card" });
    card.focus();

    fireEvent.keyDown(card, { key: " " });
    fireEvent.blur(card);
    fireEvent.keyUp(card, { key: " " });
    await waitFor(() => Promise.resolve());

    expect(onFlipChange).not.toHaveBeenCalled();
  });

  it("stays a plain container in the default mode", () => {
    render(<CardAsButton flipTrigger="trigger" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("is not offered as a control when flipping is off", () => {
    render(<CardAsButton flippable={false} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("TradingCard reveal", () => {
  /**
   * jsdom implements neither Web Animations nor layout, so two things are stood
   * in for here:
   *
   * - `Element.animate`, recorded rather than run, which is enough to pin what
   *   matters: whether an entrance fires, and on which element.
   * - `getBoundingClientRect`, which jsdom answers with zeroes for everything.
   *   The card reads it to decide whether it is already on screen, and a zero
   *   rect would send every test down the scroll-into-view path instead.
   */
  const calls: { el: Element; keyframes: unknown; options: unknown }[] = [];
  let restore: (() => void)[] = [];

  beforeEach(() => {
    calls.length = 0;
    const proto = Element.prototype as unknown as Record<string, unknown>;
    const originalAnimate = proto.animate;
    const originalRect = proto.getBoundingClientRect;

    proto.animate = function (
      this: Element,
      keyframes: unknown,
      options: unknown,
    ) {
      calls.push({ el: this, keyframes, options });
      return { cancel: vi.fn(), onfinish: null, oncancel: null };
    };
    proto.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 200,
      bottom: 300,
      width: 200,
      height: 300,
      toJSON: () => ({}),
    });

    restore = [
      () => {
        proto.animate = originalAnimate;
        proto.getBoundingClientRect = originalRect;
      },
    ];
  });

  afterEach(() => {
    for (const undo of restore) undo();
    restore = [];
  });

  const RevealCard = (props: React.ComponentProps<typeof TradingCard.Root>) => (
    <TradingCard.Root data-testid="root" {...props}>
      <TradingCard.Front>
        <TradingCard.Content>front</TradingCard.Content>
        <TradingCard.Layer data-testid="layer" />
      </TradingCard.Front>
      <TradingCard.Back>back</TradingCard.Back>
    </TradingCard.Root>
  );

  it("plays straight away when the card is already on screen", async () => {
    // The dialog case: waiting would show the card fully drawn and then snap it
    // away to begin, which reads as a glitch rather than an arrival.
    render(<RevealCard reveal={{ mode: "drop", auto: true }} />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));

    const inner = document.querySelector("[data-part='inner']");
    expect(calls[0]?.el).toBe(inner);
  });

  it("enters face-down when the card is face-down", async () => {
    // The entrance replaces the whole transform while it runs. Played
    // face-up, it showed the front of a card that is meant to stay hidden.
    render(<RevealCard defaultFlipped reveal={{ mode: "drop", auto: true }} />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    const frames = calls[0]?.keyframes as Keyframe[];
    expect(frames.at(-1)?.transform).toContain("rotateY(180deg)");
  });

  it("never holds the final frame, so hover keeps working afterwards", async () => {
    render(<RevealCard reveal={{ mode: "burst", auto: true }} />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect((calls[0]?.options as KeyframeAnimationOptions).fill).toBe("none");
  });

  it("stays still when no entrance is configured", async () => {
    render(<RevealCard />);
    await waitFor(() => Promise.resolve());
    expect(calls).toHaveLength(0);
  });

  it("does not auto-play unless asked", async () => {
    render(<RevealCard reveal={{ mode: "drop" }} />);
    await waitFor(() => Promise.resolve());
    expect(calls).toHaveLength(0);
  });

  /**
   * `auto` defaults to false, so without a way to ask for the entrance by hand
   * that default would mean "an entrance that can never run". The context is
   * the way in.
   */
  const Replay = () => {
    const { playReveal } = useTradingCardContext();
    return (
      <button type="button" onClick={playReveal}>
        Replay
      </button>
    );
  };

  const OnDemandCard = (
    props: React.ComponentProps<typeof TradingCard.Root>,
  ) => (
    <TradingCard.Root data-testid="root" {...props}>
      <TradingCard.Front>
        <TradingCard.Content>
          <Replay />
        </TradingCard.Content>
      </TradingCard.Front>
      <TradingCard.Back>back</TradingCard.Back>
    </TradingCard.Root>
  );

  it("plays on demand for a card that never auto-plays", async () => {
    const user = userEvent.setup();
    render(<OnDemandCard reveal={{ mode: "drop" }} />);
    expect(calls).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Replay" }));

    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(calls[0]?.el).toBe(document.querySelector("[data-part='inner']"));
  });

  it("ignores a second request while an entrance is still running", async () => {
    const user = userEvent.setup();
    render(<OnDemandCard reveal={{ mode: "drop" }} />);
    const replay = screen.getByRole("button", { name: "Replay" });

    await user.click(replay);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    const first = calls.length;

    await user.click(replay);
    await waitFor(() => Promise.resolve());
    expect(calls).toHaveLength(first);
  });

  it("stays still on demand too when there is no entrance configured", async () => {
    const user = userEvent.setup();
    render(<OnDemandCard />);
    await user.click(screen.getByRole("button", { name: "Replay" }));
    await waitFor(() => Promise.resolve());
    expect(calls).toHaveLength(0);
  });

  const StageCard = (props: React.ComponentProps<typeof TradingCard.Root>) => (
    <TradingCard.Root data-testid="root" {...props}>
      <TradingCard.RevealStage data-testid="stage" />
      <TradingCard.Front>
        <TradingCard.Content>front</TradingCard.Content>
        <TradingCard.Beam data-testid="beam" />
      </TradingCard.Front>
      <TradingCard.Back>back</TradingCard.Back>
    </TradingCard.Root>
  );

  it("renders no particles until an entrance runs", () => {
    render(<StageCard />);
    expect(screen.getByTestId("stage").childElementCount).toBe(0);
  });

  it("fires the burst onto the stage partway through the entrance", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(
        <StageCard reveal={{ mode: "burst", intensity: 1, auto: true }} />,
      );
      const stage = screen.getByTestId("stage");
      await waitFor(() => expect(calls.length).toBeGreaterThan(0));

      // The light is deliberately late: it lands with the card, not before it.
      expect(stage.childElementCount).toBe(0);
      await act(async () => {
        vi.advanceTimersByTime(BURST_MS);
      });
      expect(stage.childElementCount).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves no particles behind when the card goes away mid-entrance", async () => {
    // StrictMode's double effect and a card unmounted mid-burst are the same
    // failure: nodes stranded on a detached tree with animations still running.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { unmount } = render(
        <StageCard reveal={{ mode: "burst", intensity: 1, auto: true }} />,
      );
      const stage = screen.getByTestId("stage");
      await waitFor(() => expect(calls.length).toBeGreaterThan(0));
      await act(async () => {
        vi.advanceTimersByTime(BURST_MS);
      });
      expect(stage.childElementCount).toBeGreaterThan(0);

      unmount();

      expect(stage.childElementCount).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips the burst entirely when there is no stage to put it on", async () => {
    // Opting out of the fireworks has to mean no nodes, not hidden ones.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<RevealCard reveal={{ mode: "burst", auto: true }} />);
      await waitFor(() => expect(calls.length).toBeGreaterThan(0));
      const before = document.querySelectorAll("*").length;
      await act(async () => {
        vi.advanceTimersByTime(BURST_MS);
      });
      expect(document.querySelectorAll("*")).toHaveLength(before);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sweeps the beam only on a scan entrance", async () => {
    render(<StageCard reveal={{ mode: "scan", auto: true }} />);
    const beam = screen.getByTestId("beam");
    await waitFor(() =>
      expect(calls.some((call) => call.el === beam)).toBe(true),
    );
  });

  it("leaves the beam alone on the other entrances", async () => {
    render(<StageCard reveal={{ mode: "drop", auto: true }} />);
    const beam = screen.getByTestId("beam");
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(calls.some((call) => call.el === beam)).toBe(false);
  });
});

describe("TradingCard drag affordance", () => {
  /**
   * The grab cursor and `touch-action: none` are only honest while the card can
   * actually be dragged. With rotation off, a card that still looks grabbable
   * lies about what it does, and `touch-action: none` suppresses page scrolling
   * for a gesture that will be ignored. The recipe keys off this attribute, so
   * it has to be there.
   *
   * The attribute reports the same three conditions `onPointerDown` uses, not
   * just the prop — an attribute named "drag disabled" that goes missing on a
   * card which will not drag is worse than no attribute at all.
   */
  const root = (container: HTMLElement) =>
    container.querySelector("[data-part='root']");

  /**
   * jsdom has no `matchMedia` at all, which is why the component treats a
   * missing one as "hover-capable, motion allowed". Standing one in is the only
   * way to reach the other two branches.
   */
  const stubMatchMedia = (matches: (query: string) => boolean) => {
    const original = (window as { matchMedia?: unknown }).matchMedia;
    (window as unknown as { matchMedia: unknown }).matchMedia = (
      query: string,
    ) => ({
      matches: matches(query),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    return () => {
      (window as unknown as { matchMedia: unknown }).matchMedia = original;
    };
  };

  it("marks itself as undraggable when rotation is off", () => {
    const { container } = render(<Card dragRotate={false} />);
    expect(root(container)).toHaveAttribute("data-drag-disabled");
  });

  it("marks itself as undraggable under reduced motion", () => {
    const restore = stubMatchMedia((q) => q.includes("prefers-reduced-motion"));
    try {
      const { container } = render(<Card />);
      expect(root(container)).toHaveAttribute("data-drag-disabled");
    } finally {
      restore();
    }
  });

  it("marks itself as undraggable on a device with no real pointer", () => {
    // `(hover: hover) and (pointer: fine)` misses, everything else too.
    const restore = stubMatchMedia(() => false);
    try {
      const { container } = render(<Card />);
      expect(root(container)).toHaveAttribute("data-drag-disabled");
    } finally {
      restore();
    }
  });

  it("says nothing while rotation is available", () => {
    const { container } = render(<Card />);
    expect(root(container)).not.toHaveAttribute("data-drag-disabled");
  });
});

describe("TradingCard initial face", () => {
  it("is face-down in its very first frame when mounted flipped", () => {
    // Server markup is the one place nothing has run yet. The face used to be
    // written from an effect, so a card mounted with `flipped` was drawn
    // front-up for a frame and then turned over to its back.
    const html = renderToString(<Card flipped />);
    expect(html).toContain("--tc-flip:180deg");
    expect(renderToString(<Card defaultFlipped />)).toContain(
      "--tc-flip:180deg",
    );
    expect(renderToString(<Card />)).toContain("--tc-flip:0deg");
  });

  it("follows the face from render to render", async () => {
    const user = userEvent.setup();
    const { container } = render(<Card />);
    const root = container.querySelector<HTMLElement>("[data-part='root']");
    expect(root?.style.getPropertyValue("--tc-flip")).toBe("0deg");
    await user.click(screen.getByRole("button", { name: "Flip card" }));
    expect(root?.style.getPropertyValue("--tc-flip")).toBe("180deg");
  });

  it("keeps the consumer's own style alongside it", () => {
    const { container } = render(<Card style={{ width: "120px" }} />);
    const root = container.querySelector<HTMLElement>("[data-part='root']");
    expect(root?.style.width).toBe("120px");
    expect(root?.style.getPropertyValue("--tc-flip")).toBe("0deg");
  });
});

describe("TradingCard face isolation", () => {
  it("hides the reverse from assistive tech and the tab order while front-up", () => {
    render(<Card />);
    const back = screen.getByTestId("back");
    // `aria-hidden` alone would leave the link tabbable — backface-visibility
    // is a purely visual hide, so `inert` has to come with it.
    expect(back).toHaveAttribute("aria-hidden", "true");
    expect(back).toHaveAttribute("inert");
    expect(screen.getByTestId("front")).not.toHaveAttribute("aria-hidden");
  });

  it("swaps which face is hidden when flipped", async () => {
    const user = userEvent.setup();
    render(<Card />);
    await user.click(screen.getByRole("button", { name: "Flip card" }));

    expect(screen.getByTestId("front")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("front")).toHaveAttribute("inert");
    expect(screen.getByTestId("back")).not.toHaveAttribute("aria-hidden");
  });

  it("keeps exactly one face reachable at a time", async () => {
    const user = userEvent.setup();
    render(<Card />);

    expect(screen.getByRole("button", { name: "Front action" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Certificate" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Flip card" }));

    expect(screen.getByRole("link", { name: "Certificate" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Front action" })).toBeNull();
  });
});

describe("TradingCard finish", () => {
  it("writes consumer variables onto the root without interpreting them", () => {
    const { container } = render(
      <Card
        data-testid="root"
        finish={{
          vars: { "--tc-l-gloss": "1", "tc-accent": "oklch(0.8 0.1 200)" },
        }}
      />,
    );
    const root = container.querySelector<HTMLElement>("[data-part='root']");
    expect(root?.style.getPropertyValue("--tc-l-gloss")).toBe("1");
    // Missing dashes are added; the value itself is untouched.
    expect(root?.style.getPropertyValue("--tc-accent")).toBe(
      "oklch(0.8 0.1 200)",
    );
  });

  it("drops variables a previous finish set once they are gone", async () => {
    const user = userEvent.setup();
    const Switcher = () => {
      const [lit, setLit] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setLit(false)}>
            dim
          </button>
          <Card
            finish={lit ? { vars: { "--tc-l-gloss": "1" } } : { vars: {} }}
          />
        </>
      );
    };
    const { container } = render(<Switcher />);
    const root = () =>
      container.querySelector<HTMLElement>("[data-part='root']");
    expect(root()?.style.getPropertyValue("--tc-l-gloss")).toBe("1");

    await user.click(screen.getByRole("button", { name: "dim" }));
    // A stale coefficient would leave a layer lit after the finish changed.
    expect(root()?.style.getPropertyValue("--tc-l-gloss")).toBe("");
  });

  it("renders layers as inert decoration", () => {
    render(<Card />);
    const layer = screen.getByTestId("layer");
    expect(layer).toHaveAttribute("data-part", "layer");
    // The layer takes no props and carries no semantics — it is a surface for
    // the consumer's CSS and nothing else.
    expect(layer).toBeEmptyDOMElement();
  });
});
