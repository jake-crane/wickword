"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket() {
  socket ??= io();
  return socket;
}

function read(storage: () => Storage, key: string) {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: string) {
  try {
    storage().setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode); identity just won't persist.
  }
}

// Nickname is remembered across visits. Player id is per tab, so two tabs
// in one browser act as two players (handy for testing) but reloads rejoin.
export function getName() {
  return read(() => localStorage, "ww:name") ?? "";
}

export function setName(name: string) {
  write(() => localStorage, "ww:name", name);
}

let fallbackId: string | null = null;
export function getPlayerId() {
  let id = read(() => sessionStorage, "ww:pid");
  if (!id) {
    // Not crypto.randomUUID: it's missing on plain-http LAN addresses.
    id = fallbackId ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
    fallbackId = id;
    write(() => sessionStorage, "ww:pid", id);
  }
  return id;
}
