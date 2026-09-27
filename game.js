// Street Football - gameplay prototype (no graphics, primitives only)

const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');

const CANVAS_W = canvas.width;
const CANVAS_H = canvas.height;

// Playfield rectangle
const FIELD = {
  left: 40,
  right: CANVAS_W - 40,
  top: 40,
  bottom: CANVAS_H - 40,
};

// Goal mouths (centered on top/bottom edges)
const GOAL = {
  width: 120,
  depth: 20,
  left: (CANVAS_W - 120) / 2,
  right: (CANVAS_W + 120) / 2,
};

const PLAYER_RADIUS = 15;
const BALL_RADIUS = 8;
const PLAYER_SPEED = 1.4;
const KICK_POWER = 9;
const BALL_FRICTION = 0.985;
const CARRY_DIST = PLAYER_RADIUS + BALL_RADIUS + 4;
const PICKUP_RANGE = PLAYER_RADIUS + BALL_RADIUS + 4;

let score = 0;

// Single team: 3 field players + 1 goalkeeper
const players = [
  { id: 'keeper', isKeeper: true, x: CANVAS_W / 2, y: FIELD.bottom - 25, vx: 0, vy: 0, color: '#ffd200' },
  { id: 'f1', isKeeper: false, x: CANVAS_W / 2 - 100, y: CANVAS_H / 2 + 60, vx: 0, vy: 0, color: '#3ea6ff', target: null, dir: { x: 0, y: -1 } },
  { id: 'f2', isKeeper: false, x: CANVAS_W / 2, y: CANVAS_H / 2, vx: 0, vy: 0, color: '#3ea6ff', target: null, dir: { x: 0, y: -1 } },
  { id: 'f3', isKeeper: false, x: CANVAS_W / 2 + 100, y: CANVAS_H / 2 + 60, vx: 0, vy: 0, color: '#3ea6ff', target: null, dir: { x: 0, y: -1 } },
];
const fieldPlayers = players.filter(p => !p.isKeeper);
const keeper = players.find(p => p.isKeeper);

let selectedIndex = 0; // index into fieldPlayers
let mousePos = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
let possessor = null; // field player currently carrying the ball

const ball = {
  x: CANVAS_W / 2,
  y: CANVAS_H / 2,
  vx: 0,
  vy: 0,
};

function resetBall() {
  ball.x = CANVAS_W / 2;
  ball.y = CANVAS_H / 2;
  ball.vx = 0;
  ball.vy = 0;
  possessor = null;
}

