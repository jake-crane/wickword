import fs from "node:fs";
import path from "node:path";
import type { Difficulty } from "../shared/types";

// Prompt pools are bands of "how many dictionary words contain this chunk".
// Easy chunks appear in thousands of words; hard ones in only a few dozen.
const BANDS: Record<Difficulty, { min: number; max: number }> = {
  easy: { min: 2500, max: Infinity },
  medium: { min: 500, max: 2500 },
  hard: { min: 60, max: 500 },
};

class Dictionary {
  private words: string[];
  private set: Set<string>;
  private pools: Record<Difficulty, string[]>;

  constructor() {
    const file = path.join(process.cwd(), "node_modules/an-array-of-english-words/index.json");
    const raw: string[] = JSON.parse(fs.readFileSync(file, "utf8"));
    this.words = raw.filter((w) => w.length >= 2 && /^[a-z]+$/.test(w));
    this.set = new Set(this.words);

    const counts = new Map<string, number>();
    for (const w of this.words) {
      if (w.length < 3) continue;
      const seen = new Set<string>();
      for (const n of [2, 3]) {
        for (let i = 0; i + n <= w.length; i++) seen.add(w.slice(i, i + n));
      }
      for (const chunk of seen) counts.set(chunk, (counts.get(chunk) ?? 0) + 1);
    }

    this.pools = { easy: [], medium: [], hard: [] };
    for (const [chunk, count] of counts) {
      for (const d of Object.keys(BANDS) as Difficulty[]) {
        if (count >= BANDS[d].min && count < BANDS[d].max) this.pools[d].push(chunk);
      }
    }
  }

  has(word: string) {
    return this.set.has(word);
  }

  randomPrompt(difficulty: Difficulty, avoid?: string) {
    const pool = this.pools[difficulty];
    let pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick === avoid && pool.length > 1) pick = pool[(pool.indexOf(pick) + 1) % pool.length];
    return pick;
  }

  /** A random unused word containing `chunk`, to show what could have been played. */
  example(chunk: string, used: Set<string>) {
    const start = Math.floor(Math.random() * this.words.length);
    for (let i = 0; i < this.words.length; i++) {
      const w = this.words[(start + i) % this.words.length];
      if (w.length >= 4 && w.length <= 10 && w.includes(chunk) && !used.has(w)) return w;
    }
    return null;
  }

  get stats() {
    return {
      words: this.words.length,
      easy: this.pools.easy.length,
      medium: this.pools.medium.length,
      hard: this.pools.hard.length,
    };
  }
}

let instance: Dictionary | null = null;
export function dictionary() {
  instance ??= new Dictionary();
  return instance;
}
