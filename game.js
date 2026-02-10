const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  effortBar: document.querySelector('#effortBar span'),
  staminaBar: document.querySelector('#staminaBar span'),
  sprintBar: document.querySelector('#sprintBar span'),
  distanceBar: document.querySelector('#distanceBar span'),
  effortVal: document.getElementById('effortVal'),
  staminaVal: document.getElementById('staminaVal'),
  sprintVal: document.getElementById('sprintVal'),
  distanceVal: document.getElementById('distanceVal'),
  rankVal: document.getElementById('rankVal'),
  zoneVal: document.getElementById('zoneVal'),
  draftVal: document.getElementById('draftVal'),
  activeSprintVal: document.getElementById('activeSprintVal'),
  message: document.getElementById('message')
};

const road = { x: 190, width: 600, laneCount: 4 };
const raceLength = 5000;

const state = {
  over: false,
  won: false,
  time: 0,
  wind: 0,
  player: {
    x: road.x + road.width / 2,
    y: canvas.height - 120,
    progress: 0,
    speed: 0,
    effort: 55,
    stamina: 100,
    sprint: 40,
    drafting: false,
    sprinting: false,
    bottleChain: 0,
  },
  ai: [],
  bottles: [],
  keys: new Set(),
  terrainSegments: [
    { from: 0, to: 1300, name: 'Flat', speedMul: 1, costMul: 1 },
    { from: 1300, to: 2250, name: 'Headwind', speedMul: 0.94, costMul: 1.35 },
    { from: 2250, to: 3250, name: 'Rolling', speedMul: 0.99, costMul: 1.1 },
    { from: 3250, to: 4100, name: 'Climb', speedMul: 0.86, costMul: 1.55 },
    { from: 4100, to: raceLength, name: 'Finale', speedMul: 1.03, costMul: 1.2 },
  ],
};

function rand(min, max) { return Math.random() * (max - min) + min; }

function resetAI() {
  state.ai = [];
  for (let i = 0; i < 11; i++) {
    state.ai.push({
      x: road.x + rand(70, road.width - 70),
      y: canvas.height - 180 - i * 32,
      progress: rand(-50, 150),
      speed: rand(12, 15),
      targetEffort: rand(40, 78),
      stamina: rand(70, 100),
      color: `hsl(${rand(10, 340)}, 74%, 62%)`,
    });
  }
}

function spawnBottles() {
  state.bottles = [];
  for (let d = 320; d < raceLength - 200; d += rand(220, 430)) {
    state.bottles.push({
      progress: d,
      x: road.x + rand(60, road.width - 60),
      taken: false,
    });
  }
}

function resetRace() {
  state.over = false;
  state.won = false;
  state.time = 0;
  Object.assign(state.player, {
    x: road.x + road.width / 2,
    y: canvas.height - 120,
    progress: 0,
    speed: 0,
    effort: 55,
    stamina: 100,
    sprint: 40,
    drafting: false,
    sprinting: false,
    bottleChain: 0,
  });
  resetAI();
  spawnBottles();
  ui.message.textContent = 'Stay in the draft and save your legs.';
}

function terrainAt(progress) {
  return state.terrainSegments.find(s => progress >= s.from && progress < s.to) || state.terrainSegments.at(-1);
}

