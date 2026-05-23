import type { GamePhase, Question } from "../types";

export interface InternalPlayer {
  id: string;
  name: string;
  score: number;
  avatarIndex: number;
  currentAnswer: number | null;
  answered: boolean;
}

export interface RoomData {
  displayTitle: string;
  gameCreated: boolean;
  gameStarted: boolean;
  phase: GamePhase;
  ageMin: number;
  ageMax: number;
  questions: Question[];
  currentIndex: number;
  timerSeconds: number;
  timerRemaining: number;
  players: InternalPlayer[];
  lastResults: {
    playerId: string;
    name: string;
    correct: boolean;
    points: number;
  }[];
  usedBankIds: string[];
}
