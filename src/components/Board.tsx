"use client";

import { useEffect, useRef, useState } from "react";
import type { GameEvent, PublicPlayer, RejectReason } from "@/shared/types";
import { LIMITS } from "@/shared/types";
import type { LocalTurn } from "./GameRoom";

const REJECT_TEXT: Record<RejectReason, string> = {
  short: "Too short — 3 letters minimum",
  missing: "Doesn't contain the letters",
  used: "Already played this round",
  unknown: "Not in the dictionary",
};

function Fuse({ deadline, fuseMs }: { deadline: number; fuseMs: number }) {
  const rope = useRef<HTMLDivElement>(null);
  const spark = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      const pct = (left / fuseMs) * 100;
      const hot = pct < 30;
      if (rope.current) {
        rope.current.style.width = `${pct}%`;
        rope.current.style.background = hot
          ? "repeating-linear-gradient(115deg, var(--danger) 0 6px, #c42443 6px 12px)"
          : "repeating-linear-gradient(115deg, #c9a46a 0 6px, #9a7a48 6px 12px)";
      }
      if (spark.current) spark.current.style.left = `${pct}%`;
      if (label.current) label.current.textContent = (left / 1000).toFixed(1);
      if (left > 0) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [deadline, fuseMs]);

  return (
    <div className="flex w-full items-center gap-3">
      <div className="relative h-3 flex-1 rounded-full bg-ink/80 ring-1 ring-line">
        <div ref={rope} className="absolute inset-y-0 left-0 rounded-full" />
        <div ref={spark} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className="block h-5 w-5 animate-flicker rounded-full bg-gold shadow-[0_0_16px_6px_var(--ember)]" />
        </div>
      </div>
      <span ref={label} className="w-10 text-right font-mono text-sm tabular-nums text-muted" />
    </div>
  );
}

function Highlighted({ text, chunk }: { text: string; chunk: string }) {
  const i = text.indexOf(chunk);
  if (!text) return <span className="text-muted/50">…</span>;
  if (i < 0) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, i)}
      <span className="text-ember">{chunk}</span>
      {text.slice(i + chunk.length)}
    </span>
  );
}

export function Board({
  turn,
  players,
  me,
  flash,
  onType,
  onSubmit,
}: {
  turn: LocalTurn;
  players: PublicPlayer[];
  me: string;
  flash: { ev: GameEvent; key: number } | null;
  onType: (text: string) => void;
  onSubmit: (word: string) => void;
}) {
  const mine = turn.playerId === me;
  const active = players.find((p) => p.id === turn.playerId);
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const turnKey = `${turn.playerId}:${turn.deadline}`;

  useEffect(() => {
    setValue("");
    if (mine) input.current?.focus();
  }, [turnKey, mine]);

  const myReject = flash?.ev.kind === "reject" && flash.ev.playerId === me ? flash : null;
  const boom = flash?.ev.kind === "boom" ? flash : null;

  // Shake in place rather than remounting the input, which would drop focus mid-turn.
  useEffect(() => {
    if (!myReject) return;
    input.current?.focus();
    input.current?.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" }, { transform: "translateX(0)" }],
      { duration: 250, iterations: 2, easing: "ease-in-out" },
    );
  }, [myReject?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = mine ? value.toLowerCase() : turn.typing;

  return (
    <section
      key={boom?.key}
      className={`relative flex flex-col items-center gap-6 rounded-3xl border border-line bg-panel/80 px-4 py-8 sm:px-8 ${
        boom ? "animate-shake" : ""
      }`}
    >
      <p className="text-sm uppercase tracking-[0.3em] text-muted">
        {mine ? <span className="font-bold text-ember">Your turn</span> : <>{active?.name ?? "…"} is up</>}
      </p>

      <div key={turn.prompt + turn.deadline} className="animate-pop">
        <div className="rounded-2xl border-2 border-ember/60 bg-ink px-8 py-4 font-display text-6xl font-extrabold uppercase tracking-widest text-gold shadow-[inset_0_0_40px_-10px_var(--ember)] sm:text-7xl">
          {turn.prompt}
        </div>
      </div>

      <Fuse deadline={turn.deadline} fuseMs={turn.fuseMs} />

      <div className="min-h-12 max-w-full break-all text-center font-mono text-3xl font-semibold uppercase sm:text-4xl">
        <Highlighted text={shown} chunk={turn.prompt} />
      </div>

      <form
        className="w-full max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (mine && value.trim()) onSubmit(value);
        }}
      >
        <input
          ref={input}
          value={value}
          disabled={!mine}
          onChange={(e) => {
            const v = e.target.value.replace(/[^a-z]/gi, "").slice(0, LIMITS.maxWord);
            setValue(v);
            onType(v);
          }}
          placeholder={mine ? `A word with “${turn.prompt.toUpperCase()}”…` : "Wait for your turn"}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className={`w-full rounded-xl border-2 bg-ink px-4 py-3 text-center font-mono text-xl uppercase outline-none transition disabled:opacity-40 ${
            myReject ? "border-danger" : "border-line focus:border-ember"
          }`}
        />
        <p className="mt-2 h-5 text-center text-sm text-danger">
          {myReject && myReject.ev.kind === "reject" && REJECT_TEXT[myReject.ev.reason]}
        </p>
      </form>

      {boom && boom.ev.kind === "boom" && boom.ev.example && (
        <p className="absolute bottom-3 text-xs text-muted">
          Could have played <span className="font-mono uppercase text-text">{boom.ev.example}</span>
        </p>
      )}
    </section>
  );
}
