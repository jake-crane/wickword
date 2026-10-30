import type { GameEvent, PublicPlayer } from "@/shared/types";
import { LIMITS } from "@/shared/types";
import { Flame, Shield } from "./Logo";

export function Lives({ lives, shield = false }: { lives: number; shield?: boolean }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${lives} lives`}>
      {Array.from({ length: Math.min(Math.max(lives, 1), LIMITS.maxLives) }, (_, i) => (
        <Flame key={i} lit={i < lives} className="h-4 w-3.5" />
      ))}
      {shield && <Shield className="ml-1 h-4 w-3.5" />}
    </span>
  );
}

export function Players({
  players,
  activeId,
  hostId,
  me,
  flash,
}: {
  players: PublicPlayer[];
  activeId: string | null;
  hostId: string | null;
  me: string;
  flash: { ev: GameEvent; key: number } | null;
}) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {players.map((p) => {
        const active = p.id === activeId;
        const ev = flash?.ev.playerId === p.id ? flash : null;
        return (
          <li
            key={p.id}
            className={`relative overflow-hidden rounded-xl border px-3 py-2 transition-all duration-300 ${
              active
                ? "-translate-y-1 border-ember bg-panel-2 shadow-[0_8px_24px_-8px_var(--ember)]"
                : "border-line bg-panel"
            } ${p.alive ? "" : "opacity-40 grayscale"} ${ev?.ev.kind === "boom" ? "animate-shake" : ""}`}
          >
            {ev && (ev.ev.kind === "boom" || ev.ev.kind === "accept" || ev.ev.kind === "shield") && (
              <span
                key={ev.key}
                className={`pointer-events-none absolute inset-0 animate-flash ${
                  ev.ev.kind === "boom" ? "bg-danger" : ev.ev.kind === "shield" ? "bg-sky" : "bg-mint"
                }`}
              />
            )}
            <div className="relative flex items-center justify-between gap-2">
              <span className="truncate font-semibold">
                {p.id === hostId && <span title="Host" className="mr-1 text-gold">★</span>}
                {p.name}
                {p.id === me && <span className="ml-1 text-xs font-normal text-muted">(you)</span>}
              </span>
              <span className="font-mono text-sm text-gold tabular-nums">{p.score}</span>
            </div>
            <div className="relative mt-1 flex items-center justify-between text-xs text-muted">
              {p.alive ? <Lives lives={p.lives} shield={p.shield} /> : <span className="font-semibold uppercase text-danger">out</span>}
              {!p.connected ? <span className="text-danger">offline</span> : <span>{p.wordCount} words</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
