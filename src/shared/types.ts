export type Difficulty = "easy" | "medium" | "hard";
export type Phase = "lobby" | "playing" | "over";

export interface Settings {
  difficulty: Difficulty;
  startLives: number;
}

export interface PublicPlayer {
  id: string;
  name: string;
  lives: number;
  shield: boolean;
  score: number;
  wordCount: number;
  alive: boolean;
  connected: boolean;
}

export interface PublicTurn {
  playerId: string;
  prompt: string;
  fuseMs: number;
  remainingMs: number;
  typing: string;
}

export interface LogEntry {
  id: number;
  kind: "word" | "boom" | "shield" | "chat" | "system";
  playerId?: string;
  name?: string;
  text: string;
  prompt?: string;
  bonus?: "life" | "shield";
  example?: string;
}

export interface RoomState {
  code: string;
  phase: Phase;
  hostId: string | null;
  settings: Settings;
  players: PublicPlayer[];
  turn: PublicTurn | null;
  winnerId: string | null;
  log: LogEntry[];
  usedCount: number;
}

export type RejectReason = "missing" | "used" | "unknown" | "short";

export type GameEvent =
  | { kind: "accept"; playerId: string; word: string; bonus?: "life" | "shield" }
  | { kind: "reject"; playerId: string; word: string; reason: RejectReason }
  | { kind: "boom"; playerId: string; prompt: string; example: string | null; eliminated: boolean }
  | { kind: "shield"; playerId: string };

export interface JoinPayload {
  code: string;
  name: string;
  playerId: string;
}

export type Ack<T = object> = (res: ({ ok: true } & T) | { ok: false; error: string }) => void;

export const LIMITS = {
  maxPlayers: 12,
  maxName: 16,
  maxWord: 40,
  maxChat: 200,
  maxLives: 4,
  longWord: 11,
} as const;
