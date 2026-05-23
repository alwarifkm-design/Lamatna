import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { QuestionEditor } from "../components/QuestionEditor";
import { DEFAULT_DISPLAY_TITLE, MAX_DISPLAY_TITLE_LENGTH } from "../constants";
import {
  addQuestion,
  continueFromQuestion,
  continueFromResults,
  createGame,
  deleteQuestion,
  randomBankQuestion,
  setAgeRange,
  setDisplayTitle as saveRoomTitle,
  setTimer,
  startGame,
  subscribeRoom,
  tickTimer,
  updateQuestion,
} from "../game/roomStore";
import { useRoomCode } from "../hooks/useRoomCode";
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
  const [titleDraft, setTitleDraft] = useState(DEFAULT_DISPLAY_TITLE);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!roomCode) {
      setRoom(null);
      return;
    }
    return subscribeRoom(roomCode, "admin", setRoom, () => {
      clearRoomCode();
      setRoom(null);
    });
  }, [roomCode, clearRoomCode]);

  useEffect(() => {
    if (room?.displayTitle) setTitleDraft(room.displayTitle);
  }, [room?.displayTitle]);

  useEffect(() => {
    if (!roomCode || room?.phase !== "answering") return;
    const id = setInterval(() => {
      tickTimer(roomCode).catch(console.error);
    }, 1000);
    return () => clearInterval(id);
  }, [roomCode, room?.phase]);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (err) {
      alert(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setBusy(false);
    }
  };

  const createNewGame = () =>
    run(async () => {
      const code = await createGame();
      saveRoomCode(code);
    });

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
            onClick={createNewGame}
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
        <div className="title-row">
          <input
            className="input-field"
            type="text"
            maxLength={MAX_DISPLAY_TITLE_LENGTH}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => run(() => saveRoomTitle(roomCode, titleDraft))}
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
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => run(() => setAgeRange(roomCode, ageMin, ageMax))}
              disabled={busy}
            >
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
              onClick={() => run(() => randomBankQuestion(roomCode))}
              disabled={busy}
            >
              سؤال عشوائي من البنك
            </button>
          </div>

          {editing && (
            <QuestionEditor
              initial={editing === "new" ? undefined : editing}
              onSave={(qu) =>
                run(async () => {
                  if (qu.id) await updateQuestion(roomCode, qu as Question);
                  else await addQuestion(roomCode, qu);
                  setEditing(null);
                })
              }
              onCancel={() => setEditing(null)}
            />
          )}

          <ul className="question-list">
            {room.questions.map((qu, i) => (
              <li key={qu.id}>
                <span>
                  {i + 1}. {qu.text.slice(0, 60)}
                  {qu.fromBank && <em className="bank-tag"> (بنك)</em>}
                </span>
                <div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setEditing(qu)}
                  >
                    تعديل
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => run(() => deleteQuestion(roomCode, qu.id))}
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
            onClick={() =>
              run(async () => {
                const ok = await startGame(roomCode);
                if (!ok) alert("أضف سؤالاً واحداً على الأقل");
              })
            }
            disabled={room.questions.length === 0 || busy}
          >
            بدء اللعبة
          </button>
        </section>
      )}

      {inGame && room.phase !== "finished" && (
        <section className="admin-section card admin-live">
          <p className="phase-badge">المرحلة: {phaseLabel(room.phase)}</p>
          {q && <h3 style={{ marginTop: "0.75rem" }}>{q.text}</h3>}

          {room.phase === "question" && (
            <>
              <div className="timer-picker">
                <span>وقت الإجابة:</span>
                {TIMER_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`btn btn-outline btn-sm ${room.timerSeconds === t ? "active" : ""}`}
                    onClick={() => run(() => setTimer(roomCode, t))}
                    disabled={busy}
                  >
                    {t} ث
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-primary btn-start"
                onClick={() =>
                  run(async () => {
                    const ok = await continueFromQuestion(roomCode);
                    if (!ok) alert("تعذر المتابعة");
                  })
                }
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
              onClick={() =>
                run(async () => {
                  const ok = await continueFromResults(roomCode);
                  if (!ok) alert("تعذر المتابعة");
                })
              }
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
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              clearRoomCode();
              createNewGame();
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
