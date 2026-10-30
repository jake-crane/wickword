import type { Server } from "socket.io";
import { dictionary } from "./dictionary";
import {
  LIMITS,
  type Difficulty,
  type GameEvent,
  type LogEntry,
  type Phase,
  type PublicPlayer,
  type RoomState,
  type Settings,
} from "../shared/types";

const FUSE_START_MS = 10_000;
const FUSE_MIN_MS = 4_000;
const FUSE_STEP_MS = 250;
const LOBBY_GRACE_MS = 10_000;
const LOG_SIZE = 60;
const RARE_LETTERS = /[jqxz]/;

interface Player extends PublicPlayer {
  socketId: string | null;
}

interface Turn {
  playerId: string;
  prompt: string;
  fuseMs: number;
  deadline: number;
  typing: string;
}

export class Room {
  phase: Phase = "lobby";
  players: Player[] = [];
  hostId: string | null = null;
  settings: Settings = { difficulty: "medium", startLives: 3 };
  private turn: Turn | null = null;
  private timer: NodeJS.Timeout | null = null;
  private fuseMs = FUSE_START_MS;
  private used = new Set<string>();
  private log: LogEntry[] = [];
  private logId = 0;
  private startedWith = 0;
  private winnerId: string | null = null;

  constructor(
    readonly code: string,
    private io: Server,
  ) {}

  // ---- membership -------------------------------------------------------

  join(playerId: string, name: string, socketId: string): string | null {
    const existing = this.players.find((p) => p.id === playerId);
    if (existing) {
      existing.name = name;
      existing.socketId = socketId;
      existing.connected = true;
    } else {
      if (this.players.length >= LIMITS.maxPlayers) return "Room is full";
      // Late joiners sit out the current round and play the next one.
      const playing = this.phase === "playing";
      this.players.push({
        id: playerId,
        name,
        socketId,
        lives: playing ? 0 : this.settings.startLives,
        shield: false,
        score: 0,
        wordCount: 0,
        alive: !playing,
        connected: true,
      });
      this.system(`${name} joined${playing ? " (next round)" : ""}`);
    }
    this.hostId ??= playerId;
    this.broadcast();
    return null;
  }

  disconnect(socketId: string) {
    const p = this.players.find((x) => x.socketId === socketId);
    if (!p) return;
    p.connected = false;
    p.socketId = null;
    if (this.hostId === p.id) this.hostId = this.players.find((x) => x.connected)?.id ?? p.id;
    this.broadcast();

    setTimeout(() => {
      if (p.connected || this.phase === "playing") return;
      this.players = this.players.filter((x) => x !== p);
      if (this.hostId === p.id) this.hostId = this.players[0]?.id ?? null;
      this.system(`${p.name} left`);
      this.broadcast();
    }, LOBBY_GRACE_MS);
  }

  get empty() {
    return this.players.every((p) => !p.connected);
  }

  destroy() {
    this.clearTimer();
  }

  // ---- host controls ----------------------------------------------------

  updateSettings(by: string, s: Partial<Settings>) {
    if (by !== this.hostId || this.phase === "playing") return;
    const difficulties: Difficulty[] = ["easy", "medium", "hard"];
    if (s.difficulty && difficulties.includes(s.difficulty)) this.settings.difficulty = s.difficulty;
    if (typeof s.startLives === "number") {
      this.settings.startLives = Math.max(1, Math.min(LIMITS.maxLives, Math.round(s.startLives)));
    }
    this.broadcast();
  }

  start(by: string) {
    if (by !== this.hostId || this.phase === "playing") return;
    this.players = this.players.filter((p) => p.connected);
    if (this.players.length === 0) return;

    for (const p of this.players) {
      Object.assign(p, { lives: this.settings.startLives, shield: false, score: 0, wordCount: 0, alive: true });
    }
    this.phase = "playing";
    this.used.clear();
    this.log = [];
    this.fuseMs = FUSE_START_MS;
    this.startedWith = this.players.length;
    this.winnerId = null;
    this.system(this.players.length === 1 ? "Solo practice — survive as long as you can" : "Round started");

    const first = this.players[Math.floor(Math.random() * this.players.length)];
    this.beginTurn(first.id);
  }

  // ---- turn flow --------------------------------------------------------

  private beginTurn(playerId: string, prompt?: string) {
    this.clearTimer();
    this.turn = {
      playerId,
      prompt: prompt ?? dictionary().randomPrompt(this.settings.difficulty, this.turn?.prompt),
      fuseMs: this.fuseMs,
      deadline: Date.now() + this.fuseMs,
      typing: "",
    };
    this.timer = setTimeout(() => this.burnOut(), this.fuseMs);
    this.broadcast();
  }

  type(playerId: string, text: string) {
    if (!this.turn || this.turn.playerId !== playerId) return;
    this.turn.typing = text.slice(0, LIMITS.maxWord).toLowerCase();
    this.io.to(this.code).volatile.emit("typing", { playerId, text: this.turn.typing });
  }