function updatePlayer(dt) {
  const p = state.player;

  if (state.keys.has('ArrowUp') || state.keys.has('w')) p.effort = Math.min(100, p.effort + 30 * dt);
  if (state.keys.has('ArrowDown') || state.keys.has('s')) p.effort = Math.max(10, p.effort - 30 * dt);

  const steer = (state.keys.has('ArrowRight') || state.keys.has('d') ? 1 : 0) - (state.keys.has('ArrowLeft') || state.keys.has('a') ? 1 : 0);
  p.x += steer * 240 * dt;
  p.x = Math.max(road.x + 30, Math.min(road.x + road.width - 30, p.x));

  const terrain = terrainAt(p.progress);
  const staminaFactor = 0.65 + 0.35 * (p.stamina / 100);
  const baseSpeed = (7 + p.effort * 0.19) * staminaFactor * terrain.speedMul;

  let draftBonus = 0;
  p.drafting = false;
  for (const r of state.ai) {
    const dx = Math.abs(r.x - p.x);
    const ahead = r.progress - p.progress;
    if (dx < 38 && ahead > 4 && ahead < 34) {
      p.drafting = true;
      draftBonus = Math.max(draftBonus, 2.5);
    }
  }

  p.sprinting = state.keys.has(' ') && p.sprint > 0.5 && !state.over;
  const sprintBoost = p.sprinting ? 4.2 : 0;

  p.speed = baseSpeed + draftBonus + sprintBoost;
  p.progress += p.speed * dt;

  let drain = (0.06 + p.effort * 0.012) * terrain.costMul;
  if (p.sprinting) drain += 1.15;
  if (p.drafting) drain *= 0.32;

  p.stamina = Math.max(0, p.stamina - drain * dt);
  if (p.drafting) p.stamina = Math.min(100, p.stamina + 0.42 * dt);
  if (p.effort < 35 && !p.sprinting) p.stamina = Math.min(100, p.stamina + 0.24 * dt);

  if (p.sprinting) p.sprint = Math.max(0, p.sprint - 12 * dt);

  for (const bottle of state.bottles) {
    if (bottle.taken) continue;
    if (Math.abs(bottle.progress - p.progress) < 13 && Math.abs(bottle.x - p.x) < 34) {
      bottle.taken = true;
      p.bottleChain += 1;
      const gain = 14 + Math.min(10, p.bottleChain * 1.5);
      p.sprint = Math.min(100, p.sprint + gain);
      ui.message.textContent = `Bottle grabbed! +${Math.round(gain)} sprint strength.`;
    }
  }

  if (p.progress >= raceLength) {
    state.over = true;
    state.won = rankPlayer() === 1;
    ui.message.textContent = state.won ? 'Victory! You timed your race perfectly.' : 'Finished! Better drafting means a stronger finale.';
  }
}

function updateAI(dt) {
  const terrain = terrainAt(state.player.progress);
  for (const r of state.ai) {
    r.targetEffort += rand(-8, 8) * dt;
    r.targetEffort = Math.max(34, Math.min(92, r.targetEffort));

    let aiStamFactor = 0.68 + 0.32 * (r.stamina / 100);
    let pace = (6.5 + r.targetEffort * 0.185) * aiStamFactor * terrain.speedMul;

    if (state.player.progress > 3600 && Math.random() < 0.015) pace += rand(0.6, 1.7);

    r.speed = pace;
    r.progress += r.speed * dt;

    const burn = (0.06 + r.targetEffort * 0.011) * terrain.costMul;
    r.stamina = Math.max(0, r.stamina - burn * dt);

    if (r.stamina < 18) r.targetEffort -= 15 * dt;
    if (r.progress >= raceLength) r.progress = raceLength;

    r.x += rand(-30, 30) * dt;
    r.x = Math.max(road.x + 24, Math.min(road.x + road.width - 24, r.x));
  }
}

function rankPlayer() {
  const racers = [state.player, ...state.ai].sort((a, b) => b.progress - a.progress);
  return racers.findIndex(r => r === state.player) + 1;
}

function updateUI() {
  const p = state.player;
  const terrain = terrainAt(p.progress);
  const rank = rankPlayer();

  ui.effortBar.style.width = `${p.effort}%`;
  ui.staminaBar.style.width = `${p.stamina}%`;
  ui.sprintBar.style.width = `${p.sprint}%`;
  ui.distanceBar.style.width = `${(p.progress / raceLength) * 100}%`;

  ui.effortVal.textContent = `${Math.round(p.effort)}%`;
  ui.staminaVal.textContent = `${Math.round(p.stamina)}%`;
  ui.sprintVal.textContent = `${Math.round(p.sprint)}%`;
  ui.distanceVal.textContent = `${Math.round(p.progress)} / ${raceLength}m`;
  ui.rankVal.textContent = `${rank} / ${state.ai.length + 1}`;
  ui.zoneVal.textContent = terrain.name;
  ui.draftVal.textContent = p.drafting ? 'Yes (+efficiency)' : 'No';
  ui.activeSprintVal.textContent = p.sprinting ? 'On' : 'Off';
}

