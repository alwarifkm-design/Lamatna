import { io, Socket } from "socket.io-client";

function resolveServerUrl(): string {
  const fromEnv = import.meta.env.VITE_SERVER_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV) return "http://localhost:3001";
  console.warn("[لمة العائلة] عيّن VITE_SERVER_URL في Vercel لربط الخادم.");
  return window.location.origin;
}

const SERVER_URL = resolveServerUrl();

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, { autoConnect: true, transports: ["websocket", "polling"] });
  }
  return socket;
}

export function getJoinUrl(roomCode: string): string {
  const base = window.location.origin;
  return `${base}/play?room=${roomCode}`;
}
