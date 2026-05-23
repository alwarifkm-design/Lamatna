import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { QuestionEditor } from "../components/QuestionEditor";
import { DEFAULT_DISPLAY_TITLE, MAX_DISPLAY_TITLE_LENGTH } from "../constants";
import { useRoomCode } from "../hooks/useRoomCode";
import { getSocket, isServerConfigured, waitForConnection } from "../socket";
import type { PublicRoomState, Question } from "../types";
import "./AdminPage.css";

const TIMER_OPTIONS = [15, 20, 30, 45, 60];

export function AdminPage() {
  const navigate = useNavigate();
  const { roomCode, saveRoomCode, clearRoomCode } = useRoomCode();
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [editing, setEditing] = useState<Question | null | "new">(null);
  const [ageMin, setAgeMin] = useState(7);
  const [ageMax, setAgeMax] = useState(60);
  const [displayTitle, setDisplayTitle] = useState(DEFAULT_DISPLAY_TITLE);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!roomCode || !isServerConfigured()) {
      setRoom(null);
      return;
    }

    const socket = getSocket();
    const onUpdate = (state: PublicRoomState) => {
      setRoom(state);
      setAgeMin(state.ageMin);
      setAgeMax(state.ageMax);
      setDisplayTitle(state.displayTitle || DEFAULT_DISPLAY_TITLE);
    };
    const onMissing = () => {
      clearRoomCode();
      setRoom(null);
    };

    if (roomCode) {
      socket.emit("admin:join", roomCode);
      socket.on("room:update", onUpdate);
      socket.on("room:missing", onMissing);
    } else {
      setRoom(null);
    }

    return () => {
      socket.off("room:update", onUpdate);
      socket.off("room:missing", onMissing);
    };
  }, [roomCode, clearRoomCode]);

  const withConnection = async (action: () => void) => {
    if (busy) return;
    setBusy(true);
    try {
      await waitForConnection();
      action();
    } catch (err) {
      alert(err instanceof Error ? err.message : "فشل الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  };

  const createGame = () => {
    withConnection(() => {
      getSocket().emit("admin:createGame", (newCode: string) => {
        saveRoomCode(newCode);
        getSocket().emit("admin:join", newCode);
      });
    });
  };

  const setAge = () => {
    if (!roomCode) return;
    withConnection(() => {
      getSocket().emit("admin:setAge", roomCode, ageMin, ageMax);
    });
  };

  const saveDisplayTitle = () => {
    if (!roomCode) return;
    withConnection(() => {
      getSocket().emit("admin:setDisplayTitle", roomCode, displayTitle);
    });
  };

  const addQuestion = (q: Omit<Question, "id"> & { id?: string }) => {
    if (!roomCode) return;
    withConnection(() => {
      if (q.id) {
        getSocket().emit("admin:updateQuestion", roomCode, q as Question, () => setEditing(null));
      } else {
        getSocket().emit("admin:addQuestion", roomCode, q, () => setEditing(null));
      }
    });
  };

  const deleteQuestion = (id: string) => {
    if (!roomCode || !confirm("حذف هذا السؤال؟")) return;
    withConnection(() => {
      getSocket().emit("admin:deleteQuestion", roomCode, id, () => {});
    });
  };

  const randomQuestion = () => {
    if (!roomCode) return;
    withConnection(() => {
      getSocket().emit("admin:randomQuestion", roomCode, () => {});
    });
  };

  const setTimer = (sec: number) => {
    if (!roomCode) return;
    withConnection(() => {
      getSocket().emit("admin:setTimer", roomCode, sec);
    });
  };

  const startGame = () => {
    if (!roomCode) return;
    withConnection(() => {
      getSocket().emit("admin:startGame", roomCode, (ok: boolean) => {
        if (!ok) alert("أضف سؤالاً واحداً على الأقل قبل البدء");
      });
    });
  };

  const continuePhase = () => {
    if (!roomCode) return;
    withConnection(() => {
      getSocket().emit("admin:continue", roomCode, (ok: boolean) => {
        if (!ok) alert("تعذر المتابعة");
      });
    });
  };

  if (!roomCode || !room) {
    return (
      <div className="page admin-page">
        <header className="admin-header">
          <h1>لوحة الإدارة</h1>
          <Link to="/" className="btn btn-ghost">
            العودة للعرض
          </Link>
        </header>
        <div className="card" style={{ maxWidth: 480, margin: "2rem auto", textAlign: "center" }}>
          <p style={{ marginBottom: "1.5rem" }}>
            أنشئ لعبة جديدة لبدء التحدي. سيظهر الباركود ورمز الغرفة على شاشة العرض بعد الإنشاء.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={createGame}
            disabled={busy}
          >
            {busy ? "جاري الإنشاء..." : "إنشاء لعبة جديدة"}
          </button>
        </div>
      </div>
    );
  }

  const inGame = room.gameStarted;
  const q = room.currentQuestion;

  return (
    <div className="page admin-page">
      <header className="admin-header">
        <div>
          <h1>لوحة الإدارة</h1>
          <p className="admin-room">
            رمز الغرفة: <strong>{room.code}</strong>
          </p>
        </div>
        <div className="admin-actions-top">
          <Link to="/" className="btn btn-outline">
            شاشة العرض
          </Link>
          <button type="button" className="btn btn-ghost" onClick={() => navigate("/")}>
            إخفاء
          </button>
        </div>
      </header>

      <section className="admin-section card title-section">
        <h2>عنوان شاشة العرض</h2>
        <p className="title-hint">يظهر كعنوان كبير على شاشة البروجكتر (الانتظار والانضمام)</p>
        <div className="title-row">
          <input
            className="input-field"
            type="text"
            maxLength={MAX_DISPLAY_TITLE_LENGTH}
            value={displayTitle}
            onChange={(e) => setDisplayTitle(e.target.value)}
            placeholder={DEFAULT_DISPLAY_TITLE}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={saveDisplayTitle}
            disabled={busy}
          >
            حفظ العنوان
          </button>
        </div>
      </section>

      {!inGame && (
        <section className="admin-section card">
          <h2>إعداد اللعبة</h2>

          <div className="age-row">
            <label>
              العمر من
              <input
                type="number"
                className="input-field"
                min={5}
                max={99}
                value={ageMin}
                onChange={(e) => setAgeMin(Number(e.target.value))}
              />
            </label>
            <label>
              إلى
              <input
                type="number"
                className="input-field"
                min={5}
                max={99}
                value={ageMax}
                onChange={(e) => setAgeMax(Number(e.target.value))}
              />
            </label>
            <button type="button" className="btn btn-outline" onClick={setAge} disabled={busy}>
              تطبيق
            </button>
          </div>

          <div className="question-toolbar">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setEditing("new")}
              disabled={busy}
            >
              إضافة سؤال
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={randomQuestion}
              disabled={busy}
            >
              سؤال عشوائي من البنك
            </button>
          </div>

          {editing && (
            <QuestionEditor
              initial={editing === "new" ? undefined : editing}
              onSave={addQuestion}
              onCancel={() => setEditing(null)}
            />
          )}

          <ul className="question-list">
            {room.questions.map((qu, i) => (
              <li key={qu.id}>
                <span>
                  {i + 1}. {qu.text.slice(0, 60)}
                  {qu.text.length > 60 ? "…" : ""}
                  {qu.fromBank && <em className="bank-tag"> (بنك)</em>}
                </span>
                <div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setEditing(qu)}
                    disabled={busy}
                  >
                    تعديل
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => deleteQuestion(qu.id)}
                    disabled={busy}
                  >
                    حذف
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <p className="players-count">متصلون: {room.playerCount}</p>

          <button
            type="button"
            className="btn btn-primary btn-start"
            onClick={startGame}
            disabled={room.questions.length === 0 || busy}
          >
            بدء اللعبة
          </button>
        </section>
      )}

      {inGame && room.phase !== "finished" && (
        <section className="admin-section card admin-live">
          <p className="phase-badge">المرحلة: {phaseLabel(room.phase)}</p>
          <p>
            السؤال {room.currentIndex + 1} من {room.totalQuestions}
          </p>

          {q && (
            <div className="admin-question-preview">
              <h3>{q.text}</h3>
              <ul>
                {q.options.map((o, i) => (
                  <li key={i} className={i === q.correctIndex ? "correct" : ""}>
                    {o.text} {i === q.correctIndex && "✓"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {room.phase === "question" && (
            <>
              <div className="timer-picker">
                <span>وقت الإجابة:</span>
                {TIMER_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`btn btn-outline btn-sm ${room.timerSeconds === t ? "active" : ""}`}
                    onClick={() => setTimer(t)}
                    disabled={busy}
                  >
                    {t} ث
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-primary btn-start"
                onClick={continuePhase}
                disabled={busy}
              >
                متابعة — إظهار الخيارات وبدء العداد
              </button>
            </>
          )}

          {(room.phase === "answering" || room.phase === "results") && (
            <p className="timer-live">
              العداد: {room.timerRemaining} ث — أجاب {room.answeredCount}/{room.playerCount}
            </p>
          )}

          {room.phase === "results" && (
            <button
              type="button"
              className="btn btn-primary btn-start"
              onClick={continuePhase}
              disabled={busy}
            >
              متابعة — السؤال التالي
            </button>
          )}
        </section>
      )}

      {room.phase === "finished" && (
        <section className="admin-section card">
          <h2>انتهت اللعبة</h2>
          <p>تظهر منصة التتويج على شاشة العرض.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              clearRoomCode();
              createGame();
            }}
            disabled={busy}
          >
            لعبة جديدة
          </button>
        </section>
      )}
    </div>
  );
}

function phaseLabel(phase: string): string {
  const map: Record<string, string> = {
    question: "عرض السؤال",
    answering: "الإجابة",
    results: "النتائج",
    lobby: "الانتظار",
  };
  return map[phase] ?? phase;
}
