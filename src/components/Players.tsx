"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GameEvent, PublicPlayer } from "@/shared/types";
import { LIMITS } from "@/shared/types";
import type { LocalTurn } from "./GameRoom";
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

/** Mirrors the server's turn order: the next living player after the active one. */
function nextAliveId(players: PublicPlayer[], activeId: string | null) {
  const i = players.findIndex((p) => p.id === activeId);
  if (i < 0) return null;
  for (let step = 1; step < players.length; step++) {
    const p = players[(i + step) % players.length];
    if (p.alive) return p.id;
  }
  return null;
}

/** Bend of the wick, in px, where it leaves and enters a card. */
const BEND = 26;

/** SVG path from one card's edge to another's, curving through the gaps between rows. */
function wickPath(a: DOMRect, b: DOMRect, origin: DOMRect) {
  const ax = a.left + a.width / 2 - origin.left;
  const bx = b.left + b.width / 2 - origin.left;
  const top = (r: DOMRect) => r.top - origin.top;
  const bottom = (r: DOMRect) => r.bottom - origin.top;

  if (Math.abs(a.top - b.top) < 10) {
    // Same row: dip below both cards.
    const y = bottom(a);
    return `M ${ax} ${y} C ${ax} ${y + BEND}, ${bx} ${y + BEND}, ${bx} ${y}`;
  }
  if (b.top > a.top) {
    return `M ${ax} ${bottom(a)} C ${ax} ${bottom(a) + BEND}, ${bx} ${top(b) - BEND}, ${bx} ${top(b)}`;
  }
  // Wrapping back up to an earlier row.
  return `M ${ax} ${top(a)} C ${ax} ${top(a) - BEND}, ${bx} ${bottom(b) + BEND}, ${bx} ${bottom(b)}`;
}

function Wick({ d, turn }: { d: string; turn: LocalTurn }) {
  const lit = useRef<SVGPathElement>(null);
  const spark = useRef<SVGGElement>(null);

  useEffect(() => {
    const path = lit.current;
    if (!path) return;
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len} ${len}`;
    let raf = 0;
    const tick = () => {
      const left = Math.max(0, turn.deadline - Date.now());
      const burned = 1 - left / turn.fuseMs;
      // The unburned wick runs from the spark to the next player.
      path.style.strokeDashoffset = `${-len * burned}`;
      const pt = path.getPointAtLength(len * burned);
      spark.current?.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
      if (left > 0) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [d, turn.deadline, turn.fuseMs]);

  return (
    <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible" aria-hidden>
      <path d={d} fill="none" stroke="var(--line)" strokeWidth={3} strokeDasharray="2 5" strokeLinecap="round" />
      <path
        key={d}
        ref={lit}
        d={d}
        fill="none"
        stroke="#c9a46a"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <g ref={spark}>
        <circle r={9} fill="var(--ember)" opacity={0.35} className="animate-flicker" />
        <circle r={4.5} fill="var(--gold)" />
      </g>
    </svg>
  );
}

export function Players({
  players,
  turn,
  hostId,
  me,
  flash,
}: {
  players: PublicPlayer[];
  turn: LocalTurn;
  hostId: string | null;
  me: string;
  flash: { ev: GameEvent; key: number } | null;
}) {
  const activeId = turn.playerId;
  const nextId = nextAliveId(players, activeId);
  const list = useRef<HTMLUListElement>(null);
  const cards = useRef(new Map<string, HTMLLIElement>());
  const [d, setD] = useState<string | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const a = cards.current.get(activeId);
      const b = nextId ? cards.current.get(nextId) : undefined;
      if (!list.current || !a || !b) return setD(null);
      setD(wickPath(a.getBoundingClientRect(), b.getBoundingClientRect(), list.current.getBoundingClientRect()));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (list.current) ro.observe(list.current);
    return () => ro.disconnect();
  }, [activeId, nextId, players.length]);

  return (
    <ul ref={list} className="relative grid grid-cols-2 gap-x-3 gap-y-8 pb-6 pt-3 sm:grid-cols-3 lg:grid-cols-4">
      {d && <Wick d={d} turn={turn} />}
      {players.map((p) => {
        const active = p.id === activeId;
        const onDeck = p.id === nextId;
        const ev = flash?.ev.playerId === p.id ? flash : null;
        return (
          <li
            key={p.id}
            ref={(el) => {
              if (el) cards.current.set(p.id, el);
              else cards.current.delete(p.id);
            }}
            className={`relative rounded-xl border px-3 py-2 transition-[border-color,background-color,box-shadow,opacity] duration-300 ${
              active
                ? "border-ember bg-panel-2 shadow-[0_8px_24px_-8px_var(--ember)]"
                : onDeck
                  ? "border-gold/60 border-dashed bg-panel"
                  : "border-line bg-panel"
            } ${p.alive ? "" : "opacity-40 grayscale"} ${ev?.ev.kind === "boom" ? "animate-shake" : ""}`}
          >
            {ev && (ev.ev.kind === "boom" || ev.ev.kind === "accept" || ev.ev.kind === "shield") && (
              <span
                key={ev.key}
                className={`pointer-events-none absolute inset-0 animate-flash rounded-[inherit] ${
                  ev.ev.kind === "boom" ? "bg-danger" : ev.ev.kind === "shield" ? "bg-sky" : "bg-mint"
                }`}
              />
            )}
            {(active || onDeck) && (
              <span
                className={`absolute -top-2.5 right-2 z-20 rounded-full px-2 py-px text-[10px] font-bold uppercase tracking-wider ${
                  active ? "bg-ember text-ink" : "bg-gold/15 text-gold ring-1 ring-gold/50"
                }`}
              >
                {active ? "up now" : "on deck"}
              </span>
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
