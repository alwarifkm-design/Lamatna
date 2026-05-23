import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { joinPlayer, submitAnswer, subscribeRoom } from "../game/roomStore";
import type { PublicRoomState } from "../types";
import "./PlayPage.css";

const PLAYER_KEY = "jamaatna_player";

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
    if (roomFromUrl) setRoomCode(roomFromUrl);
  }, [roomFromUrl]);

  useEffect(() => {
    if (step !== "play" || !roomCode || !playerId) return;
    return subscribeRoom(roomCode, "player", (state) => {
      setRoom(state);
      if (state.phase === "question") setSelected(null);
      else if (state.phase !== "answering") setSelected(null);
    });
  }, [step, roomCode, playerId]);

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
      const result = await joinPlayer(roomCode.trim(), trimmed);
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
