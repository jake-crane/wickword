export function Flame({ className = "", lit = true }: { className?: string; lit?: boolean }) {
  return (
    <svg viewBox="0 0 16 20" className={className} aria-hidden>
      <path
        d="M8 1c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2-4.6.2 1.4.8 2.4 1.8 2.8C6.3 6.6 7 3.6 8 1Z"
        fill={lit ? "var(--ember)" : "var(--line)"}
      />
      {lit && <path d="M8 10c.6 1.3 2.2 2 2.2 4a2.2 2.2 0 0 1-4.4 0c0-1.3.9-2.3 2.2-4Z" fill="var(--gold)" />}
    </svg>
  );
}

export function Shield({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 18" className={className} aria-hidden>
      <path d="M8 1 15 3.5v5c0 4-3 7.2-7 8.5C4 15.7 1 12.5 1 8.5v-5L8 1Z" fill="var(--sky)" />
      <path d="M5 9l2 2 4-4.5" stroke="var(--ink)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ size = "text-3xl" }: { size?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display font-extrabold tracking-tight ${size}`}>
      <Flame className="h-[1em] w-[0.8em] animate-flicker" />
      <span>
        wick<span className="text-ember">word</span>
      </span>
    </span>
  );
}
