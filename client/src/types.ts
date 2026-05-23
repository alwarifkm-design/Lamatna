export type GamePhase =
  | "idle"
  | "lobby"
  | "question"
  | "answering"
  | "results"
  | "finished";

export interface QuestionOption {
  text: string;
}

export interface Question {
  id: string;
  text: string;
  options: QuestionOption[];
  correctIndex: number;
  ageMin?: number;
  ageMax?: number;
  fromBank?: boolean;
}

export interface PublicRoomState {
  code: string;
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
  players: { id: string; name: string; score: number; avatarIndex: number }[];
  currentQuestion: Question | null;
  showOptions: boolean;
  lastResults: {
    playerId: string;
    name: string;
    correct: boolean;
    points: number;
  }[];
  playerCount: number;
  answeredCount: number;
  totalQuestions: number;
}
