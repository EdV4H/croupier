# @edv4h/croupier-values-card-wire

Bridges [`@edv4h/croupier-plugin-values-card`](../plugin-values-card) and the Wevox Values Card
WebSocket protocol (`values-card.v1`): croupier state becomes the WS game events and
`snapshot.game`, and the WS game commands become croupier actions.

The same conversion is used by the WS server (server-side, authoritative) and by the
Wevox Board client (the game runs in the board's shared state), so both send the
Values Card UI exactly the same events.

## Install

```bash
npm install @edv4h/croupier-core @edv4h/croupier-plugin-values-card @edv4h/croupier-values-card-wire
```

## Usage

```typescript
import {
  toValuesCardAction,
  toWireEvents,
  toWireGameSnapshot,
} from "@edv4h/croupier-values-card-wire";

// Card ids on the wire are numeric catalog ids. Pass toWireCardId when your cards use other ids.
const options = { toWireCardId: (card) => catalogIdOf(card) };

// A client command → a croupier action
const action = toValuesCardAction(command, engine.getState(), playerId, options);
if (action) engine.dispatch(playerId, action.action, action.payload);

// prev/next engine snapshots → the events one viewer should receive
const result = toWireEvents(prevSnapshot, engine.toSnapshot(), viewerId, options);
if (result.kind === "events") result.events.forEach(send);
else send({ type: "snapshot", payload: { ...room, game: toWireGameSnapshot(state, viewerId, options) } });
```

- `toWireEvents` replays the new action-log entries from the previous snapshot (bot and
  turn-timeout moves are logged like any other) and returns them in the order the WS server
  sends them: `card_drawn` → `hand_updated` (drawer only), `card_discarded` → `hand_updated`
  (discarder only) → `turn_changed`, or `room_status_changed: finishing` when the game ended.
- When the step can't be told as events (log truncated, game reset, the replay doesn't
  reach the new state), it returns `{ kind: "resync" }`: send that viewer a full snapshot.
- Room events (participants, theme, stamps, room status other than `finishing`) and the
  result's share key belong to the host and are not covered here. `toWireResultPlayers`
  gives the final hands for `snapshot.result.players`.

## License

MIT
