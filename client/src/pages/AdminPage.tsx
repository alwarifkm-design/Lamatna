import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { QuestionEditor } from "../components/QuestionEditor";
import { getSocket } from "../socket";
import { DEFAULT_DISPLAY_TITLE, MAX_DISPLAY_TITLE_LENGTH } from "../constants";
import type { PublicRoomState, Question } from "../types";
import "./AdminPage.css";

const ROOM_KEY = "jamaatna_room";
const TIMER_OPTIONS = [15, 20, 30, 45, 60];

export function AdminPage() {
  const navigate = useNavigate();
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [editing, setEditing] = useState<Question | null | "new">(null);
  const [ageMin, setAgeMin] = useState(7);
  const [ageMax, setAgeMax] = useState(60);
  const [displayTitle, setDisplayTitle] = useState(DEFAULT_DISPLAY_TITLE);
  const code = localStorage.getItem(ROOM_KEY);

  useEffect(() => {
    const socket = getSocket();
    const onUpdate = (state: PublicRoomState) => {
      setRoom(state);
      setAgeMin(state.ageMin);
      setAgeMax(state.ageMax);
      setDisplayTitle(state.displayTitle || DEFAULT_DISPLAY_TITLE);
    };

    if (code) {
      socket.emit("admin:join", code);
      socket.on("room:update", onUpdate);
    }

    return () => {
      socket.off("room:update", onUpdate);
    };
  }, [code]);

  const createGame = () => {
    getSocket().emit("admin:createGame", (newCode: string) => {
      localStorage.setItem(ROOM_KEY, newCode);
      getSocket().emit("admin:join", newCode);
      window.location.href = "/admin";
    });
  };

  const setAge = () => {
    if (!code) return;
    getSocket().emit("admin:setAge", code, ageMin, ageMax);
  };

  const saveDisplayTitle = () => {
    if (!code) return;
    getSocket().emit("admin:setDisplayTitle", code, displayTitle);
  };

  const addQuestion = (q: Omit<Question, "id"> & { id?: string }) => {
    if (!code) return;
    if (q.id) {
      getSocket().emit("admin:updateQuestion", code, q as Question, () => setEditing(null));
    } else {
      getSocket().emit("admin:addQuestion", code, q, () => setEditing(null));
    }
  };

  const deleteQuestion = (id: string) => {
    if (!code || !confirm("حذف هذا السؤال؟")) return;
    getSocket().emit("admin:deleteQuestion", code, id, () => {});
  };

  const randomQuestion = () => {
    if (!code) return;
    getSocket().emit("admin:randomQuestion", code, () => {});
  };

  const setTimer = (sec: number) => {
    if (!code) return;
    getSocket().emit("admin:setTimer", code, sec);
  };

  const startGame = () => {
    if (!code) return;
    getSocket().emit("admin:startGame", code, (ok: boolean) => {
      if (!ok) alert("أضف سؤالاً واحداً على الأقل قبل البدء");
    });
  };

  const continuePhase = () => {
    if (!code) return;
    getSocket().emit("admin:continue", code, (ok: boolean) => {
      if (!ok) alert("تعذر المتابعة");
    });
  };

  if (!code || !room) {
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
          <button type="button" className="btn btn-primary" onClick={createGame}>
            إنشاء لعبة جديدة
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
          <button type="button" className="btn btn-primary" onClick={saveDisplayTitle}>
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
            <button type="button" className="btn btn-outline" onClick={setAge}>
              تطبيق
            </button>
          </div>

          <div className="question-toolbar">
            <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
              إضافة سؤال
            </button>
            <button type="button" className="btn btn-secondary" onClick={randomQuestion}>
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
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(qu)}>
                    تعديل
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteQuestion(qu.id)}>
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
            disabled={room.questions.length === 0}
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
                  >
                    {t} ث
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn-primary btn-start" onClick={continuePhase}>
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
            <button type="button" className="btn btn-primary btn-start" onClick={continuePhase}>
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
              localStorage.removeItem(ROOM_KEY);
              createGame();
            }}
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
