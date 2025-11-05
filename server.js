const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const WORLD = { width: 2000, height: 2000, speed: 4 };
const players = {}; // socketId -> { id, x, y, name, color }

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

io.on('connection', (socket) => {
  const spawn = {
    id: socket.id,
    x: Math.floor(Math.random() * WORLD.width),
    y: Math.floor(Math.random() * WORLD.height),
    color: `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`,
    name: 'שחקן'
  };
  players[socket.id] = spawn;

  socket.emit('init', { id: socket.id, players, world: WORLD });
  socket.broadcast.emit('player:join', spawn);

  socket.on('player:updateName', (name) => {
    if (typeof name === 'string' && players[socket.id]) {
      players[socket.id].name = name.substring(0, 20);
      io.emit('player:update', players[socket.id]);
    }
  });

  // Move toward mouse target sent by client, limited by speed per tick
  socket.on('player:moveTo', (target) => {
    const p = players[socket.id];
    if (!p) return;
    if (!target || typeof target.x !== 'number' || typeof target.y !== 'number') return;
    const tx = clamp(target.x, 0, WORLD.width);
    const ty = clamp(target.y, 0, WORLD.height);
    const dx = tx - p.x;
    const dy = ty - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 0.0001) return;
    const step = Math.min(WORLD.speed, dist);
    p.x = clamp(p.x + (dx / dist) * step, 0, WORLD.width);
    p.y = clamp(p.y + (dy / dist) * step, 0, WORLD.height);
    io.emit('player:update', p);
  });

  socket.on('chat:message', (msg) => {
    const p = players[socket.id];
    if (!p) return;
    const text = String(msg || '').slice(0, 200);
    if (!text.trim()) return;
    io.emit('chat:message', { id: socket.id, name: p.name, text, ts: Date.now() });
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    socket.broadcast.emit('player:leave', socket.id);
  });
});

app.get('/healthz', (_, res) => res.send('ok'));

server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