  submit(playerId: string, raw: string) {
    const turn = this.turn;
    if (this.phase !== "playing" || !turn || turn.playerId !== playerId) return;
    const word = raw.trim().toLowerCase().slice(0, LIMITS.maxWord);
    const player = this.players.find((p) => p.id === playerId)!;

    const reason =
      word.length < 3 ? "short"
      : !word.includes(turn.prompt) ? "missing"
      : this.used.has(word) ? "used"
      : !dictionary().has(word) ? "unknown"
      : null;
    if (reason) {
      this.emit({ kind: "reject", playerId, word, reason });
      return;
    }

    this.used.add(word);
    player.score += word.length;
    player.wordCount++;

    let bonus: "life" | "shield" | undefined;
    if (word.length >= LIMITS.longWord && player.lives < LIMITS.maxLives) {
      player.lives++;
      bonus = "life";
    } else if (RARE_LETTERS.test(word) && !player.shield) {
      player.shield = true;
      bonus = "shield";
    }

    this.pushLog({ kind: "word", playerId, name: player.name, text: word, prompt: turn.prompt, bonus });
    this.emit({ kind: "accept", playerId, word, bonus });
    this.fuseMs = Math.max(FUSE_MIN_MS, this.fuseMs - FUSE_STEP_MS);
    this.beginTurn(this.nextAlive(playerId));
  }

  private burnOut() {
    const turn = this.turn;
    if (!turn) return;
    const p = this.players.find((x) => x.id === turn.playerId);
    if (!p) return;

    if (p.shield) {
      p.shield = false;
      this.pushLog({ kind: "shield", playerId: p.id, name: p.name, text: "Shield absorbed the blast" });
      this.emit({ kind: "shield", playerId: p.id });
    } else {
      p.lives--;
      if (p.lives <= 0) p.alive = false;
      const example = dictionary().example(turn.prompt, this.used);
      this.pushLog({
        kind: "boom",
        playerId: p.id,
        name: p.name,
        text: p.alive ? "lost a life" : "is out",
        prompt: turn.prompt,
        example: example ?? undefined,
      });
      this.emit({ kind: "boom", playerId: p.id, prompt: turn.prompt, example, eliminated: !p.alive });
    }

    // A fresh fuse (but not a full reset) gives the next player a fair shot.
    this.fuseMs = Math.min(FUSE_START_MS, this.fuseMs + FUSE_STEP_MS * 2);
    if (this.checkOver()) return;
    this.beginTurn(this.nextAlive(p.id));
  }

  private nextAlive(fromId: string) {
    const i = this.players.findIndex((p) => p.id === fromId);
    for (let step = 1; step <= this.players.length; step++) {
      const p = this.players[(i + step) % this.players.length];
      if (p.alive) return p.id;
    }
    return fromId;
  }

  private checkOver() {
    const alive = this.players.filter((p) => p.alive);
    const over = this.startedWith > 1 ? alive.length <= 1 : alive.length === 0;
    if (!over) return false;

    this.clearTimer();
    this.phase = "over";
    this.turn = null;
    const best = [...this.players].sort((a, b) => b.score - a.score)[0];
    this.winnerId = alive[0]?.id ?? best?.id ?? null;
    const winner = this.players.find((p) => p.id === this.winnerId);
    this.system(this.startedWith > 1 ? `${winner?.name} wins!` : `Practice over — ${winner?.score ?? 0} points`);
    this.broadcast();
    return true;
  }

  // ---- chat & log -------------------------------------------------------

  chat(playerId: string, text: string) {
    const p = this.players.find((x) => x.id === playerId);
    const clean = text.trim().slice(0, LIMITS.maxChat);
    if (!p || !clean) return;
    this.pushLog({ kind: "chat", playerId, name: p.name, text: clean });
    this.broadcast();
  }

  private system(text: string) {
    this.pushLog({ kind: "system", text });
  }

  private pushLog(entry: Omit<LogEntry, "id">) {
    this.log.push({ id: ++this.logId, ...entry });
    if (this.log.length > LOG_SIZE) this.log.shift();
  }

  // ---- networking -------------------------------------------------------

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private emit(ev: GameEvent) {
    this.io.to(this.code).emit("event", ev);
  }

  broadcast() {
    this.io.to(this.code).emit("state", this.snapshot());
  }

  snapshot(): RoomState {
    return {
      code: this.code,
      phase: this.phase,
      hostId: this.hostId,
      settings: this.settings,
      players: this.players.map(({ socketId, ...p }) => (void socketId, p)),
      turn: this.turn && {
        playerId: this.turn.playerId,
        prompt: this.turn.prompt,
        fuseMs: this.turn.fuseMs,
        remainingMs: Math.max(0, this.turn.deadline - Date.now()),
        typing: this.turn.typing,
      },
      winnerId: this.winnerId,
      log: this.log,
      usedCount: this.used.size,
    };
  }
}
