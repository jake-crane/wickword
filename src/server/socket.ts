import type { Server, Socket } from "socket.io";
import { Room } from "./room";
import { dictionary } from "./dictionary";
import { LIMITS, type Ack, type JoinPayload, type Settings } from "../shared/types";

const rooms = new Map<string, Room>();
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const EMPTY_ROOM_TTL_MS = 60_000;

function newCode() {
  let code: string;
  do {
    code = Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function reapLater(room: Room) {
  setTimeout(() => {
    if (room.empty && rooms.get(room.code) === room) {
      room.destroy();
      rooms.delete(room.code);
    }
  }, EMPTY_ROOM_TTL_MS);
}

function cleanName(name: unknown) {
  return String(name ?? "").replace(/\s+/g, " ").trim().slice(0, LIMITS.maxName);
}

export function registerGameHandlers(io: Server) {
  const stats = dictionary().stats;
  console.log(`> Dictionary: ${stats.words} words, prompts easy/medium/hard = ${stats.easy}/${stats.medium}/${stats.hard}`);

  io.on("connection", (socket: Socket) => {
    const current = () => {
      const { code, playerId } = socket.data as { code?: string; playerId?: string };
      const room = code ? rooms.get(code) : undefined;
      return room && playerId ? { room, playerId } : null;
    };

    socket.on("room:create", (_: unknown, ack: Ack<{ code: string }>) => {
      const room = new Room(newCode(), io);
      rooms.set(room.code, room);
      reapLater(room);
      ack({ ok: true, code: room.code });
    });

    socket.on("room:join", (payload: JoinPayload, ack: Ack<{ code: string }>) => {
      const code = String(payload?.code ?? "").toUpperCase();
      const name = cleanName(payload?.name);
      const playerId = String(payload?.playerId ?? "").slice(0, 64);
      const room = rooms.get(code);
      if (!room) return ack({ ok: false, error: "That room doesn't exist (or has closed)." });
      if (!name || !playerId) return ack({ ok: false, error: "Pick a nickname first." });

      const prev = current();
      if (prev && prev.room !== room) {
        socket.leave(prev.room.code);
        prev.room.disconnect(socket.id);
      }

      const err = room.join(playerId, name, socket.id);
      if (err) return ack({ ok: false, error: err });
      socket.data = { code, playerId };
      socket.join(code);
      ack({ ok: true, code });
      socket.emit("state", room.snapshot());
    });

    socket.on("game:settings", (s: Partial<Settings>) => {
      const c = current();
      c?.room.updateSettings(c.playerId, s ?? {});
    });

    socket.on("game:start", () => {
      const c = current();
      c?.room.start(c.playerId);
    });

    socket.on("game:type", (text: unknown) => {
      const c = current();
      c?.room.type(c.playerId, String(text ?? ""));
    });

    socket.on("game:submit", (word: unknown) => {
      const c = current();
      c?.room.submit(c.playerId, String(word ?? ""));
    });

    socket.on("chat", (text: unknown) => {
      const c = current();
      c?.room.chat(c.playerId, String(text ?? ""));
    });

    socket.on("disconnect", () => {
      const c = current();
      if (!c) return;
      c.room.disconnect(socket.id);
      if (c.room.empty) reapLater(c.room);
    });
  });
}
