import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { v4 as uuid } from "uuid";
import { DEFAULT_DISPLAY_TITLE, MAX_DISPLAY_TITLE_LENGTH } from "./constants.js";
import type { GamePhase, Player, PublicRoomState, Question, RoomState } from "./types.js";

const ADMIN_CODE = "242011";
const POINTS_CORRECT = 1000;
const __dirname = dirname(fileURLToPath(import.meta.url));

const bankQuestions: Question[] = JSON.parse(
  readFileSync(join(__dirname, "questionBank.json"), "utf-8")
);

interface Room extends RoomState {
  timerInterval: ReturnType<typeof setInterval> | null;
  usedBankIds: Set<string>;
}

const rooms = new Map<string, Room>();

function randomRoomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function createEmptyRoom(code: string): Room {
  return {
    code,
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
    timerInterval: null,
    usedBankIds: new Set(),
  };
}

function getOrCreateRoom(code?: string): Room {
  if (code && rooms.has(code)) {
    return rooms.get(code)!;
  }
  let newCode = code || randomRoomCode();
  while (rooms.has(newCode)) newCode = randomRoomCode();
  const room = createEmptyRoom(newCode);
  rooms.set(newCode, room);
  return room;
}

function clearTimer(room: Room) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
}

function toPublicState(room: Room, forDisplay = false): PublicRoomState {
  const currentQuestion =
    room.gameStarted && room.currentIndex < room.questions.length
      ? room.questions[room.currentIndex]
      : null;

  const showOptions = room.phase === "answering";

  let questionForClient = currentQuestion;
  if (forDisplay && currentQuestion && room.phase === "question") {
    questionForClient = { ...currentQuestion, options: currentQuestion.options };
  }

  return {
    code: room.code,
    displayTitle: room.displayTitle,
    gameCreated: room.gameCreated,
    gameStarted: room.gameStarted,
    phase: room.phase,
    ageMin: room.ageMin,
    ageMax: room.ageMax,
    questions: forDisplay ? [] : room.questions,
    currentIndex: room.currentIndex,
    timerSeconds: room.timerSeconds,
    timerRemaining: room.timerRemaining,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      avatarIndex: p.avatarIndex,
    })),
    currentQuestion: questionForClient,
    showOptions: forDisplay ? showOptions : showOptions,
    lastResults: room.lastResults,
    playerCount: room.players.length,
    answeredCount: room.players.filter((p) => p.answered).length,
    totalQuestions: room.questions.length,
  };
}

function startTimer(room: Room, onTick: () => void, onEnd: () => void) {
  clearTimer(room);
  room.timerRemaining = room.timerSeconds;
  room.timerInterval = setInterval(() => {
    room.timerRemaining -= 1;
    onTick();
    if (room.timerRemaining <= 0) {
      clearTimer(room);
      onEnd();
    }
  }, 1000);
}

