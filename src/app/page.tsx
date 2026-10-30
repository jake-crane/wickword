"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getName, getSocket, setName } from "@/lib/client";
import { LIMITS } from "@/shared/types";

export default function Home() {
  const router = useRouter();
  const [name, setNameInput] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setNameInput(getName()), []);

  const ready = name.trim().length > 0;

  function remember() {
    setName(name.trim());
  }

  function create() {
    if (!ready || busy) return;
    remember();
    setBusy(true);
    getSocket().emit("room:create", {}, (res: { ok: boolean; code?: string; error?: string }) => {
      if (res.ok && res.code) router.push(`/room/${res.code}`);
      else {
        setError(res.error ?? "Couldn't create a room");
        setBusy(false);
      }
    });
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!ready || c.length !== 4) return;
    remember();
    router.push(`/room/${c}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-12">
      <Logo size="text-5xl sm:text-6xl" />
      <p className="mt-3 text-lg text-muted">
        The wick is lit. Type a word containing the letters before it burns down — then pass it on.
      </p>

      <div className="mt-10 rounded-2xl border border-line bg-panel p-5 sm:p-6">
        <label className="block text-sm font-medium text-muted" htmlFor="name">
          Nickname
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setNameInput(e.target.value.slice(0, LIMITS.maxName))}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="e.g. Lexi Kon"
          autoComplete="off"
          className="mt-2 w-full rounded-xl border border-line bg-ink px-4 py-3 text-lg outline-none focus:border-ember"
        />

        <button
          onClick={create}
          disabled={!ready || busy}
          className="mt-4 w-full rounded-xl bg-ember px-4 py-3 font-display text-lg font-extrabold text-ink transition hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "Lighting…" : "Create a room"}
        </button>

        <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-widest text-muted">
          <span className="h-px flex-1 bg-line" /> or join <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={join} className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^a-z]/gi, "").slice(0, 4).toUpperCase())}
            placeholder="ROOM"
            aria-label="Room code"
            className="w-0 min-w-0 flex-1 rounded-xl border border-line bg-ink px-4 py-3 text-center font-mono text-lg tracking-[0.4em] uppercase outline-none focus:border-ember"
          />
          <button
            disabled={!ready || code.length !== 4}
            className="rounded-xl border border-line bg-panel-2 px-5 font-semibold transition hover:border-ember disabled:opacity-40"
          >
            Join
          </button>
        </form>
        {!ready && <p className="mt-3 text-sm text-muted">Pick a nickname to play.</p>}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>

      <ul className="mt-8 grid gap-3 text-sm text-muted sm:grid-cols-3">
        <li className="rounded-xl border border-line/60 p-3">
          <b className="text-text">Beat the wick.</b> Each turn has a visible fuse that gets shorter as the room
          heats up.
        </li>
        <li className="rounded-xl border border-line/60 p-3">
          <b className="text-gold">11+ letters</b> relights a lost flame (up to {LIMITS.maxLives}).
        </li>
        <li className="rounded-xl border border-line/60 p-3">
          <b className="text-sky">J, Q, X or Z</b> earns a shield that absorbs one burnout.
        </li>
      </ul>
    </main>
  );
}
