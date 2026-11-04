---
"@edv4h/croupier-values-card-wire": minor
---

New package `@edv4h/croupier-values-card-wire`: converts Values Card state into the Wevox Values Card WebSocket protocol (`values-card.v1`) and back. `toWireGameSnapshot` builds `snapshot.game` for one viewer (only their own hand), `toWireEvents` replays the new action-log entries between two engine snapshots into `card_drawn` / `hand_updated` / `card_discarded` / `turn_changed` / `room_status_changed: finishing` in the order the WS server sends them (or asks for a resync when the step can't be told), `toValuesCardAction` maps `draw_card` / `discard_card` to croupier actions, and `toWireResultPlayers` gives the final hands. Card ids are numeric catalog ids on the wire; pass `toWireCardId` when cards use other ids.
