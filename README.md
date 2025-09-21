# TicTacToe Multiplayer

A real-time, server‑authoritative Tic‑Tac‑Toe built with React Native and Nakama. It features device-based authentication, two matchmaking modes (Quick and Ranked), and leaderboards (ELO and Weekly Wins), wrapped in a modern dark UI.

## Tech Stack
- Client: React Native, React, TypeScript, React Navigation
- Backend: Nakama (Go runtime), PostgreSQL
- Realtime: Nakama WebSocket

## Prerequisites
- Node.js LTS
- Android Studio and/or Xcode (for native builds)
- Docker + Docker Compose (for the backend)
- npm or yarn

## Backend Setup (Nakama)
1. Clone/open the backend folder.
2. Implement/register a Go match module “tictactoe” (MatchInit/Join/Loop/Leave) and a MatchmakerMatched hook to create matches for quick/ranked modes.
3. Create leaderboards on startup:
   - `global_elo` (operator: set, sort: desc)
   - `weekly_wins` (operator: incr, sort: desc, weekly reset schedule)
4. Start services:
   - `docker compose up --build`
5. Default ports:
   - gRPC: 7349
   - HTTP Gateway: 7350
   - Console: 7351

## Client Setup
1. `cd client && npm install`
2. Configure Nakama host in `src/services/NakamaService.ts`:
   - Web/simulator: `localhost`
   - Android emulator: `10.0.2.2`
   - Physical device: your machine’s LAN IP
3. Run:
   - Dev server: `npm start`
   - Android: `npm run android`
   - iOS: `npm run ios`
   - Type-check: `npm run tsc`

## Features
- First login name prompt saved as `display_name` (used in UI/leaderboards)
- Matchmaking:
  - Quick: `properties.mode=quick`, query `properties.mode:quick`
  - Ranked: `properties.mode=ranked` with MMR banding in query
  - Ticket-based queue join/leave
- Leaderboards:
  - Global ELO (set)
  - Weekly Wins (increment + weekly reset)
- Dark UI, animated move feedback, grid overlay, turn pulse, game-over modal

