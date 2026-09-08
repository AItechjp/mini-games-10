# Supabase Realtime multiplayer upgrade

The current public online mode still uses PeerJS as a working fallback. The repository now contains the database/RLS foundation for moving the battle mode to Supabase Realtime without changing the game rules.

## Target architecture

- Anonymous Supabase Auth: creates a temporary authenticated player identity without email/password.
- `game_rooms`: authoritative 6-character room registry with expiration.
- `room_players`: exactly one host and one guest per room.
- Realtime Presence: online/offline, ready state, reconnect detection.
- Realtime Broadcast: game selection, countdown/start, live score, finish, rematch and ping messages.
- Private Realtime channels + RLS: only users registered in that room can subscribe/send.
- GitHub Pages remains the frontend host.

## Setup

1. Create or connect a Supabase project.
2. Enable Anonymous Sign-Ins in Authentication settings.
3. Disable public Realtime access when switching production to private channels.
4. Apply `supabase/migrations/001_multiplayer.sql`.
5. Copy `supabase-config.example.js` to `supabase-config.js` and set the Project URL and `sb_publishable_...` key.
6. Replace the PeerJS network adapter in `app.js` with Supabase Realtime while keeping the existing game runners.

Never put an `sb_secret_...` key or service-role-style credential in GitHub Pages source.

## Recommended event protocol

Channel topic: `room:ABC123`

Broadcast events:

- `game_select` -> `{ gameId }`
- `ready` -> `{ ready: true }`
- `start` -> `{ gameId, seed, startAt }`
- `score` -> `{ score }`
- `finish` -> `{ score, extra }`
- `rematch` -> `{ gameId }`
- `ping` / `pong` -> clock/latency synchronization

Presence payload should remain low-frequency, for example:

```js
{
  playerId,
  role: 'host',
  ready: true,
  page: 'lobby'
}
```

Live score updates belong in Broadcast, not Presence.

## Why this is better for this site

PeerJS/WebRTC is useful because it needs almost no backend, but direct P2P connections can fail on restrictive NAT/firewall networks and room identity is tied to the signaling service. Supabase Realtime uses a managed WebSocket service for Broadcast and Presence, giving the game an authoritative room registry, better reconnect handling and a path to match history, rankings, moderation and spectator modes later.
