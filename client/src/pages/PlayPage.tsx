import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { getSocket, waitForConnection } from "../socket";
import type { PublicRoomState } from "../types";
import "./PlayPage.css";

const PLAYER_KEY = "jamaatna_player";

interface StoredPlayer {
  roomCode: string;
  playerId: string;
  name: string;
}

export function PlayPage() {
  const [params] = useSearchParams();
  const roomFromUrl = params.get("room") || "";

  const [step, setStep] = useState<"join" | "play">("join");
  const [roomCode, setRoomCode] = useState(roomFromUrl);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(PLAYER_KEY);
    if (stored) {
      try {
        const p: StoredPlayer = JSON.parse(stored);
        if (p.roomCode && p.playerId) {
          setRoomCode(p.roomCode);
          setName(p.name);
          setPlayerId(p.playerId);
        }
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (roomFromUrl) setRoomCode(roomFromUrl);
  }, [roomFromUrl]);

  useEffect(() => {
    if (step !== "play" || !roomCode || !playerId) return;

    const socket = getSocket();
    const onUpdate = (state: PublicRoomState) => {
      setRoom(state);
      if (state.phase === "question" || state.phase === "answering") {
        if (state.phase === "question") setSelected(null);
      }
      if (state.phase === "answering" && selected !== null) {
        /* keep selection */
      } else if (state.phase !== "answering") {
        setSelected(null);
      }
    };

    socket.on("room:update", onUpdate);
    return () => {
      socket.off("room:update", onUpdate);
    };
  }, [step, roomCode, playerId, selected]);

  const join = async () => {
    setError("");
    const trimmed = name.trim();
    if (!trimmed) {
      setError("يجب كتابة اسمك للمشاركة");
      return;
    }
    if (!roomCode.trim()) {
      setError("أدخل رمز الغرفة");
      return;
    }

    sessionStorage.removeItem(PLAYER_KEY);

    try {
      await waitForConnection();
      getSocket().emit(
        "player:join",
        roomCode.trim(),
        trimmed,
        (res: { ok: boolean; message?: string; playerId?: string; state?: PublicRoomState }) => {
          if (!res.ok) {
            setError(res.message || "فشل الدخول");
            return;
          }
          const pid = res.playerId!;
          setPlayerId(pid);
          setRoom(res.state || null);
          setStep("play");
          sessionStorage.setItem(
            PLAYER_KEY,
            JSON.stringify({ roomCode: roomCode.trim(), playerId: pid, name: trimmed })
          );
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الاتصال بالخادم");
    }
  };

  const submitAnswer = async (index: number) => {
    if (!room || room.phase !== "answering" || selected !== null) return;
    setSelected(index);
    try {
      await waitForConnection();
      getSocket().emit("player:answer", roomCode, playerId, index);
    } catch {
      setSelected(null);
      setError("فُقد الاتصال — حاول مرة أخرى");
    }
  };

  const myResult = room?.lastResults?.find((r) => r.playerId === playerId);

  if (step === "join") {
    return (
      <div className="page play-page join-step">
        <div className="join-card">
          <Avatar index={0} size={72} />
          <h1 className="display-title">انضم للتحدي</h1>
          <p className="join-sub">أدخل اسمك ورمز الغرفة</p>

          <input
            className="input-field"
            placeholder="اسمك (إلزامي)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
          <input
            className="input-field"
            placeholder="رمز الغرفة"
            inputMode="numeric"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            style={{ marginTop: "0.75rem" }}
          />
          {error && <p className="play-error">{error}</p>}
          <button type="button" className="btn btn-secondary btn-join" onClick={join}>
            دخول اللعبة
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="page play-page">
        <p style={{ textAlign: "center", marginTop: "3rem" }}>جاري الاتصال...</p>
      </div>
    );
  }

  if (room.phase === "finished") {
    const sorted = [...room.players].sort((a, b) => b.score - a.score);
    const rank = sorted.findIndex((p) => p.id === playerId) + 1;
    const me = sorted.find((p) => p.id === playerId);
    return (
      <div className="page play-page finish-step">
        <h2>انتهت اللعبة!</h2>
        {me && (
          <>
            <p className="final-rank">مرتبتك: {rank}</p>
            <p className="final-score">مجموع نقاطك: {me.score}</p>
          </>
        )}
      </div>
    );
  }

  if (room.phase === "results" && myResult) {
    return (
      <div className="page play-page result-step">
        <div className={`result-banner ${myResult.correct ? "correct" : "wrong"}`}>
          {myResult.correct ? (
            <>
              <span className="result-icon">✓</span>
              <p>إجابة صحيحة</p>
              <p className="result-points">القيمة: +1000 نقطة</p>
            </>
          ) : (
            <>
              <span className="result-icon">✗</span>
              <p>إجابة خاطئة</p>
              <p className="result-points">0 نقطة</p>
            </>
          )}
        </div>
        <p className="wait-host">في انتظار المضيف للسؤال التالي...</p>
      </div>
    );
  }

  if (room.phase === "question" || !room.showOptions) {
    return (
      <div className="page play-page wait-step">
        <Avatar index={room.players.find((p) => p.id === playerId)?.avatarIndex ?? 0} size={64} />
        <h2>استعد!</h2>
        <p>يُعرض السؤال الآن على الشاشة الكبيرة — انتظر ظهور الخيارات</p>
        <div className="pulse-dot" />
      </div>
    );
  }

  if (room.phase === "answering" && room.currentQuestion) {
    const q = room.currentQuestion;
    return (
      <div className="page play-page answer-step">
        <div className="mobile-timer">{room.timerRemaining}</div>
        <h2 className="mobile-q">{q.text}</h2>
        <div className="answer-buttons">
          {q.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              className={`answer-btn ${selected === i ? "selected" : ""}`}
              disabled={selected !== null}
              onClick={() => submitAnswer(i)}
            >
              {opt.text}
            </button>
          ))}
        </div>
        {selected !== null && <p className="locked-msg">تم تسجيل إجابتك — انتظر البقية</p>}
      </div>
    );
  }

  return (
    <div className="page play-page wait-step">
      <p>في انتظار بدء الجولة...</p>
    </div>
  );
}
