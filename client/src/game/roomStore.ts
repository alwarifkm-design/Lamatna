import bankQuestions from "../data/questionBank.json";
import { DEFAULT_DISPLAY_TITLE, MAX_DISPLAY_TITLE_LENGTH } from "../constants";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";
import type { PublicRoomState, Question } from "../types";
import type { InternalPlayer, RoomData } from "./roomTypes";

export const ADMIN_CODE = "242011";
const POINTS_CORRECT = 1000;

function newId(): string {
  return crypto.randomUUID();
}

function randomRoomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function emptyRoomData(): RoomData {
  return {
    displayTitle: DEFAULT_DISPLAY_TITLE,
    gameCreated: false,
    gameStarted: false,
    phase: "idle",
    ageMin: 7,
    ageMax: 60,
    questions: [],
    currentIndex: 0,
    timerSeconds: 30,
    timerRemaining: 0,
    players: [],
    lastResults: [],
    usedBankIds: [],
  };
}

export function verifyAdmin(pin: string): boolean {
  return pin === ADMIN_CODE;
}

export function toPublicState(
  code: string,
  data: RoomData,
  forDisplay = false
): PublicRoomState {
  const currentQuestion =
    data.gameStarted && data.currentIndex < data.questions.length
      ? data.questions[data.currentIndex]
      : null;

  const showOptions = data.phase === "answering";

  return {
    code,
    displayTitle: data.displayTitle,
    gameCreated: data.gameCreated,
    gameStarted: data.gameStarted,
    phase: data.phase,
    ageMin: data.ageMin,
    ageMax: data.ageMax,
    questions: forDisplay ? [] : data.questions,
    currentIndex: data.currentIndex,
    timerSeconds: data.timerSeconds,
    timerRemaining: data.timerRemaining,
    players: data.players.map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      avatarIndex: p.avatarIndex,
    })),
    currentQuestion,
    showOptions,
    lastResults: data.lastResults,
    playerCount: data.players.length,
    answeredCount: data.players.filter((p) => p.answered).length,
    totalQuestions: data.questions.length,
  };
}

async function loadData(code: string): Promise<RoomData | null> {
  const { data, error } = await getSupabase()
    .from("game_rooms")
    .select("data")
    .eq("code", code)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return data.data as RoomData;
}

async function saveData(code: string, room: RoomData): Promise<void> {
  const { error } = await getSupabase()
    .from("game_rooms")
    .upsert({ code, data: room, updated_at: new Date().toISOString() });

  if (error) throw new Error(error.message);
}

async function mutate(
  code: string,
  fn: (room: RoomData) => RoomData | null
): Promise<RoomData | null> {
  const room = await loadData(code);
  if (!room) return null;
  const next = fn(room);
  if (!next) return null;
  await saveData(code, next);
  return next;
}

export type RoomRole = "admin" | "display" | "player";

