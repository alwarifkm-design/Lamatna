import { io, Socket } from "socket.io-client";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

const STORAGE_KEY = "jamaatna_server_url";

let socket: Socket | null = null;
let activeUrl: string | null = null;
const statusListeners = new Set<(status: ConnectionStatus) => void>();

function setStatus(status: ConnectionStatus) {
  statusListeners.forEach((fn) => fn(status));
}

function cleanUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

function fromEnv(): string | null {
  const v = import.meta.env.VITE_SERVER_URL;
  return v ? cleanUrl(v) : null;
}

function fromStorage(): string | null {
  const v = localStorage.getItem(STORAGE_KEY);
  return v ? cleanUrl(v) : null;
}

/** رابط خادم Render — من Vercel أو من الإعداد اليدوي في المتصفح */
export function getServerUrl(): string | null {
  return fromEnv() || fromStorage() || (import.meta.env.DEV ? "http://localhost:3001" : null);
}

export function isServerConfigured(): boolean {
  return getServerUrl() !== null;
}

export function isEnvServerConfigured(): boolean {
  return fromEnv() !== null;
}

/** حفظ رابط الخادم يدوياً (حل فوري بدون إعادة نشر Vercel) */
export function setManualServerUrl(url: string): void {
  const cleaned = cleanUrl(url);
  if (!/^https?:\/\//i.test(cleaned)) {
    throw new Error("أدخل رابطاً يبدأ بـ https://");
  }
  localStorage.setItem(STORAGE_KEY, cleaned);
  resetSocket();
  getSocket();
}

export function clearManualServerUrl(): void {
  localStorage.removeItem(STORAGE_KEY);
  resetSocket();
}

function resetSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  activeUrl = null;
}

export function subscribeConnectionStatus(fn: (status: ConnectionStatus) => void): () => void {
  statusListeners.add(fn);
  fn(socket?.connected ? "connected" : getServerUrl() ? "connecting" : "error");
  return () => statusListeners.delete(fn);
}

export function getSocket(): Socket {
  const url = getServerUrl();
  if (!url) {
    throw new Error("لم يُضبط رابط الخادم");
  }

  if (socket && activeUrl !== url) {
    resetSocket();
  }

  if (!socket) {
    activeUrl = url;
    socket = io(url, {
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
          "تعذر الاتصال بالخادم. تأكد أن Render يعمل وأن الرابط صحيح (https://...onrender.com)"
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
