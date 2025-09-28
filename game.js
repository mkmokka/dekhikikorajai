// ===== Firebase Imports =====
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Firebase instances
const db = getDatabase();
const auth = getAuth();

// Canvas setup
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Store all players
let players = {};
const avatarCache = {}; // cache avatar images for smooth rendering

// Room ID (could be dynamic in future)
const roomId = new URLSearchParams(window.location.search).get("roomId") || "room1";

// ===== Drawing Loop =====
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw all players
  Object.values(players).forEach(p => {
    // Cache avatar image if not already cached
    if (!avatarCache[p.avatar]) {
      const img = new Image();
      img.src = p.avatar;
      avatarCache[p.avatar] = img;
    }

    const img = avatarCache[p.avatar];
    if (img.complete) {
      ctx.drawImage(img, p.x - 25, p.y - 25, 50, 50); // Draw avatar 50x50
    } else {
      // Fallback if the image isn't loaded
      ctx.fillStyle = "blue";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw player label
    ctx.fillStyle = "black";
    ctx.font = "14px Arial";
    ctx.fillText(`P${p.slot}`, p.x - 10, p.y - 35);
  });

  requestAnimationFrame(draw);
}

// ===== Listen for Player Updates =====
onValue(ref(db, `rooms/${roomId}/members`), snap => {
  players = snap.val() || {};

  // Update player info for the current user
  const user = auth.currentUser;
  if (user) {
    const me = Object.values(players).find(p => p.uid === user.uid);
    if (me) {
      document.getElementById('playerAvatar').src = me.avatar;
      document.getElementById('playerSlot').innerText = me.slot;
      document.getElementById('playerEmail').innerText = user.email;
    }
  }

  // Update the game status
  if (Object.keys(players).length === 2) {
    document.getElementById('gameStatusText').innerText = "Game Started!";
  } else {
    document.getElementById('gameStatusText').innerText = "Waiting for players...";
  }
});

// ===== Movement Controls =====
document.addEventListener("keydown", e => {
  const user = auth.currentUser;
  if (!user) return;

  // Find current player
  const me = Object.values(players).find(p => p.uid === user.uid);
  if (!me) return;

  // Move player with arrow keys
  const speed = 5;
  if (e.key === "ArrowUp") me.y -= speed;
  if (e.key === "ArrowDown") me.y += speed;
  if (e.key === "ArrowLeft") me.x -= speed;
  if (e.key === "ArrowRight") me.x += speed;

  // Prevent going out of bounds
  me.x = Math.max(25, Math.min(canvas.width - 25, me.x));
  me.y = Math.max(25, Math.min(canvas.height - 25, me.y));

  // Update player position in Firebase
  set(ref(db, `rooms/${roomId}/members/${me.slot}`), me);
});

// Start drawing the game world
draw();

// ===== Game Logic: Avatar and Slot Assignment =====
function setupGame() {
  const user = auth.currentUser;
  if (!user) return;

  // Get player slot and avatar selection from Firebase
  const roomRef = ref(db, `rooms/${roomId}`);
  onValue(roomRef, snap => {
    const roomData = snap.val() || {};
    const members = roomData.members || {};
    const slots = Object.keys(members);

    // If 2 players are in the room, start the game
    if (slots.length === 2) {
      const playerData = Object.values(members);
      // Here we just choose the first available slot for the current user
      const player = playerData.find(p => p.uid === user.uid);

      if (player) {
        // Set player position if not already set
        if (!player.x) player.x = 100 + Math.random() * 600;
        if (!player.y) player.y = 100 + Math.random() * 400;
        set(ref(db, `rooms/${roomId}/members/${player.slot}`), player);
      }
    }
  });
}

setupGame();