export function subscribeRoom(
  code: string,
  role: RoomRole,
  onUpdate: (state: PublicRoomState) => void,
  onMissing?: () => void
): () => void {
  const supabase = getSupabase();
  const forDisplay = role === "display" || role === "player";

  const apply = (data: RoomData | null) => {
    if (!data) {
      onMissing?.();
      return;
    }
    onUpdate(toPublicState(code, data, forDisplay));
  };

  loadData(code).then(apply).catch(console.error);

  const channel = supabase
    .channel(`room-${code}-${role}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "game_rooms",
        filter: `code=eq.${code}`,
      },
      (payload) => {
        if (payload.eventType === "DELETE") {
          onMissing?.();
          return;
        }
        const row = payload.new as { data?: RoomData };
        if (row?.data) apply(row.data);
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function createGame(): Promise<string> {
  let code = randomRoomCode();
  for (let i = 0; i < 5; i++) {
    const existing = await loadData(code);
    if (!existing) break;
    code = randomRoomCode();
  }
  const data = emptyRoomData();
  data.gameCreated = true;
  data.phase = "lobby";
  await saveData(code, data);
  return code;
}

export async function roomExists(code: string): Promise<boolean> {
  const room = await loadData(code);
  return room !== null && room.gameCreated;
}

export async function setAgeRange(code: string, min: number, max: number): Promise<void> {
  await mutate(code, (r) => {
    r.ageMin = Math.min(min, max);
    r.ageMax = Math.max(min, max);
    return r;
  });
}

export async function setDisplayTitle(code: string, title: string): Promise<void> {
  await mutate(code, (r) => {
    const trimmed = title.trim().slice(0, MAX_DISPLAY_TITLE_LENGTH);
    r.displayTitle = trimmed || DEFAULT_DISPLAY_TITLE;
    return r;
  });
}

export async function addQuestion(
  code: string,
  q: Omit<Question, "id">
): Promise<void> {
  await mutate(code, (r) => {
    r.questions.push({ ...q, id: newId() });
    return r;
  });
}

export async function updateQuestion(code: string, question: Question): Promise<void> {
  await mutate(code, (r) => {
    const idx = r.questions.findIndex((x) => x.id === question.id);
    if (idx === -1) return null;
    r.questions[idx] = question;
    return r;
  });
}

export async function deleteQuestion(code: string, questionId: string): Promise<void> {
  await mutate(code, (r) => {
    r.questions = r.questions.filter((q) => q.id !== questionId);
    return r;
  });
}

export async function randomBankQuestion(code: string): Promise<void> {
  await mutate(code, (r) => {
    const used = new Set(r.usedBankIds);
    let eligible = bankQuestions.filter(
      (q) =>
        (q.ageMin ?? 0) <= r.ageMax &&
        (q.ageMax ?? 99) >= r.ageMin &&
        !used.has(q.id)
    );
    if (eligible.length === 0) {
      used.clear();
      eligible = bankQuestions.filter(
        (q) => (q.ageMin ?? 0) <= r.ageMax && (q.ageMax ?? 99) >= r.ageMin
      );
    }
    if (eligible.length === 0) return r;
    const picked = eligible[Math.floor(Math.random() * eligible.length)];
    used.add(picked.id);
    r.usedBankIds = [...used];
    r.questions.push({ ...picked, id: newId(), fromBank: true });
    return r;
  });
}

export async function setTimer(code: string, seconds: number): Promise<void> {
  await mutate(code, (r) => {
    r.timerSeconds = Math.max(5, Math.min(120, seconds));
    return r;
  });
}

export async function startGame(code: string): Promise<boolean> {
  const result = await mutate(code, (r) => {
    if (r.questions.length === 0) return null;
    r.gameStarted = true;
    r.currentIndex = 0;
    r.phase = "question";
    r.players.forEach((p) => {
      p.currentAnswer = null;
      p.answered = false;
    });
    return r;
  });
  return result !== null;
}

export async function continueFromQuestion(code: string): Promise<boolean> {
  const result = await mutate(code, (r) => {
    if (r.phase !== "question") return null;
    r.phase = "answering";
    r.timerRemaining = r.timerSeconds;
    r.players.forEach((p) => {
      p.currentAnswer = null;
      p.answered = false;
    });
    return r;
  });
  return result !== null;
}

export async function continueFromResults(code: string): Promise<boolean> {
  const result = await mutate(code, (r) => {
    if (r.phase !== "results") return null;
    r.currentIndex += 1;
    if (r.currentIndex >= r.questions.length) {
      r.phase = "finished";
      return r;
    }
    r.phase = "question";
    r.players.forEach((p) => {
      p.currentAnswer = null;
      p.answered = false;
    });
    r.lastResults = [];
    return r;
  });
  return result !== null;
}

function endAnswering(room: RoomData): void {
  if (room.phase !== "answering") return;
  const question = room.questions[room.currentIndex];
  if (!question) return;

  room.lastResults = room.players.map((p) => {
    const correct = p.currentAnswer === question.correctIndex;
    const points = correct ? POINTS_CORRECT : 0;
    if (correct) p.score += POINTS_CORRECT;
    return {
      playerId: p.id,
      name: p.name,
      correct,
      points,
    };
  });
  room.phase = "results";
  room.timerRemaining = 0;
}

export async function tickTimer(code: string): Promise<void> {
  await mutate(code, (r) => {
    if (r.phase !== "answering") return null;
    if (r.timerRemaining <= 0) {
      endAnswering(r);
      return r;
    }
    r.timerRemaining -= 1;
    if (r.timerRemaining <= 0) endAnswering(r);
    return r;
  });
}

export async function submitAnswer(
  code: string,
  playerId: string,
  optionIndex: number
): Promise<{ allAnswered: boolean } | null> {
  let allAnswered = false;
  const result = await mutate(code, (r) => {
    if (r.phase !== "answering") return null;
    const player = r.players.find((p) => p.id === playerId);
    if (!player || player.answered) return null;
    player.currentAnswer = optionIndex;
    player.answered = true;
    allAnswered = r.players.length > 0 && r.players.every((p) => p.answered);
    if (allAnswered) endAnswering(r);
    return r;
  });
  if (!result) return null;
  return { allAnswered };
}

export async function joinPlayer(
  code: string,
  name: string,
  preferredPlayerId?: string
): Promise<{ playerId: string; state: PublicRoomState } | null> { 
  const trimmed = name.trim();
  if (!trimmed) return null;

  const room = await loadData(code);
  if (!room || !room.gameCreated) return null;

  let player: InternalPlayer | undefined = preferredPlayerId
    ? room.players.find((p) => p.id === preferredPlayerId)
    : undefined;

  if (!player) {
    player = room.players.find(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase()
    );
  }


  if (player) {
    // Re-join: keep score as-is, but allow answering again.
    // Clear currentAnswer/answered so phase UI matches server state.
    player.currentAnswer = null;
    player.answered = false;
  } else {

    player = {
      id: newId(),
      name: trimmed,
      score: 0,
      avatarIndex: room.players.length % 8,
      currentAnswer: null,
      answered: false,
    };
    room.players.push(player);
  }

  await saveData(code, room);
  return {
    playerId: player.id,
    state: toPublicState(code, room, true),
  };
}

export function getJoinUrl(roomCode: string): string {
  return `${window.location.origin}/play?room=${roomCode}`;
}

export { isSupabaseConfigured };
