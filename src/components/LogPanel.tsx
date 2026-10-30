"use client";

import { useEffect, useRef, useState } from "react";
import type { LogEntry } from "@/shared/types";
import { LIMITS } from "@/shared/types";

function Entry({ e }: { e: LogEntry }) {
  switch (e.kind) {
    case "word":
      return (
        <>
          <b>{e.name}</b>{" "}
          <span className="font-mono uppercase text-mint">{e.text}</span>
          {e.bonus === "life" && <span className="ml-1 text-gold">+1 flame</span>}
          {e.bonus === "shield" && <span className="ml-1 text-sky">+shield</span>}
        </>
      );
    case "boom":
      return (
        <>
          <span className="text-danger">💥 {e.name} {e.text}</span>
          {e.example && (
            <span className="block text-xs text-muted">
              {e.prompt?.toUpperCase()} → <span className="font-mono uppercase">{e.example}</span>
            </span>
          )}
        </>
      );
    case "shield":
      return <span className="text-sky">🛡 {e.name}: {e.text}</span>;
    case "chat":
      return (
        <>
          <b className="text-muted">{e.name}:</b> {e.text}
        </>
      );
    default:
      return <span className="italic text-muted">{e.text}</span>;
  }
}

export function LogPanel({ log, onChat }: { log: LogEntry[]; onChat: (text: string) => void }) {
  const [text, setText] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const last = log.at(-1)?.id;

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [last]);

  return (
    <aside className="flex h-80 flex-col rounded-2xl border border-line bg-panel lg:h-full lg:min-h-0">
      <h3 className="border-b border-line px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted">
        Log &amp; chat
      </h3>
      <div ref={list} className="flex-1 space-y-1.5 overflow-y-auto px-4 py-3 text-sm">
        {log.map((e) => (
          <div key={e.id} className="break-words">
            <Entry e={e} />
          </div>
        ))}
      </div>
      <form
        className="border-t border-line p-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onChat(text);
          setText("");
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, LIMITS.maxChat))}
          placeholder="Say something…"
          className="w-full rounded-lg bg-ink px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ember"
        />
      </form>
    </aside>
  );
}