function drawRoad() {
  const p = state.player;
  ctx.fillStyle = '#2f374f';
  ctx.fillRect(road.x, 0, road.width, canvas.height);

  const seg = 52;
  const offset = -(p.progress * 3) % seg;
  ctx.strokeStyle = '#d9e2ff';
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 30]);
  ctx.beginPath();
  ctx.moveTo(road.x + road.width / 2, offset - seg);
  ctx.lineTo(road.x + road.width / 2, canvas.height + seg);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#20273b';
  ctx.fillRect(0, 0, road.x, canvas.height);
  ctx.fillRect(road.x + road.width, 0, canvas.width - (road.x + road.width), canvas.height);

  const terrain = terrainAt(p.progress);
  if (terrain.name === 'Headwind') {
    ctx.fillStyle = 'rgba(120, 180, 255, 0.11)';
    ctx.fillRect(road.x, 0, road.width, canvas.height);
  }
  if (terrain.name === 'Climb') {
    ctx.fillStyle = 'rgba(255, 190, 120, 0.1)';
    ctx.fillRect(road.x, 0, road.width, canvas.height);
  }
}

function drawRider(x, y, color, isPlayer = false) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, isPlayer ? 12 : 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#101826';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 15, y + 8);
  ctx.lineTo(x + 15, y + 8);
  ctx.stroke();

  if (isPlayer) {
    ctx.strokeStyle = '#8fffb5';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 16, y - 16, 32, 32);
  }
}

function drawBottles() {
  for (const bottle of state.bottles) {
    if (bottle.taken) continue;
    const y = state.player.y - (bottle.progress - state.player.progress) * 3;
    if (y < -30 || y > canvas.height + 30) continue;

    ctx.fillStyle = '#56d1ff';
    ctx.fillRect(bottle.x - 6, y - 12, 12, 20);
    ctx.fillStyle = '#c6f3ff';
    ctx.fillRect(bottle.x - 4, y - 16, 8, 4);
  }
}

function drawRacers() {
  for (const r of state.ai) {
    const y = state.player.y - (r.progress - state.player.progress) * 3;
    if (y < -40 || y > canvas.height + 40) continue;
    drawRider(r.x, y, r.color);
  }

  drawRider(state.player.x, state.player.y, '#7cff8a', true);

  if (state.player.drafting) {
    ctx.fillStyle = 'rgba(125, 221, 255, 0.22)';
    ctx.beginPath();
    ctx.ellipse(state.player.x, state.player.y + 4, 34, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFinishBanner() {
  if (state.player.progress < raceLength - 220) return;
  const y = state.player.y - (raceLength - state.player.progress) * 3;
  if (y < -80 || y > canvas.height + 20) return;

  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(road.x + 50, y - 8, road.width - 100, 16);
  ctx.fillStyle = '#111';
  for (let i = 0; i < 14; i++) {
    if (i % 2 === 0) ctx.fillRect(road.x + 50 + i * 34, y - 8, 17, 16);
  }
}

function drawOverlay() {
  if (!state.over) return;
  ctx.fillStyle = 'rgba(12, 16, 30, 0.72)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 44px Inter, sans-serif';
  ctx.fillText(state.won ? 'You Win!' : 'Race Complete', canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = '22px Inter, sans-serif';
  ctx.fillText(`Final rank: ${rankPlayer()} / ${state.ai.length + 1}`, canvas.width / 2, canvas.height / 2 + 18);
  ctx.fillText('Press R to race again', canvas.width / 2, canvas.height / 2 + 54);
}

function frame(ts) {
  if (!frame.last) frame.last = ts;
  const dt = Math.min(0.035, (ts - frame.last) / 1000);
  frame.last = ts;

  if (!state.over) {
    updatePlayer(dt);
    updateAI(dt);
  }

  drawRoad();
  drawBottles();
  drawFinishBanner();
  drawRacers();
  drawOverlay();
  updateUI();

  requestAnimationFrame(frame);
}

window.addEventListener('keydown', (e) => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','w','a','s','d','r'].includes(key)) e.preventDefault();
  if (key === 'r' && state.over) resetRace();
  state.keys.add(key);
});
window.addEventListener('keyup', (e) => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  state.keys.delete(key);
});

resetRace();
requestAnimationFrame(frame);
