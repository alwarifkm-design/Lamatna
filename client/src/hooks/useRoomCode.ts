import { useCallback, useEffect, useState } from "react";

const ROOM_KEY = "jamaatna_room";

export function useRoomCode() {
  const [roomCode, setRoomCode] = useState(() => localStorage.getItem(ROOM_KEY) || "");

  const saveRoomCode = useCallback((code: string) => {
    localStorage.setItem(ROOM_KEY, code);
    setRoomCode(code);
  }, []);

  const clearRoomCode = useCallback(() => {
    localStorage.removeItem(ROOM_KEY);
    setRoomCode("");
  }, []);

  useEffect(() => {
    const sync = () => {
      const stored = localStorage.getItem(ROOM_KEY) || "";
      setRoomCode((prev) => (prev === stored ? prev : stored));
    };
    window.addEventListener("storage", sync);
    const id = window.setInterval(sync, 1500);
    return () => {
      window.removeEventListener("storage", sync);
      clearInterval(id);
    };
  }, []);

  return { roomCode, saveRoomCode, clearRoomCode };
}
