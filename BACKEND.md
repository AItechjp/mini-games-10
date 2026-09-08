# Game backend

This project uses **Supabase** as the shared backend and **GitHub Pages** for the static frontend.

## Stack

- Frontend: HTML / CSS / vanilla JavaScript on GitHub Pages
- Database: Supabase Postgres
- Realtime multiplayer: Supabase Realtime Broadcast + Presence
- Guest chat: Supabase RPC + Realtime
- Persistent game results: Supabase Postgres through validated RPC functions
- Deployment: `.github/workflows/deploy-pages.yml`

Cloudflare was intentionally not added because the project already had a working Supabase project and Realtime room system. Keeping one backend avoids duplicating room state, credentials, and free-tier usage across two providers.

## Persistent data

### `public.game_rooms`

Temporary login-free multiplayer rooms. Room codes expire and the database stores host/guest tokens plus a private channel key.

### `public.chat_messages`

Guest chat history.

### `public.game_scores`

Persistent score/result records. Important fields:

- `submission_id`: idempotency key
- `game_id`: normalized game identifier
- `mode`: `solo` or `online`
- `player_token`: anonymous browser identifier
- `score`: sortable backend score
- `duration_ms`: round/clear time
- `room_code`: online room when applicable
- `extra`: result metadata
- `created_at`: server timestamp

Direct anonymous table access is revoked. Browser clients call RPC functions instead.

## RPC API

- `record_game_score(...)`: GAME 01–10 result validation and persistence
- `record_custom_game_score(...)`: GAME 11/12/14/15/16 result persistence
- `get_game_leaderboard(...)`: best score per anonymous player, ranked globally
- `get_personal_best(...)`: personal best for one browser token
- `get_game_backend_overview()`: home-page backend status counters
- `create_game_room(...)`, `join_game_room(...)`, `leave_game_room(...)`: GAME 01–10 multiplayer rooms
- `create_duel_room(...)`, `join_duel_room(...)`: GAME 11/12/14 dedicated duel rooms
- `post_chat_message(...)`, `get_recent_chat_messages(...)`: guest chat

## Security model

- The browser only contains the Supabase **publishable key**. No service-role key is shipped to GitHub Pages.
- `game_scores` has RLS enabled and anonymous/authenticated users have no direct SELECT/INSERT/UPDATE/DELETE privileges.
- Writes go through `SECURITY DEFINER` RPC functions with explicit input validation.
- Core online score writes require a currently active room and a host/guest token that belongs to that room.
- Dedicated arcade online results require an active room whose `game_id` matches the game being submitted.
- Score submissions have UUID idempotency keys and a simple per-browser rate limit.
- Leaderboards expose a masked player label rather than the raw anonymous token.

The client still runs the games, so this is abuse-resistant persistence rather than a fully server-authoritative anti-cheat system.

## Frontend integration

- `game-backend.js`: GAME 01–10 score saving, personal best, global leaderboard, backend overview card
- `custom-backend.js`: GAME 11/12/14/15/16 result saving
- `backend.css`: leaderboard/status UI
- `peer-supabase-shim.js`: Supabase Realtime transport compatibility for the original online game UI
- `online-bootstrap.js`: selects Supabase transport and loads the shared backend integration

## Migrations

Apply in order:

1. `001_multiplayer.sql`
2. `002_arcade_duels_and_guest_chat.sql`
3. `003_game_backend.sql`
4. `004_game_backend_online_room_validation.sql`
5. `005_custom_game_score_backend.sql`
6. `006_allow_typing_duel_rooms.sql`
