# Wickword

A fast multiplayer word game. Each turn you get a 2–3 letter chunk and a burning wick — type a word containing
those letters before it burns down, and the turn passes on.

## Rules

- Every player starts with 1–4 flames (host setting). Let the wick burn out and you lose one; lose them all and you're out.
- The wick gets 0.25s shorter with every valid word (down to 4s), and backs off a little after each burnout.
- Words must contain the chunk, be 3+ letters, be in the dictionary, and not have been played yet this round.
- **11+ letter word:** relight a flame (max 4).
- **Word with J, Q, X or Z:** earn a shield that absorbs your next burnout.
- Last player standing wins. Solo rooms are practice mode — play until you burn out.
- Score is total letters played.

## Running

```bash
npm install
npm run dev        # http://localhost:3000
```

Production: `npm run build && npm start`. The app runs on a custom Node server (`server.ts`) that hosts both
Next.js and Socket.IO, so deploy it somewhere that runs a long-lived Node process (a VPS, Fly, Railway, Render) —
not serverless Vercel functions.

## Layout

- `server.ts` — HTTP server: Next.js + Socket.IO
- `src/server/room.ts` — game engine (turns, fuse timer, scoring, bonuses); server-authoritative
- `src/server/dictionary.ts` — word list (`an-array-of-english-words`, ~275k words) and prompt pools by difficulty
- `src/server/socket.ts` — room registry and socket handlers
- `src/components/` — lobby, board, players, log/chat UI
- `src/shared/types.ts` — types shared by client and server

Rooms live in memory, so restarting the server ends all games. Player identity is a per-tab id in `sessionStorage`,
so two tabs in one browser count as two players and a reload rejoins as the same player.
