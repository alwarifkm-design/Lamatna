import cors from "cors";
import express from "express";
import { existsSync } from "fs";
import { createServer } from "http";
import { Server } from "socket.io";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { corsOptions } from "./cors.js";
import { gameManager } from "./gameManager.js";
import type { Question } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const SERVE_STATIC = process.env.SERVE_STATIC !== "false";

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { ...corsOptions, methods: ["GET", "POST"] },
});

function broadcastRoom(code: string) {
  const displayState = gameManager.getPublicState(code, true);
  const adminState = gameManager.getPublicState(code, false);
  if (displayState) {
    io.to(`display:${code}`).emit("room:update", displayState);
  }
  if (adminState) {
    io.to(`admin:${code}`).emit("room:update", adminState);
  }
  io.to(`players:${code}`).emit("room:update", displayState);
}

io.on("connection", (socket) => {
  socket.on("display:join", (code: string) => {
    const room = gameManager.getRoom(code);
    if (!room) {
      socket.emit("error", { message: "الغرفة غير موجودة" });
      return;
    }
    socket.join(`display:${code}`);
    const state = gameManager.getPublicState(code, true);
    if (state) socket.emit("room:update", state);
  });

  socket.on("admin:authenticate", (pin: string, cb: (ok: boolean) => void) => {
    cb(gameManager.verifyAdmin(pin));
  });

  socket.on("admin:createGame", (cb: (code: string) => void) => {
    const room = gameManager.createGame();
    socket.join(`admin:${room.code}`);
    cb(room.code);
    broadcastRoom(room.code);
  });

  socket.on("admin:join", (code: string) => {
    socket.join(`admin:${code}`);
    const state = gameManager.getPublicState(code, false);
    if (state) socket.emit("room:update", state);
  });

  socket.on("admin:setAge", (code: string, min: number, max: number) => {
    gameManager.setAgeRange(code, min, max);
    broadcastRoom(code);
  });

  socket.on("admin:setDisplayTitle", (code: string, title: string) => {
    gameManager.setDisplayTitle(code, title);
    broadcastRoom(code);
  });

  socket.on("admin:addQuestion", (code: string, q: Omit<Question, "id">, cb) => {
    const question = gameManager.addQuestion(code, q);
    broadcastRoom(code);
    cb(question);
  });

  socket.on("admin:updateQuestion", (code: string, q: Question, cb) => {
    cb(gameManager.updateQuestion(code, q));
    broadcastRoom(code);
  });

  socket.on("admin:deleteQuestion", (code: string, id: string, cb) => {
    cb(gameManager.deleteQuestion(code, id));
    broadcastRoom(code);
  });

  socket.on("admin:randomQuestion", (code: string, cb) => {
    const q = gameManager.getRandomBankQuestion(code);
    broadcastRoom(code);
    cb(q);
  });

  socket.on("admin:setTimer", (code: string, seconds: number) => {
    gameManager.setTimer(code, seconds);
    broadcastRoom(code);
  });

  socket.on("admin:startGame", (code: string, cb) => {
    const ok = gameManager.startGame(code);
    if (ok) broadcastRoom(code);
    cb(ok);
  });

  socket.on("admin:continue", (code: string, cb) => {
    const room = gameManager.getRoom(code);
    if (!room) {
      cb(false);
      return;
    }

    if (room.phase === "question") {
      gameManager.continueFromQuestion(code);
      broadcastRoom(code);
      gameManager.startAnsweringTimer(
        code,
        () => broadcastRoom(code),
        () => broadcastRoom(code)
      );
      cb(true);
      return;
    }

    if (room.phase === "results") {
      gameManager.continueFromResults(code);
      broadcastRoom(code);
      cb(true);
      return;
    }

    cb(false);
  });

  socket.on("player:join", (code: string, name: string, cb) => {
    const result = gameManager.joinPlayer(code, name);
    if (!result) {
      cb({ ok: false, message: "تعذر الدخول. تأكد من رمز الغرفة." });
      return;
    }
    socket.join(`players:${code}`);
    (socket.data as { playerId?: string }).playerId = result.player.id;
    (socket.data as { roomCode?: string }).roomCode = code;
    const state = gameManager.getPublicState(code, true);
    cb({ ok: true, playerId: result.player.id, state });
    broadcastRoom(code);
  });

  socket.on("player:answer", (code: string, playerId: string, optionIndex: number) => {
    const result = gameManager.submitAnswer(code, playerId, optionIndex);
    if (!result) return;

    broadcastRoom(code);

    if (result.allAnswered) {
      const state = gameManager.forceEndAnswering(code);
      if (state) broadcastRoom(code);
    }
  });
});

const clientDist = join(__dirname, "../../client/dist");
if (SERVE_STATIC && existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(join(clientDist, "index.html"), (err) => {
      if (err) res.status(404).send("الواجهة غير مبنية — نفّذ npm run build من client");
    });
  });
}

httpServer.listen(PORT, () => {
  console.log(`لمة العائلة — الخادم على المنفذ ${PORT}`);
});
