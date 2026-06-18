import { QUESTIONS } from "./questions.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// 🔧 FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyD5DkIS7edDY14nW3xg3ZOrlx5ASu5jyak",
  authDomain: "fake-facts.firebaseapp.com",
  projectId: "fake-facts",
  storageBucket: "fake-facts.firebasestorage.app",
  messagingSenderId: "119462662606",
  appId: "1:119462662606:web:68462cb69839825e951b9f",
  measurementId: "G-FL7PYZX8YD"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// =========================
// STATE
// =========================
let playerId = crypto.randomUUID();
let roomId = "";
let isHost = false;
let selectedAnswer = null;

// =========================
// DOM
// =========================
const lobby = document.getElementById("lobby");
const game = document.getElementById("game");
const results = document.getElementById("results");

const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");

const roleInfo = document.getElementById("roleInfo");

const questionText = document.getElementById("questionText");
const optionsDiv = document.getElementById("options");
const status = document.getElementById("status");

// =========================
// CREATE ROOM (HOST)
// =========================
document.getElementById("createBtn").onclick = async () => {
  const name = nameInput.value;
  roomId = roomInput.value || crypto.randomUUID().slice(0, 5);
  isHost = true;

  await set(ref(db, `rooms/${roomId}`), {
    state: {
      questionIndex: 0,
      phase: "lobby"
    },
    players: {}
  });

  joinRoom(name);
};

// =========================
// JOIN ROOM
// =========================
document.getElementById("joinBtn").onclick = () => {
  const name = nameInput.value;
  roomId = roomInput.value;

  isHost = false;
  joinRoom(name);
};

// =========================
// JOIN COMMON
// =========================
function joinRoom(name) {
  if (!name || !roomId) return;

  const playerRef = ref(db, `rooms/${roomId}/players/${playerId}`);

  set(playerRef, {
    name,
    score: 0,
    answer: null
  });

  lobby.classList.add("hidden");
  game.classList.remove("hidden");

  roleInfo.innerText = isHost ? "HOST" : "PLAYER";

  listenRoom();

  if (isHost) {
    startGame();
  }
}

// =========================
// START GAME (HOST ONLY)
// =========================
async function startGame() {
  await update(ref(db, `rooms/${roomId}/state`), {
    phase: "playing",
    questionIndex: 0
  });

  loadQuestion(0);
}

// =========================
// LISTEN ROOM
// =========================
function listenRoom() {
  const roomRef = ref(db, `rooms/${roomId}`);

  onValue(roomRef, (snap) => {
    const data = snap.val();
    if (!data) return;

    const state = data.state;
    const q = QUESTIONS[state.questionIndex];

    if (!q) return;

    if (state.phase === "playing") {
      renderQuestion(q, data.players);
    }

    if (state.phase === "reveal") {
      showReveal(q, data.players);
    }

    if (state.phase === "results") {
      showResults(data.players);
    }
  });
}

// =========================
// RENDER QUESTION
// =========================
function renderQuestion(q, players) {
  questionText.innerText = q.text;
  optionsDiv.innerHTML = "";
  status.innerText = "Wybierz odpowiedź...";

  Object.entries(q.options).forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.innerText = opt[1];

    btn.onclick = () => submitAnswer(i);

    optionsDiv.appendChild(btn);
  });
}

// =========================
// ANSWER
// =========================
function submitAnswer(index) {
  if (selectedAnswer !== null) return;

  selectedAnswer = index;

  update(ref(db, `rooms/${roomId}/players/${playerId}`), {
    answer: index
  });

  checkIfAllAnswered();
}

// =========================
// CHECK IF ALL ANSWERED
// =========================
async function checkIfAllAnswered() {
  const snap = await get(ref(db, `rooms/${roomId}/players`));
  const players = snap.val();

  const allAnswered = Object.values(players)
    .every(p => p.answer !== null);

  if (allAnswered && isHost) {
    revealAnswers(players);
  }
}

// =========================
// REVEAL (HOST)
// =========================
async function revealAnswers(players) {
  const qIndexSnap = await get(ref(db, `rooms/${roomId}/state/questionIndex`));
  const qIndex = qIndexSnap.val();

  const q = QUESTIONS[qIndex];

  // scoring
  Object.entries(players).forEach(([id, p]) => {
    if (p.answer === q.correct) {
      update(ref(db, `rooms/${roomId}/players/${id}`), {
        score: (p.score || 0) + 100
      });
    }
  });

  await update(ref(db, `rooms/${roomId}/state`), {
    phase: "reveal"
  });

  setTimeout(nextQuestion, 3000);
}

// =========================
// NEXT QUESTION
// =========================
async function nextQuestion() {
  selectedAnswer = null;

  const snap = await get(ref(db, `rooms/${roomId}/state`));
  const state = snap.val();

  const next = state.questionIndex + 1;

  if (next >= QUESTIONS.length) {
    await update(ref(db, `rooms/${roomId}/state`), {
      phase: "results"
    });
    return;
  }

  await update(ref(db, `rooms/${roomId}/state`), {
    questionIndex: next,
    phase: "playing"
  });

  // reset answers
  const playersSnap = await get(ref(db, `rooms/${roomId}/players`));
  const players = playersSnap.val();

  Object.keys(players).forEach(id => {
    update(ref(db, `rooms/${roomId}/players/${id}`), {
      answer: null
    });
  });
}

// =========================
// REVEAL UI
// =========================
function showReveal(q, players) {
  questionText.innerText = `ODPOWIEDŹ: ${q.explanation}`;
  optionsDiv.innerHTML = "";
  status.innerText = "Revealed 🔥";
}

// =========================
// RESULTS
// =========================
function showResults(players) {
  game.classList.add("hidden");
  results.classList.remove("hidden");

  const scoreboard = document.getElementById("scoreboard");
  scoreboard.innerHTML = "";

  Object.values(players)
    .sort((a, b) => b.score - a.score)
    .forEach(p => {
      const div = document.createElement("div");
      div.innerText = `${p.name}: ${p.score}`;
      scoreboard.appendChild(div);
    });
}
