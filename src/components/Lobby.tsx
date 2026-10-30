import type { Difficulty, RoomState, Settings } from "@/shared/types";
import { LIMITS } from "@/shared/types";
import { Lives } from "./Players";

const DIFFICULTIES: { id: Difficulty; label: string; hint: string }[] = [
  { id: "easy", label: "Easy", hint: "Common chunks like ER, ING" },
  { id: "medium", label: "Medium", hint: "A good mix" },
  { id: "hard", label: "Hard", hint: "Rare chunks — think fast" },
];

export function Lobby({
  state,
  me,
  onSettings,
  onStart,
}: {
  state: RoomState;
  me: string;
  onSettings: (s: Partial<Settings>) => void;
  onStart: () => void;
}) {
  const isHost = state.hostId === me;
  const over = state.phase === "over";
  const winner = state.players.find((p) => p.id === state.winnerId);
  const standings = [...state.players].sort((a, b) => Number(b.alive) - Number(a.alive) || b.score - a.score);
  const connected = state.players.filter((p) => p.connected).length;

  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-line bg-panel/80 p-5 sm:p-8">
      {over ? (
        <div className="animate-pop text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-muted">Round over</p>
          <h2 className="mt-2 font-display text-4xl font-extrabold text-gold sm:text-5xl">
            {state.players.length > 1 || !winner ? `${winner?.name ?? "Nobody"} wins!` : `${winner.score} points`}
          </h2>
          <p className="mt-1 text-muted">{state.usedCount} words played</p>
        </div>
      ) : (
        <div>
          <h2 className="font-display text-3xl font-extrabold">Waiting to light the wick</h2>
          <p className="mt-1 text-muted">
            Share the room code <b className="font-mono tracking-widest text-ember">{state.code}</b> with friends — or
            start solo to practice.
          </p>
        </div>
      )}

      <ol className="grid gap-2 sm:grid-cols-2">
        {(over ? standings : state.players).map((p, i) => (
          <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink/60 px-3 py-2">
            <span className="flex min-w-0 items-center gap-2">
              {over && <span className="w-5 font-mono text-sm text-muted">{i + 1}</span>}
              <span className="truncate font-semibold">
                {p.id === state.hostId && <span className="mr-1 text-gold">★</span>}
                {p.name}
                {p.id === me && <span className="ml-1 text-xs font-normal text-muted">(you)</span>}
              </span>
            </span>
            {over ? (
              <span className="font-mono text-sm text-gold">{p.score} pts · {p.wordCount}w</span>
            ) : (
              <span className={`text-xs ${p.connected ? "text-mint" : "text-danger"}`}>
                {p.connected ? "ready" : "offline"}
              </span>
            )}
          </li>
        ))}
      </ol>

      <div className="grid gap-4 rounded-2xl border border-line bg-ink/40 p-4 sm:grid-cols-2">
        <fieldset disabled={!isHost}>
          <legend className="mb-2 text-sm font-medium text-muted">Difficulty</legend>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-ink p-1">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                title={d.hint}
                onClick={() => onSettings({ difficulty: d.id })}
                className={`rounded-lg px-2 py-2 text-sm font-semibold transition ${
                  state.settings.difficulty === d.id ? "bg-ember text-ink" : "text-muted hover:text-text"
                } disabled:cursor-not-allowed`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset disabled={!isHost}>
          <legend className="mb-2 text-sm font-medium text-muted">Starting flames</legend>
          <div className="flex items-center gap-3">
            <button
              aria-label="Fewer lives"
              onClick={() => onSettings({ startLives: state.settings.startLives - 1 })}
              disabled={!isHost || state.settings.startLives <= 1}
              className="h-10 w-10 rounded-lg bg-ink text-lg font-bold disabled:opacity-40"
            >
              −
            </button>
            <Lives lives={state.settings.startLives} />
            <button
              aria-label="More lives"
              onClick={() => onSettings({ startLives: state.settings.startLives + 1 })}
              disabled={!isHost || state.settings.startLives >= LIMITS.maxLives}
              className="h-10 w-10 rounded-lg bg-ink text-lg font-bold disabled:opacity-40"
            >
              +
            </button>
          </div>
        </fieldset>
      </div>

      {isHost ? (
        <button
          onClick={onStart}
          disabled={connected === 0}
          className="rounded-xl bg-ember px-6 py-4 font-display text-xl font-extrabold text-ink transition hover:brightness-110 disabled:opacity-40"
        >
          {over ? "Play again" : connected > 1 ? `Start with ${connected} players` : "Start solo practice"}
        </button>
      ) : (
        <p className="rounded-xl border border-dashed border-line py-4 text-center text-muted">
          Waiting for the host to {over ? "start another round" : "start"}…
        </p>
      )}
    </section>
  );
}
