import { QUESTIONS } from "./questions.js";

// 🔥 Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  onValue,
  update
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// 👉 WSTAW SWÓJ CONFIG
const firebaseConfig = {
  apiKey: "XXX",
  authDomain: "XXX",
  databaseURL: "XXX",
  projectId: "XXX"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 🔧 STATE
let playerId = Math.random().toString(36).slice(2);
let roomId = "";
let playerName = "";
let selectedAnswer = null;

// 🎮 DOM
const joinBtn = document.getElementById("joinBtn");
const lobby = document.getElementById("lobby");
const game = document.getElementById("game");
const results = document.getElementById("results");

const questionText = document.getElementById("questionText");
const optionsDiv = document.getElementById("options");
const timerDiv = document.getElementById("timer");

// 🚀 JOIN
joinBtn.onclick = () => {
  playerName = document.getElementById("nameInput").value;
  roomId = document.getElementById("roomInput").value;

  if (!playerName || !roomId) return;

  const playerRef = ref(db, `rooms/${roomId}/players/${playerId}`);

  set(playerRef, {
    name: playerName,
    score: 0,
    answer: null
  });

  startGame();
};

// 🎯 START
function startGame() {
  lobby.classList.add("hidden");
  game.classList.remove("hidden");

  const roomRef = ref(db, `rooms/${roomId}`);

  // jeśli pierwszy gracz → start gry
  set(ref(db, `rooms/${roomId}/state`), {
    questionIndex: 0,
    phase: "playing"
  });

  listenGame();
}

// 👂 LISTENER
function listenGame() {
  const roomRef = ref(db, `rooms/${roomId}`);

  onValue(roomRef, (snap) => {
    const data = snap.val();
    if (!data) return;

    const q = QUESTIONS[data.state.questionIndex];
    renderQuestion(q);
  });
}

// 🧠 RENDER
function renderQuestion(q) {
  questionText.innerText = q.text;
  optionsDiv.innerHTML = "";

  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.innerText = opt;

    btn.onclick = () => answer(i);

    optionsDiv.appendChild(btn);
  });
}

// 🧨 ANSWER
function answer(index) {
  if (selectedAnswer !== null) return;

  selectedAnswer = index;

  const playerRef = ref(db, `rooms/${roomId}/players/${playerId}`);

  update(playerRef, {
    answer: index
  });

  // sprawdź po 3 sekundach
  setTimeout(checkAnswers, 3000);
}

// 🧮 CHECK
function checkAnswers() {
  const roomRef = ref(db, `rooms/${roomId}`);

  onValue(roomRef, (snap) => {
    const data = snap.val();
    if (!data) return;

    const q = QUESTIONS[data.state.questionIndex];

    Object.entries(data.players).forEach(([id, p]) => {
      if (p.answer === q.correct) {
        update(ref(db, `rooms/${roomId}/players/${id}`), {
          score: (p.score || 0) + 100
        });
      }
    });

    nextQuestion(data.state.questionIndex);
  }, { onlyOnce: true });
}

// ➡️ NEXT
function nextQuestion(index) {
  selectedAnswer = null;

  if (index + 1 >= QUESTIONS.length) {
    showResults();
    return;
  }

  update(ref(db, `rooms/${roomId}/state`), {
    questionIndex: index + 1
  });

  // reset answers
  const playersRef = ref(db, `rooms/${roomId}/players`);
  onValue(playersRef, (snap) => {
    const players = snap.val();

    Object.keys(players).forEach(id => {
      update(ref(db, `rooms/${roomId}/players/${id}`), {
        answer: null
      });
    });
  }, { onlyOnce: true });
}

// 🏆 RESULTS
function showResults() {
  game.classList.add("hidden");
  results.classList.remove("hidden");

  const scoreboard = document.getElementById("scoreboard");

  const roomRef = ref(db, `rooms/${roomId}`);

  onValue(roomRef, (snap) => {
    const data = snap.val();
    scoreboard.innerHTML = "";

    Object.values(data.players).forEach(p => {
      const div = document.createElement("div");
      div.innerText = `${p.name}: ${p.score}`;
      scoreboard.appendChild(div);
    });
  });
}