// Input handling
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;

  if (e.code === 'Digit1') { selectedIndex = 0; fieldPlayers[0].target = clampToField(mousePos); }
  if (e.code === 'Digit2') { selectedIndex = 1; fieldPlayers[1].target = clampToField(mousePos); }
  if (e.code === 'Digit3') { selectedIndex = 2; fieldPlayers[2].target = clampToField(mousePos); }

  if (e.code === 'Space') {
    e.preventDefault();
    const p = fieldPlayers[selectedIndex];
    if (possessor === p) {
      possessor = null;
      const dx = mousePos.x - p.x;
      const dy = mousePos.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      ball.vx = (dx / dist) * KICK_POWER;
      ball.vy = (dy / dist) * KICK_POWER;
    }
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

function canvasPosFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

function clampToField(pos) {
  return {
    x: clamp(pos.x, FIELD.left + PLAYER_RADIUS, FIELD.right - PLAYER_RADIUS),
    y: clamp(pos.y, FIELD.top + PLAYER_RADIUS, FIELD.bottom - PLAYER_RADIUS),
  };
}

canvas.addEventListener('mousemove', (e) => {
  mousePos = canvasPosFromEvent(e);
});

canvas.addEventListener('mousedown', (e) => {
  fieldPlayers[selectedIndex].target = clampToField(canvasPosFromEvent(e));
});

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function updatePlayers() {
  const selected = fieldPlayers[selectedIndex];

  for (const p of fieldPlayers) {
    if (p === selected) {
      let dx = 0, dy = 0;
      if (keys['ArrowLeft'] || keys['KeyA']) dx -= 1;
      if (keys['ArrowRight'] || keys['KeyD']) dx += 1;
      if (keys['ArrowUp'] || keys['KeyW']) dy -= 1;
      if (keys['ArrowDown'] || keys['KeyS']) dy += 1;

      if (dx !== 0 || dy !== 0) {
        p.target = null;
        const len = Math.hypot(dx, dy);
        dx /= len;
        dy /= len;
        p.dir = { x: dx, y: dy };
        p.x += dx * PLAYER_SPEED;
        p.y += dy * PLAYER_SPEED;
        p.x = clamp(p.x, FIELD.left + PLAYER_RADIUS, FIELD.right - PLAYER_RADIUS);
        p.y = clamp(p.y, FIELD.top + PLAYER_RADIUS, FIELD.bottom - PLAYER_RADIUS);
        continue;
      }
    }

    if (p.target) {
      const tdx = p.target.x - p.x;
      const tdy = p.target.y - p.y;
      const dist = Math.hypot(tdx, tdy);
      if (dist <= PLAYER_SPEED) {
        p.x = p.target.x;
        p.y = p.target.y;
        p.target = null;
      } else {
        const dirx = tdx / dist, diry = tdy / dist;
        p.dir = { x: dirx, y: diry };
        p.x += dirx * PLAYER_SPEED;
        p.y += diry * PLAYER_SPEED;
      }
    }

    p.x = clamp(p.x, FIELD.left + PLAYER_RADIUS, FIELD.right - PLAYER_RADIUS);
    p.y = clamp(p.y, FIELD.top + PLAYER_RADIUS, FIELD.bottom - PLAYER_RADIUS);
  }
}

function updateKeeperAI() {
  // Keeper stays on its goal line, tracks ball horizontally within the goal mouth
  const targetX = clamp(ball.x, GOAL.left + PLAYER_RADIUS, GOAL.right - PLAYER_RADIUS);
  const dx = targetX - keeper.x;
  keeper.x += clamp(dx, -PLAYER_SPEED, PLAYER_SPEED);
  keeper.y = FIELD.bottom - 25;
}

function updateBallPossession() {
  if (possessor) {
    ball.x = possessor.x + possessor.dir.x * CARRY_DIST;
    ball.y = possessor.y + possessor.dir.y * CARRY_DIST;
    ball.vx = 0;
    ball.vy = 0;
    return;
  }

  for (const p of fieldPlayers) {
    const dist = Math.hypot(ball.x - p.x, ball.y - p.y);
    if (dist < PICKUP_RANGE) {
      possessor = p;
      return;
    }
  }
}

function dribble() {
  // Free ball colliding with the keeper (keeper never takes possession)
  if (possessor) return;
  const dx = ball.x - keeper.x;
  const dy = ball.y - keeper.y;
  const dist = Math.hypot(dx, dy) || 0.001;
  const minDist = PLAYER_RADIUS + BALL_RADIUS;
  if (dist < minDist) {
    const overlap = minDist - dist;
    ball.x += (dx / dist) * overlap;
    ball.y += (dy / dist) * overlap;
  }
}

function updateBall() {
  if (possessor) return;

  ball.x += ball.vx;
  ball.y += ball.vy;
  ball.vx *= BALL_FRICTION;
  ball.vy *= BALL_FRICTION;
  if (Math.abs(ball.vx) < 0.02) ball.vx = 0;
  if (Math.abs(ball.vy) < 0.02) ball.vy = 0;

  // Side walls
  if (ball.x - BALL_RADIUS < FIELD.left) {
    ball.x = FIELD.left + BALL_RADIUS;
    ball.vx *= -0.6;
  }
  if (ball.x + BALL_RADIUS > FIELD.right) {
    ball.x = FIELD.right - BALL_RADIUS;
    ball.vx *= -0.6;
  }

  const inGoalMouthX = ball.x > GOAL.left + BALL_RADIUS && ball.x < GOAL.right - BALL_RADIUS;

  // Top edge
  if (ball.y - BALL_RADIUS < FIELD.top) {
    if (inGoalMouthX) {
      if (ball.y - BALL_RADIUS < FIELD.top - GOAL.depth) {
        score++;
        scoreEl.textContent = score;
        resetBall();
      }
    } else {
      ball.y = FIELD.top + BALL_RADIUS;
      ball.vy *= -0.6;
    }
  }

  // Bottom edge
  if (ball.y + BALL_RADIUS > FIELD.bottom) {
    if (inGoalMouthX) {
      if (ball.y + BALL_RADIUS > FIELD.bottom + GOAL.depth) {
        score++;
        scoreEl.textContent = score;
        resetBall();
      }
    } else {
      ball.y = FIELD.bottom - BALL_RADIUS;
      ball.vy *= -0.6;
    }
  }
}

function drawField() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top);

  // Halfway line
  ctx.beginPath();
  ctx.moveTo(FIELD.left, CANVAS_H / 2);
  ctx.lineTo(FIELD.right, CANVAS_H / 2);
  ctx.stroke();

  // Center circle
  ctx.beginPath();
  ctx.arc(CANVAS_W / 2, CANVAS_H / 2, 50, 0, Math.PI * 2);
  ctx.stroke();

  drawGoal(true);
  drawGoal(false);
}

function drawGoal(isTop) {
  const y = isTop ? FIELD.top : FIELD.bottom;
  const yBack = isTop ? FIELD.top - GOAL.depth : FIELD.bottom + GOAL.depth;

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(GOAL.left, y);
  ctx.lineTo(GOAL.left, yBack);
  ctx.lineTo(GOAL.right, yBack);
  ctx.lineTo(GOAL.right, y);
  ctx.stroke();
}

function drawPlayers() {
  players.forEach((p, i) => {
    const isSelected = !p.isKeeper && fieldPlayers[selectedIndex] === p;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    if (isSelected) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
  });
}

function drawMoveTarget() {
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1.5;
  for (const p of fieldPlayers) {
    if (!p.target) continue;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.target.x, p.target.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBall() {
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = '#ff0000';
  ctx.fill();
}

function loop() {
  updatePlayers();
  updateKeeperAI();
  updateBall();
  dribble();
  updateBallPossession();

  drawField();
  drawPlayers();
  drawMoveTarget();
  drawBall();

  requestAnimationFrame(loop);
}

loop();
