import { io, Socket } from "socket.io-client";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

function resolveServerUrl(): string | null {
  const fromEnv = import.meta.env.VITE_SERVER_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV) return "http://localhost:3001";
  return null;
}

const SERVER_URL = resolveServerUrl();

let socket: Socket | null = null;
const statusListeners = new Set<(status: ConnectionStatus) => void>();

function setStatus(status: ConnectionStatus) {
  statusListeners.forEach((fn) => fn(status));
}

export function isServerConfigured(): boolean {
  return SERVER_URL !== null;
}

export function getServerUrl(): string | null {
  return SERVER_URL;
}

export function subscribeConnectionStatus(fn: (status: ConnectionStatus) => void): () => void {
  statusListeners.add(fn);
  const s = socket;
  fn(s?.connected ? "connected" : SERVER_URL ? "connecting" : "error");
  return () => statusListeners.delete(fn);
}

export function getSocket(): Socket {
  if (!SERVER_URL) {
    throw new Error("لم يُضبط VITE_SERVER_URL على Vercel");
  }
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: true,
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 15,
      timeout: 20000,
    });
    socket.on("connect", () => setStatus("connected"));
    socket.on("disconnect", () => setStatus("disconnected"));
    socket.on("connect_error", () => setStatus("error"));
    setStatus("connecting");
  }
  return socket;
}

export function waitForConnection(timeoutMs = 20000): Promise<Socket> {
  const s = getSocket();
  if (s.connected) return Promise.resolve(s);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "تعذر الاتصال بالخادم. تأكد من Render يعمل ومن VITE_SERVER_URL على Vercel."
        )
      );
    }, timeoutMs);

    const onConnect = () => {
      cleanup();
      resolve(s);
    };

    const cleanup = () => {
      clearTimeout(timer);
      s.off("connect", onConnect);
    };

    s.once("connect", onConnect);
    if (!s.active) s.connect();
  });
}

export function getJoinUrl(roomCode: string): string {
  return `${window.location.origin}/play?room=${roomCode}`;
}