export const gameManager = {
  ADMIN_CODE,

  verifyAdmin(code: string): boolean {
    return code === ADMIN_CODE;
  },

  createGame(): Room {
    const room = getOrCreateRoom();
    room.gameCreated = true;
    room.phase = "lobby";
    return room;
  },

  getRoom(code: string): Room | undefined {
    return rooms.get(code);
  },

  getPublicState(code: string, forDisplay = false): PublicRoomState | null {
    const room = rooms.get(code);
    if (!room) return null;
    return toPublicState(room, forDisplay);
  },

  setAgeRange(code: string, min: number, max: number): boolean {
    const room = rooms.get(code);
    if (!room) return false;
    room.ageMin = Math.min(min, max);
    room.ageMax = Math.max(min, max);
    return true;
  },

  setDisplayTitle(code: string, title: string): boolean {
    const room = rooms.get(code);
    if (!room) return false;
    const trimmed = title.trim().slice(0, MAX_DISPLAY_TITLE_LENGTH);
    room.displayTitle = trimmed || DEFAULT_DISPLAY_TITLE;
    return true;
  },

  addQuestion(code: string, q: Omit<Question, "id">): Question | null {
    const room = rooms.get(code);
    if (!room) return null;
    const question: Question = { ...q, id: uuid() };
    room.questions.push(question);
    return question;
  },

  updateQuestion(code: string, question: Question): boolean {
    const room = rooms.get(code);
    if (!room) return false;
    const idx = room.questions.findIndex((q) => q.id === question.id);
    if (idx === -1) return false;
    room.questions[idx] = question;
    return true;
  },

  deleteQuestion(code: string, questionId: string): boolean {
    const room = rooms.get(code);
    if (!room) return false;
    const before = room.questions.length;
    room.questions = room.questions.filter((q) => q.id !== questionId);
    return room.questions.length < before;
  },

  getRandomBankQuestion(code: string): Question | null {
    const room = rooms.get(code);
    if (!room) return null;
    const eligible = bankQuestions.filter(
      (q) =>
        (q.ageMin ?? 0) <= room.ageMax &&
        (q.ageMax ?? 99) >= room.ageMin &&
        !room.usedBankIds.has(q.id)
    );
    if (eligible.length === 0) {
      room.usedBankIds.clear();
      const retry = bankQuestions.filter(
        (q) =>
          (q.ageMin ?? 0) <= room.ageMax && (q.ageMax ?? 99) >= room.ageMin
      );
      if (retry.length === 0) return null;
      const picked = retry[Math.floor(Math.random() * retry.length)];
      room.usedBankIds.add(picked.id);
      const copy: Question = { ...picked, id: uuid(), fromBank: true };
      room.questions.push(copy);
      return copy;
    }
    const picked = eligible[Math.floor(Math.random() * eligible.length)];
    room.usedBankIds.add(picked.id);
    const copy: Question = { ...picked, id: uuid(), fromBank: true };
    room.questions.push(copy);
    return copy;
  },

  joinPlayer(code: string, name: string): { player: Player; room: Room } | null {
    const room = rooms.get(code);
    if (!room || !room.gameCreated) return null;
    const trimmed = name.trim();
    if (!trimmed) return null;

    const existing = room.players.find(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      existing.currentAnswer = null;
      existing.answered = false;
      return { player: existing, room };
    }

    const player: Player = {
      id: uuid(),
      name: trimmed,
      score: 0,
      avatarIndex: room.players.length % 8,
      currentAnswer: null,
      answered: false,
    };
    room.players.push(player);
    return { player, room };
  },

  setTimer(code: string, seconds: number): boolean {
    const room = rooms.get(code);
    if (!room) return false;
    room.timerSeconds = Math.max(5, Math.min(120, seconds));
    return true;
  },

  startGame(code: string): boolean {
    const room = rooms.get(code);
    if (!room || room.questions.length === 0) return false;
    room.gameStarted = true;
    room.currentIndex = 0;
    room.phase = "question";
    room.players.forEach((p) => {
      p.currentAnswer = null;
      p.answered = false;
    });
    return true;
  },

  continueFromQuestion(code: string): boolean {
    const room = rooms.get(code);
    if (!room || room.phase !== "question") return false;
    room.phase = "answering";
    room.players.forEach((p) => {
      p.currentAnswer = null;
      p.answered = false;
    });
    return true;
  },

  continueFromResults(code: string): boolean {
    const room = rooms.get(code);
    if (!room || room.phase !== "results") return false;
    room.currentIndex += 1;
    if (room.currentIndex >= room.questions.length) {
      room.phase = "finished";
      return true;
    }
    room.phase = "question";
    room.players.forEach((p) => {
      p.currentAnswer = null;
      p.answered = false;
    });
    room.lastResults = [];
    return true;
  },

  submitAnswer(
    code: string,
    playerId: string,
    optionIndex: number
  ): { allAnswered: boolean } | null {
    const room = rooms.get(code);
    if (!room || room.phase !== "answering") return null;
    const player = room.players.find((p) => p.id === playerId);
    if (!player || player.answered) return null;

    player.currentAnswer = optionIndex;
    player.answered = true;

    const allAnswered =
      room.players.length > 0 &&
      room.players.every((p) => p.answered);
    return { allAnswered };
  },

  endAnsweringPhase(room: Room): void {
    if (room.phase !== "answering") return;
    clearTimer(room);
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
  },

  startAnsweringTimer(
    code: string,
    onTick: (state: PublicRoomState) => void,
    onEnd: (state: PublicRoomState) => void
  ): boolean {
    const room = rooms.get(code);
    if (!room || room.phase !== "answering") return false;

    startTimer(
      room,
      () => onTick(toPublicState(room, true)),
      () => {
        this.endAnsweringPhase(room);
        onEnd(toPublicState(room, true));
      }
    );
    return true;
  },

  forceEndAnswering(
    code: string
  ): PublicRoomState | null {
    const room = rooms.get(code);
    if (!room) return null;
    this.endAnsweringPhase(room);
    return toPublicState(room, true);
  },

  getLeaderboard(code: string) {
    const room = rooms.get(code);
    if (!room) return [];
    return [...room.players].sort((a, b) => b.score - a.score);
  },
};
