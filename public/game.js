const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nameInput = document.getElementById('nameInput');

let playerId = null;
let others = {};
let bullets = [];
let obstacles = [];

const keys = { w: false, a: false, s: false, d: false };
let shooting = false;
let lastShot = 0;
const shootInterval = 500;

const mouse = { x: 0, y: 0 };

// Keyboard handlers
document.addEventListener('keydown', e => {
  if (e.key in keys) keys[e.key] = true;
});
document.addEventListener('keyup', e => {
  if (e.key in keys) keys[e.key] = false;
});

// Mouse position
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});

function tryShoot() {
  const now = Date.now();
  if (now - lastShot >= shootInterval) {
    socket.emit('shoot');
    lastShot = now;
  }
}

// Left click shooting
canvas.addEventListener('mousedown', e => {
  if (e.button === 0) {
    shooting = true;
    tryShoot(); // Immediate shot on click
  }
});
canvas.addEventListener('mouseup', e => {
  if (e.button === 0) {
    shooting = false;
    lastShot = 0; // Reset cooldown timer on mouse release to allow immediate spam shooting
  }
});

// Disable right click menu on canvas
canvas.addEventListener('contextmenu', e => e.preventDefault());

// Update player name
nameInput.addEventListener('input', () => {
  const player = others[playerId];
  if (player) {
    player.name = nameInput.value;
  }
});

function sendInput() {
  const player = others[playerId];
  if (!player) return;

  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  socket.emit('input', {
    up: keys.w,
    down: keys.s,
    left: keys.a,
    right: keys.d,
    angle: angle,
    name: nameInput.value
  });

  if (shooting) {
    tryShoot();  // Shoot repeatedly while holding (with cooldown)
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw obstacles
  ctx.fillStyle = "#444";
  for (const o of obstacles) {
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw bullets
  ctx.fillStyle = "yellow";
  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw players
  for (const id in others) {
    const p = others[id];
    const isSelf = id === playerId;

    ctx.fillStyle = isSelf ? "blue" : "red";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
    ctx.fill();

    // Draw gun
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = "white";
    ctx.fillRect(0, -3, 20, 6);
    ctx.restore();

    // Draw player name
    ctx.fillStyle = "white";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(p.name || "Player", p.x, p.y - 25);

    // Draw HP bar
    ctx.fillStyle = "green";
    ctx.fillRect(p.x - 25, p.y + 20, (p.hp / 100) * 50, 5);
    ctx.strokeStyle = "black";
    ctx.strokeRect(p.x - 25, p.y + 20, 50, 5);
  }
}

socket.on('state', data => {
  others = data.players;
  bullets = data.bullets;
  obstacles = data.obstacles;
});

socket.on('connect', () => {
  playerId = socket.id;
});

function gameLoop() {
  sendInput();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
