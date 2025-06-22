const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
// Use Render's port or fallback to 3000 locally
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

const players = {};
const bullets = [];

const obstacles = [
  { x: 400, y: 300, r: 40 },
  { x: 200, y: 150, r: 30 },
  { x: 600, y: 450, r: 25 },
  { x: 150, y: 400, r: 35 },
  { x: 700, y: 200, r: 50 },
  { x: 500, y: 100, r: 20 }
];

const inputs = {};

function getRandomSpawn() {
  return {
    x: Math.random() * 700 + 50,
    y: Math.random() * 400 + 50
  };
}

io.on('connection', socket => {
  const spawn = getRandomSpawn();
  players[socket.id] = {
    x: spawn.x,
    y: spawn.y,
    name: "Player",
    hp: 100,
    angle: 0
  };

  inputs[socket.id] = {
    up: false,
    down: false,
    left: false,
    right: false,
    angle: 0,
    name: "Player"
  };

  socket.on('input', data => {
    if (inputs[socket.id]) {
      inputs[socket.id] = { ...inputs[socket.id], ...data };
    }
  });

  socket.on('shoot', () => {
    const p = players[socket.id];
    if (!p) return;

    const speed = 6;
    bullets.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(p.angle) * speed,
      vy: Math.sin(p.angle) * speed,
      owner: socket.id
    });
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    delete inputs[socket.id];
  });
});

setInterval(() => {
  const speed = 4;
  for (const id in players) {
    const p = players[id];
    const input = inputs[id];
    if (!input) continue;

    let dx = 0, dy = 0;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;

    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx *= speed / len;
      dy *= speed / len;

      let nextX = p.x + dx;
      let nextY = p.y + dy;

      for (const o of obstacles) {
        const dist = Math.hypot(o.x - nextX, o.y - nextY);
        if (dist < o.r + 15) {
          const angle = Math.atan2(nextY - o.y, nextX - o.x);
          nextX = o.x + Math.cos(angle) * (o.r + 15);
          nextY = o.y + Math.sin(angle) * (o.r + 15);
        }
      }

      p.x = Math.max(0, Math.min(800, nextX));
      p.y = Math.max(0, Math.min(500, nextY));
    }

    p.angle = input.angle;
    p.name = input.name || "Player";
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;

    if (b.x < 0 || b.x > 800 || b.y < 0 || b.y > 500) {
      bullets.splice(i, 1);
      continue;
    }

    for (const id in players) {
      const p = players[id];
      if (id !== b.owner && Math.hypot(p.x - b.x, p.y - b.y) < 15) {
        p.hp -= 25;
        if (p.hp <= 0) {
          const spawn = getRandomSpawn();
          p.hp = 100;
          p.x = spawn.x;
          p.y = spawn.y;
        }
        bullets.splice(i, 1);
        break;
      }
    }

    for (const o of obstacles) {
      if (Math.hypot(o.x - b.x, o.y - b.y) < o.r) {
        bullets.splice(i, 1);
        break;
      }
    }
  }

  io.emit('state', {
    players,
    bullets,
    obstacles
  });

}, 1000 / 30);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
