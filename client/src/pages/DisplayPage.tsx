import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";
import { AdminPinModal } from "../components/AdminPinModal";
import { Avatar } from "../components/Avatar";
import { Logo } from "../components/Logo";
import { getJoinUrl, getSocket } from "../socket";
import { DEFAULT_DISPLAY_TITLE } from "../constants";
import type { PublicRoomState } from "../types";
import "./DisplayPage.css";

const ROOM_KEY = "jamaatna_room";

export function DisplayPage() {
  const navigate = useNavigate();
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [showPin, setShowPin] = useState(false);
  const code = localStorage.getItem(ROOM_KEY);

  useEffect(() => {
    const socket = getSocket();
    const onUpdate = (state: PublicRoomState) => setRoom(state);

    if (code) {
      socket.emit("display:join", code);
      socket.on("room:update", onUpdate);
    }

    return () => {
      socket.off("room:update", onUpdate);
    };
  }, [code]);

  const joinUrl = code ? getJoinUrl(code) : "";
  const heroTitle = room?.displayTitle?.trim() || DEFAULT_DISPLAY_TITLE;

  const leaderboard = room
    ? [...room.players].sort((a, b) => b.score - a.score)
    : [];

  const renderContent = () => {
    if (!room || !room.gameCreated) {
      return (
        <div className="display-welcome">
          <Logo size={120} className="display-logo" />
          <h1 className="display-hero">{heroTitle}</h1>
          <p className="display-sub">تحدي العائلة التفاعلي</p>
          <p className="display-hint">في انتظار تجهيز اللعبة من قبل المضيف...</p>
        </div>
      );
    }

    if (!room.gameStarted) {
      return (
        <div className="display-lobby">
          <Logo size={100} className="display-logo" />
          <h1 className="display-hero">{heroTitle}</h1>
          <p className="display-sub">امسح الباركود أو أدخل الرمز للانضمام</p>
          <div className="qr-section">
            <div className="qr-box">
              <QRCodeSVG value={joinUrl} size={220} level="M" />
            </div>
            <div className="qr-divider" />
            <div className="room-code-block">
              <span className="room-label">رمز الغرفة</span>
              <span className="room-code">{room.code}</span>
            </div>
          </div>
          <p className="player-wait">
            المتسابقون المتصلون: <strong>{room.playerCount}</strong>
          </p>
          <div className="lobby-avatars">
            {room.players.map((p) => (
              <div key={p.id} className="lobby-player" title={p.name}>
                <Avatar index={p.avatarIndex} size={48} />
                <span>{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (room.phase === "finished") {
      const top3 = leaderboard.slice(0, 3);
      const rest = leaderboard.slice(3);
      const medals = ["🥇", "🥈", "🥉"];
      const podiumClass = ["gold", "silver", "bronze"];

      return (
        <div className="display-finish">
          <h1 className="display-hero">مبروك الفائزون!</h1>
          <div className="podium">
            {[1, 0, 2].map((rankIdx) => {
              const p = top3[rankIdx];
              if (!p) return <div key={rankIdx} className="podium-slot empty" />;
              return (
                <div
                  key={p.id}
                  className={`podium-slot ${podiumClass[rankIdx]} order-${rankIdx}`}
                >
                  <span className="podium-medal">{medals[rankIdx]}</span>
                  <Avatar index={p.avatarIndex} size={64} />
                  <span className="podium-name">{p.name}</span>
                  <span className="podium-score">{p.score} نقطة</span>
                  <span className="podium-rank">المركز {rankIdx + 1}</span>
                </div>
              );
            })}
          </div>
          {rest.length > 0 && (
            <details className="rest-list">
              <summary>بقية المتسابقين ({rest.length})</summary>
              <ul>
                {rest.map((p, i) => (
                  <li key={p.id}>
                    <span>المركز {i + 4}</span>
                    <span>{p.name}</span>
                    <span>{p.score} نقطة</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      );
    }

    const q = room.currentQuestion;
    const qNum = room.currentIndex + 1;
    const total = room.totalQuestions || "?";

    if (room.phase === "results") {
      const sorted = [...room.players].sort((a, b) => b.score - a.score);
      return (
        <div className="display-results">
          <h2 className="display-title">لوحة النتائج</h2>
          <p className="q-progress">
            السؤال {qNum} / {total}
          </p>
          <ul className="leaderboard">
            {sorted.map((p, i) => {
              const result = room.lastResults.find((r) => r.playerId === p.id);
              return (
                <li key={p.id} className={i === 0 ? "leader" : ""}>
                  <span className="rank">{i + 1}</span>
                  <Avatar index={p.avatarIndex} size={40} />
                  <span className="name">{p.name}</span>
                  <span className="score">{p.score}</span>
                  {result && (
                    <span className={`badge ${result.correct ? "ok" : "no"}`}>
                      {result.correct ? "+1000" : "0"}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      );
    }

    return (
      <div className="display-game">
        <p className="q-progress">
          السؤال {qNum} / {total}
        </p>
        {q && <h2 className="question-text">{q.text}</h2>}
        {(room.phase === "answering" || room.showOptions) && (
          <div className="timer-ring">
            <span className="timer-num">{room.timerRemaining}</span>
            <span className="timer-label">ثانية</span>
          </div>
        )}
        {room.showOptions && q && (
          <div className="options-grid">
            {q.options.map((opt, i) => (
              <div key={i} className={`option-card opt-${i}`}>
                {opt.text}
              </div>
            ))}
          </div>
        )}
        {room.phase === "answering" && (
          <p className="answer-progress">
            أجاب {room.answeredCount} من {room.playerCount}
          </p>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="frame-border" />
      <div className="page display-page">
        {renderContent()}
      </div>
      <button
        type="button"
        className="settings-fab"
        title="إعدادات الإدارة"
        onClick={() => setShowPin(true)}
        aria-label="إعدادات"
      >
        ⚙
      </button>
      {showPin && (
        <AdminPinModal
          onClose={() => setShowPin(false)}
          onSuccess={() => {
            setShowPin(false);
            navigate("/admin");
          }}
        />
      )}
    </>
  );
}
