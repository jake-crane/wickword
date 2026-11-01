"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameEvent, PublicTurn, RoomState, Settings } from "@/shared/types";
import { LIMITS } from "@/shared/types";
import { getName, getPlayerId, getSocket, setName } from "@/lib/client";
import { Board } from "./Board";
import { Lobby } from "./Lobby";
import { LogPanel } from "./LogPanel";
import { Logo } from "./Logo";
import { Players } from "./Players";

/** Turn with a local-clock deadline, so the fuse animates without clock sync. */
export type LocalTurn = PublicTurn & { deadline: number };
type LocalState = Omit<RoomState, "turn"> & { turn: LocalTurn | null };

function NamePrompt({ onDone }: { onDone: (name: string) => void }) {
  const [name, setValue] = useState("");
  return (
    <form
      className="mx-auto mt-16 max-w-sm rounded-2xl border border-line bg-panel p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onDone(name.trim());
      }}
    >
      <label htmlFor="nick" className="text-sm text-muted">
        Pick a nickname to join
      </label>
      <input
        id="nick"
        autoFocus
        value={name}
        onChange={(e) => setValue(e.target.value.slice(0, LIMITS.maxName))}
        className="mt-2 w-full rounded-xl border border-line bg-ink px-4 py-3 text-lg outline-none focus:border-ember"
      />
      <button className="mt-4 w-full rounded-xl bg-ember py-3 font-display font-extrabold text-ink">Join room</button>
    </form>
  );
}

export function GameRoom({ code }: { code: string }) {
  const [me] = useState(getPlayerId);
  const [name, setNameState] = useState<string | null>(null);
  const [state, setState] = useState<LocalState | null>(null);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(true);
  const [copied, setCopied] = useState(false);
  const [flash, setFlash] = useState<{ ev: GameEvent; key: number } | null>(null);
  const flashKey = useRef(0);

  useEffect(() => setNameState(getName()), []);

  useEffect(() => {
    if (!name) return;
    const socket = getSocket();
    const join = () =>
      socket.emit("room:join", { code, name, playerId: me }, (res: { ok: boolean; error?: string }) => {
        if (!res.ok) setError(res.error ?? "Couldn't join");
      });

    const onState = (s: RoomState) =>
      setState({ ...s, turn: s.turn && { ...s.turn, deadline: Date.now() + s.turn.remainingMs } });
    const onTyping = ({ playerId, text }: { playerId: string; text: string }) =>
      setState((s) => (s?.turn?.playerId === playerId ? { ...s, turn: { ...s.turn, typing: text } } : s));
    const onEvent = (ev: GameEvent) => setFlash({ ev, key: ++flashKey.current });
    const onConnect = () => {
      setConnected(true);
      join();
    };
    const onDisconnect = () => setConnected(false);

    socket.on("state", onState);
    socket.on("typing", onTyping);
    socket.on("event", onEvent);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    if (socket.connected) join();
    return () => {
      socket.off("state", onState);
      socket.off("typing", onTyping);
      socket.off("event", onEvent);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [code, name, me]);

  const send = useCallback((event: string, payload?: unknown) => getSocket().emit(event, payload), []);
  const onSettings = useCallback((s: Partial<Settings>) => send("game:settings", s), [send]);

  function copyInvite() {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (name === null) return null;
  if (!name)
    return (
      <NamePrompt
        onDone={(n) => {
          setName(n);
          setNameState(n);
        }}
      />
    );

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-4 px-4 py-4 lg:h-dvh">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" aria-label="Home">
          <Logo size="text-2xl" />
        </Link>
        <div className="flex items-center gap-2">
          {!connected && <span className="text-sm text-danger">Reconnecting…</span>}
          <button
            onClick={copyInvite}
            className="rounded-lg border border-line bg-panel px-3 py-1.5 text-sm transition hover:border-ember"
          >
            Room <b className="font-mono tracking-widest text-ember">{code}</b>
            <span className="ml-2 text-muted">{copied ? "copied!" : "copy link"}</span>
          </button>
        </div>
      </header>

      {error ? (
        <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-line bg-panel p-6 text-center">
          <p className="text-danger">{error}</p>
          <Link href="/" className="mt-4 inline-block rounded-xl bg-ember px-5 py-2 font-semibold text-ink">
            Back home
          </Link>
        </div>
      ) : !state ? (
        <p className="mt-16 text-center text-muted">Joining room…</p>
      ) : (
        <div className="grid flex-1 gap-4 lg:min-h-0 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-4 lg:overflow-y-auto">
            {state.phase === "playing" && state.turn ? (
              <>
                <Players
                  players={state.players}
                  turn={state.turn}
                  hostId={state.hostId}
                  me={me}
                  flash={flash}
                />
                <Board
                  turn={state.turn}
                  players={state.players}
                  me={me}
                  flash={flash}
                  onType={(t) => send("game:type", t)}
                  onSubmit={(w) => send("game:submit", w)}
                />
              </>
            ) : (
              <Lobby state={state} me={me} onSettings={onSettings} onStart={() => send("game:start")} />
            )}
          </div>
          <LogPanel log={state.log} onChat={(t) => send("chat", t)} />
        </div>
      )}
    </main>
  );
}
