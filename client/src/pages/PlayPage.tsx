import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { joinPlayer, submitAnswer, subscribeRoom } from "../game/roomStore";
import type { PublicRoomState } from "../types";
import { shouldPreserveSession } from "../lib/exitSave";
import { ExitSaveButton } from "../components/ExitSaveButton";

import "./PlayPage.css";


const PLAYER_KEY = "jamaatna_player";

type StoredPlayer = {
  roomCode: string;
  playerId: string;
  name: string;
};

export function PlayPage() {
  const [params] = useSearchParams();
  const roomFromUrl = params.get("room") || "";


  const [step, setStep] = useState<"join" | "play">("join");
  const [roomCode, setRoomCode] = useState(roomFromUrl);
  const [name, setName] = useState("");
  const [didRestore, setDidRestore] = useState(false);

  const [error, setError] = useState("");
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (roomFromUrl) setRoomCode(roomFromUrl);
  }, [roomFromUrl]);

  useEffect(() => {
    // Restore last session ONLY if user pressed "حفظ" before leaving.
    if (didRestore) return;
    const preserve = shouldPreserveSession();

    if (!preserve) return;

    const raw = sessionStorage.getItem(PLAYER_KEY);
    if (!raw) return;

    try {
      const stored = JSON.parse(raw) as StoredPlayer;
      if (!stored?.roomCode || !stored?.playerId || !stored?.name) return;
      if (roomFromUrl && stored.roomCode !== roomFromUrl) return;

      // Keep roomCode; attempt join using same playerId (resume).
      setRoomCode(stored.roomCode);
      setName(stored.name);
      setPlayerId(stored.playerId);
      setStep("play");
      setDidRestore(true);
    } catch {
      // ignore
    }
  }, [didRestore, roomFromUrl]);


  useEffect(() => {
    if (step !== "play" || !roomCode || !playerId) return;
    return subscribeRoom(roomCode, "player", (state) => {
      setRoom(state);
      if (state.phase === "question") setSelected(null);
      else if (state.phase !== "answering") setSelected(null);
    });
  }, [step, roomCode, playerId]);

  // If user navigates away without pressing “حفظ”, clear session.
  useEffect(() => {
    const onBeforeUnload = () => {
      if (!shouldPreserveSession()) {
        try {
          sessionStorage.removeItem(PLAYER_KEY);
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

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

    // Only remove the stored player session if user didn't request preserve.
    if (!shouldPreserveSession()) {
      sessionStorage.removeItem(PLAYER_KEY);
    }


    try {
      const raw = sessionStorage.getItem(PLAYER_KEY);
      const stored = raw ? (JSON.parse(raw) as StoredPlayer) : null;
      const existingPlayerId = stored?.roomCode === roomCode.trim() ? stored.playerId : undefined;

      // If we have a stored playerId for this room, try to re-join by playerId.
      const result = await joinPlayer(roomCode.trim(), trimmed, existingPlayerId);

      if (!result) {
        setError("تعذر الدخول. تأكد من رمز الغرفة وأن المضيف أنشأ اللعبة.");
        return;
      }
      setPlayerId(result.playerId);
      setRoom(result.state);
      setStep("play");
      sessionStorage.setItem(
        PLAYER_KEY,
        JSON.stringify({
          roomCode: roomCode.trim(),
          playerId: result.playerId,
          name: trimmed,
        })
      );

      // After successful join, reset preserve flag.
      // (Not strictly required, but avoids repeated auto-restore.)
      // We'll overwrite via markPreserveSession on explicit save.

    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الاتصال");
    }
  };

  const answer = async (index: number) => {
    if (!room || room.phase !== "answering" || selected !== null) return;
    setSelected(index);
    try {
      await submitAnswer(roomCode, playerId, index);
    } catch {
      setSelected(null);
      setError("فشل إرسال الإجابة");
    }
  };

  const myResult = room?.lastResults?.find((r) => r.playerId === playerId);

  if (step === "join") {
    return (
      <div className="page play-page join-step">
        <div className="join-card">
          <Avatar index={0} size={72} />
          <h1 className="display-title">انضم للتحدي</h1>
          <input
            className="input-field"
            placeholder="اسمك (إلزامي)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div style={{ width: "100%", textAlign: "right", fontSize: "0.85rem", opacity: 0.75 }}>
            عند الخروج اختر “حفظ” لإكمال نفس اللعبة عند الرجوع.
          </div>

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

          <div style={{ width: "100%", marginTop: "0.75rem" }}>
            <ExitSaveButton />
          </div>

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
              <p>إجابة صحيحة</p>
              <p className="result-points">+1000 نقطة</p>
            </>
          ) : (
            <>
              <p>إجابة خاطئة</p>
              <p className="result-points">0 نقطة</p>
            </>
          )}
        </div>
        <p className="wait-host">في انتظار المضيف...</p>
      </div>
    );
  }

  if (room.phase === "question" || !room.showOptions) {
    return (
      <div className="page play-page wait-step">
        <Avatar index={room.players.find((p) => p.id === playerId)?.avatarIndex ?? 0} size={64} />
        <h2>استعد!</h2>
        <p>السؤال على الشاشة الكبيرة — انتظر الخيارات</p>
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
              onClick={() => answer(i)}
            >
              {opt.text}
            </button>
          ))}
        </div>
        {selected !== null && <p className="locked-msg">تم تسجيل إجابتك</p>}
      </div>
    );
  }

  return (
    <div className="page play-page wait-step">
      <p>في انتظار بدء الجولة...</p>
    </div>
  );
}
