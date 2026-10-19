/* ============================================================
   坦克大战 · Tank Battle
   纯 HTML5 Canvas 2D + 原生 JavaScript，无任何依赖
   ============================================================ */
(() => {
  'use strict';

  /* ---------------- 常量 ---------------- */
  const TILE = 32;
  const COLS = 15;
  const ROWS = 15;
  const FIELD = TILE * COLS;          // 480
  const TANK_SIZE = 28;
  const LANE = (TILE - TANK_SIZE) / 2; // 2
  const BASE_COL = 7;
  const BASE_ROW = 14;

  const T = { EMPTY: 0, BRICK: 1, STEEL: 2, WATER: 3, TREE: 4, BASE: 5 };

  const DIRS = {
    up: { x: 0, y: -1 },
    right: { x: 1, y: 0 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
  };
  const DIR_ANGLE = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const DIR_LIST = ['up', 'right', 'down', 'left'];

  const PLAYER_CFG = { speed: 100, hp: 1, bulletSpeed: 300 };

  const ENEMY_TYPES = {
    basic: { speed: 52, hp: 1, bulletSpeed: 235, score: 100, fireMin: 0.9, fireMax: 2.1 },
    fast: { speed: 106, hp: 1, bulletSpeed: 255, score: 200, fireMin: 0.8, fireMax: 1.9 },
    power: { speed: 64, hp: 1, bulletSpeed: 335, score: 300, fireMin: 0.7, fireMax: 1.5 },
    armor: { speed: 50, hp: 4, bulletSpeed: 245, score: 400, fireMin: 0.9, fireMax: 2.0 },
  };

  const STYLE = {
    player: { body: '#f5c542', light: '#ffe9a3', dark: '#8a6210', accent: '#fff6d8' },
    basic: { body: '#9fb3c8', light: '#dbe7f3', dark: '#4c5c6e', accent: '#eef6ff' },
    fast: { body: '#ff9f43', light: '#ffd6a3', dark: '#8a4b0c', accent: '#fff0dd' },
    power: { body: '#ef5b5b', light: '#ffb3b3', dark: '#7d1f1f', accent: '#ffe1e1' },
    armor: { body: '#a06ee1', light: '#dcc3ff', dark: '#4f2b85', accent: '#f2e7ff' },
  };

  const POWERUP_COLORS = {
    shield: '#63e6ff',
    star: '#ffc857',
    bomb: '#ff6b6b',
    life: '#7bed9f',
  };

  /* ---------------- 关卡地图 ----------------
     . 空地   B 砖墙   S 钢墙   W 河流   T 树林   */
  const MAPS = [
    {
      playerSpawn: [4, 14],
      rows: [
        '...............',
        '..BB...BB...BB.',
        '..BB...BB...BB.',
        '..BB...BB...BB.',
        '...............',
        'BBB..SS.SS..BBB',
        '...............',
        '..BB...BB...BB.',
        '..BB...BB...BB.',
        '..BB...BB...BB.',
        '.BB.BBBBBBB.BB.',
        '..B.........B..',
        '......BBB......',
        '......BBB......',
        '......B.B......',
      ],
    },
    {
      playerSpawn: [4, 14],
      rows: [
        '...............',
        '.SS...BBB...SS.',
        '.BB...B.B...BB.',
        '......B.B......',
        '..BB.......BB..',
        '..BB..WWW..BB..',
        '......WWW......',
        'BB....WWW....BB',
        'BB...........BB',
        '..BB..BBB..BB..',
        '..BB..B.B..BB..',
        '.....BBBBB.....',
        '.....BBBBB.....',
        '.....BBBBB.....',
        '.....BB.BB.....',
      ],
    },
    {
      playerSpawn: [4, 14],
      rows: [
        '...............',
        '.SS..BBBBB..SS.',
        '.SS..B.T.B..SS.',
        '.....B...B.....',
        '..TT.BBB.B.TT..',
        '..TT.......TT..',
        'BB..WW...WW..BB',
        'BB..WW...WW..BB',
        '..TT.......TT..',
        '..TT.BBBBB.TT..',
        '.....B...B.....',
        '..SS.B...B.SS..',
        '.....BBBBB.....',
        '.....BBBBB.....',
        '.....BB.BB.....',
      ],
    },
  ];

  /* ---------------- 工具函数 ---------------- */
  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function snapLane(v) {
    return Math.round((v - LANE) / TILE) * TILE + LANE;
  }

  function storageGet(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) { /* 忽略隐私模式异常 */ }
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function starPath(cx, cy, points, outer, inner) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = -Math.PI / 2 + (i * Math.PI) / points;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  /* ---------------- 音效（WebAudio，无需音频文件） ---------------- */
  const Sound = {
    enabled: storageGet('tankSound', 'on') !== 'off',
    ctx: null,

    init() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    },

    tone(freq, dur, type = 'square', vol = 0.04, endFreq = null) {
      if (!this.enabled || !this.ctx) return;
      const t0 = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (endFreq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
      }
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    },

    noise(dur = 0.3, vol = 0.1, cutoff = 1000) {
      if (!this.enabled || !this.ctx) return;
      const ac = this.ctx;
      const t0 = ac.currentTime;
      const length = Math.max(1, Math.floor(ac.sampleRate * dur));
      const buffer = ac.createBuffer(1, length, ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        const k = 1 - i / length;
        data[i] = (Math.random() * 2 - 1) * k * k;
      }
      const src = ac.createBufferSource();
      src.buffer = buffer;
      const filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoff, t0);
      filter.frequency.exponentialRampToValueAtTime(120, t0 + dur);
      const gain = ac.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter).connect(gain).connect(ac.destination);
      src.start(t0);
    },

    shoot() { this.tone(560, 0.07, 'square', 0.035, 150); },
    enemyShoot() { this.tone(300, 0.06, 'square', 0.016, 120); },
    hit() { this.tone(190, 0.05, 'square', 0.035, 90); },
    steel() { this.tone(1200, 0.05, 'triangle', 0.028, 2200); },
    explode(big = false) { this.noise(big ? 0.5 : 0.25, big ? 0.16 : 0.09, big ? 700 : 1300); },
    powerup() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.13, 'triangle', 0.04), i * 65)); },
    start() { [392, 523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.12, 'square', 0.03), i * 90)); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, 'triangle', 0.04), i * 110)); },
    gameover() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this.tone(f, 0.26, 'sawtooth', 0.035), i * 160)); },
  };

  /* ---------------- DOM ---------------- */
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const overlayKicker = document.getElementById('overlayKicker');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayText = document.getElementById('overlayText');
  const overlayBtn = document.getElementById('overlayBtn');
  const overlayHint = document.getElementById('overlayHint');
  const hudLevel = document.getElementById('hudLevel');
  const hudScore = document.getElementById('hudScore');
  const hudHigh = document.getElementById('hudHigh');
  const hudLives = document.getElementById('hudLives');
  const hudUpgrade = document.getElementById('hudUpgrade');
  const hudEnemies = document.getElementById('hudEnemies');
  const soundBtn = document.getElementById('soundBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const restartBtn = document.getElementById('restartBtn');
  const fireBtn = document.getElementById('fireBtn');

  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = FIELD * DPR;
  canvas.height = FIELD * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  /* ---------------- 游戏状态 ---------------- */
  const state = {
    mode: 'menu',            // menu | playing | paused | levelclear | gameover | victory
    level: 1,
    score: 0,
    high: Math.max(0, parseInt(storageGet('tankHigh', '0'), 10) || 0),
    lives: 3,
    upgrade: 0,
    time: 0,
    shake: 0,
    flashRed: 0,
    tiles: [],
    baseAlive: true,
    player: null,
    enemies: [],
    bullets: [],
    particles: [],
    rings: [],
    popups: [],
    powerups: [],
    spawnQueue: [],
    spawnTimer: 0,
    spawnIndex: 0,
    maxEnemies: 4,
    endTimer: null,
    endAction: null,
    respawnTimer: 0,
  };

  /* ---------------- 输入 ---------------- */
  const keys = { fire: false };
  const held = { up: false, down: false, left: false, right: false };
  const dirOrder = [];

  const KEY_DIRS = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
  };

  function setDirKey(dir, down) {
    if (down && !held[dir]) {
      held[dir] = true;
      dirOrder.push(dir);
    } else if (!down && held[dir]) {
      held[dir] = false;
      const i = dirOrder.indexOf(dir);
      if (i >= 0) dirOrder.splice(i, 1);
    }
  }

  function clearKeys() {
    keys.fire = false;
    for (const dir of DIR_LIST) held[dir] = false;
    dirOrder.length = 0;
    document.querySelectorAll('.dpad button.pressed, .fire.pressed').forEach((b) => b.classList.remove('pressed'));
  }

  /* ---------------- 界面 ---------------- */
  function showOverlay(opts) {
    overlayKicker.textContent = opts.kicker || '';
    overlayTitle.textContent = opts.title || '';
    overlayText.textContent = opts.text || '';
    overlayBtn.textContent = opts.button || '';
    overlayHint.textContent = opts.hint || '';
    overlay.classList.remove('hidden');
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  function refreshHud() {
    hudLevel.textContent = String(state.level);
    hudScore.textContent = String(state.score);
    hudHigh.textContent = String(Math.max(state.high, state.score));
    hudEnemies.textContent = String(state.spawnQueue.length + state.enemies.filter((e) => !e.dead).length);

    hudLives.innerHTML = '';
    if (state.lives > 0) {
      for (let i = 0; i < Math.min(state.lives, 9); i++) {
        const el = document.createElement('i');
        el.className = 'life-ico';
        hudLives.appendChild(el);
      }
    } else {
      const el = document.createElement('span');
      el.className = 'muted';
      el.textContent = '—';
      hudLives.appendChild(el);
    }

    hudUpgrade.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const el = document.createElement('span');
      el.className = 'star' + (i < state.upgrade ? ' on' : '');
      el.textContent = '★';
      hudUpgrade.appendChild(el);
    }
  }

  /* ---------------- 地图与关卡 ---------------- */
  function parseMap(map) {
    return map.rows.map((line) =>
      Array.from(line, (ch) => ({ '.': T.EMPTY, B: T.BRICK, S: T.STEEL, W: T.WATER, T: T.TREE }[ch] ?? T.EMPTY))
    );
  }

  function initPreview() {
    state.tiles = parseMap(MAPS[0]);
    state.tiles[BASE_ROW][BASE_COL] = T.BASE;
    state.baseAlive = true;
  }

  function buildQueue(level) {
    const total = 14 + level * 4;
    const weights = {
      basic: Math.max(1, 7 - level * 2),
      fast: 3,
      power: 2 + level,
      armor: level,
    };
    const pool = [];
    for (const [type, weight] of Object.entries(weights)) {
      for (let i = 0; i < weight; i++) pool.push(type);
    }
    const queue = [];
    for (let i = 0; i < total; i++) {
      queue.push({ type: pick(pool), bonus: (i + 1) % 4 === 0 });
    }
    return queue;
  }

  function makeTank(x, y, dir, kind) {
    const cfg = kind === 'player' ? PLAYER_CFG : ENEMY_TYPES[kind];
    return {
      x, y,
      w: TANK_SIZE,
      h: TANK_SIZE,
      dir,
      kind,
      isPlayer: kind === 'player',
      speed: cfg.speed,
      hp: cfg.hp,
      maxHp: cfg.hp,
      bulletSpeed: cfg.bulletSpeed,
      cooldown: 0,
      decision: rand(0.4, 1.2),
      moving: false,
      phase: 0,
      hitFlash: 0,
      invuln: 0,
      spawnFlash: 0,
      bonus: false,
      dead: false,
    };
  }

  function spawnPlayer() {
    const map = MAPS[(state.level - 1) % MAPS.length];
    // 优先使用地图出生点；被敌军占位时换用基地两侧的其他空位
    const candidates = [map.playerSpawn, [10, 14], [4, 13], [10, 13]];
    let spot = map.playerSpawn;
    for (const [col, row] of candidates) {
      const box = { x: col * TILE + LANE, y: row * TILE + LANE, w: TANK_SIZE, h: TANK_SIZE };
      const blocked = boxHitsSolid(box) || state.enemies.some((e) => !e.dead && rectsOverlap(box, e));
      if (!blocked) {
        spot = [col, row];
        break;
      }
    }
    const p = makeTank(spot[0] * TILE + LANE, spot[1] * TILE + LANE, 'up', 'player');
    p.invuln = 2.5;
    state.player = p;
    state.respawnTimer = 0;
  }

  function loadLevel(level) {
    state.level = level;
    const map = MAPS[(level - 1) % MAPS.length];
    state.tiles = parseMap(map);
    state.tiles[BASE_ROW][BASE_COL] = T.BASE;
    state.baseAlive = true;
    state.enemies = [];
    state.bullets = [];
    state.particles = [];
    state.rings = [];
    state.popups = [];
    state.powerups = [];
    state.spawnQueue = buildQueue(level);
    state.spawnTimer = 1.0;
    state.spawnIndex = 0;
    state.maxEnemies = Math.min(3 + level, 6);
    state.endTimer = null;
    state.endAction = null;
    state.respawnTimer = 0;
    state.shake = 0;
    state.flashRed = 0;
    state.player = null;
    spawnPlayer();
    clearKeys();
    refreshHud();
  }

  /* ---------------- 流程控制 ---------------- */
  function startGame() {
    Sound.init();
    state.mode = 'playing';
    state.score = 0;
    state.lives = 3;
    state.upgrade = 0;
    state.level = 1;
    loadLevel(1);
    hideOverlay();
    Sound.start();
    refreshHud();
  }

  function nextLevel() {
    Sound.init();
    state.mode = 'playing';
    loadLevel(state.level + 1);
    hideOverlay();
  }

  function pauseGame() {
    if (state.mode !== 'playing') return;
    state.mode = 'paused';
    clearKeys();
    showOverlay({
      kicker: 'PAUSED',
      title: '已暂停',
      text: '稍作休整，敌人可不会等你。',
      button: '继续战斗',
      hint: '按 P 或 Enter 继续',
    });
  }

  function resumeGame() {
    if (state.mode !== 'paused') return;
    state.mode = 'playing';
    hideOverlay();
    last = performance.now();
  }

  function endLevelClear() {
    refreshHud();
    if (state.level >= MAPS.length) {
      state.mode = 'victory';
      showOverlay({
        kicker: 'MISSION COMPLETE',
        title: '胜利！',
        text: `你守住了基地，击退了全部敌军。最终得分 ${state.score}。`,
        button: '再玩一次',
        hint: '按 Enter 重新开始',
      });
    } else {
      state.mode = 'levelclear';
      showOverlay({
        kicker: 'STAGE CLEAR',
        title: `第 ${state.level} 关完成`,
        text: `当前得分 ${state.score} · 剩余生命 ${state.lives}`,
        button: '进入下一关',
        hint: '按 Enter 继续',
      });
    }
  }

  function endGameOver(reason) {
    state.mode = 'gameover';
    state.high = Math.max(state.high, state.score);
    storageSet('tankHigh', String(state.high));
    Sound.gameover();
    showOverlay({
      kicker: 'GAME OVER',
      title: '战斗结束',
      text: `${reason} · 本次得分 ${state.score}`,
      button: '再来一次',
      hint: '按 Enter 重新开始',
    });
    refreshHud();
  }

  function handleAction() {
    Sound.init();
    switch (state.mode) {
      case 'menu':
      case 'gameover':
      case 'victory':
        startGame();
        break;
      case 'levelclear':
        nextLevel();
        break;
      case 'paused':
        resumeGame();
        break;
      default:
        break;
    }
  }

  /* ---------------- 碰撞 ---------------- */
  function allTanks() {
    const list = state.enemies.slice();
    if (state.player) list.push(state.player);
    return list;
  }

  function boxHitsSolid(box) {
    const c0 = Math.floor(box.x / TILE);
    const c1 = Math.floor((box.x + box.w - 1) / TILE);
    const r0 = Math.floor(box.y / TILE);
    const r1 = Math.floor((box.y + box.h - 1) / TILE);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return true;
        const tile = state.tiles[r][c];
        if (tile === T.BRICK || tile === T.STEEL || tile === T.WATER || tile === T.BASE) return true;
      }
    }
    return false;
  }

  function tankBlockedAt(tank, x, y) {
    if (x < 0 || y < 0 || x + tank.w > FIELD || y + tank.h > FIELD) return true;
    const box = { x, y, w: tank.w, h: tank.h };
    if (boxHitsSolid(box)) return true;
    for (const other of allTanks()) {
      if (other === tank || other.dead) continue;
      if (rectsOverlap(box, other)) return true;
    }
    return false;
  }

  function setDir(tank, dir) {
    if (!DIRS[dir] || tank.dir === dir) return;
    const prev = tank.dir;
    tank.dir = dir;
    // 转向时吸附到通道中线，便于穿过一格宽的缝隙
    if (DIRS[dir].x !== 0 && DIRS[prev].y !== 0) {
      const ny = snapLane(tank.y);
      if (!tankBlockedAt(tank, tank.x, ny)) tank.y = ny;
    } else if (DIRS[dir].y !== 0 && DIRS[prev].x !== 0) {
      const nx = snapLane(tank.x);
      if (!tankBlockedAt(tank, nx, tank.y)) tank.x = nx;
    }
  }

  function moveTank(tank, dt) {
    const dir = DIRS[tank.dir];
    const dist = tank.speed * dt;
    const nx = tank.x + dir.x * dist;
    const ny = tank.y + dir.y * dist;
    if (tankBlockedAt(tank, nx, ny)) {
      tank.moving = false;
      return false;
    }
    tank.x = nx;
    tank.y = ny;
    tank.phase = (tank.phase || 0) + dist;
    tank.moving = true;
    return true;
  }

  function canMoveDir(tank, dir) {
    const d = DIRS[dir];
    let tx = tank.x;
    let ty = tank.y;
    if (d.x !== 0) ty = snapLane(ty);
    else tx = snapLane(tx);

    if (tankBlockedAt(tank, tx, ty)) {
      tx = tank.x;
      ty = tank.y;
      if (tankBlockedAt(tank, tx, ty)) return false;
    }
    return !tankBlockedAt(tank, tx + d.x * 6, ty + d.y * 6);
  }

  function chooseDirection(tank, blocked) {
    const options = [];
    for (const dir of DIR_LIST) {
      if (blocked && dir === OPPOSITE[tank.dir]) continue;
      if (canMoveDir(tank, dir)) options.push(dir);
    }
    if (options.length === 0) {
      for (const dir of DIR_LIST) {
        if (canMoveDir(tank, dir)) options.push(dir);
      }
    }
    if (options.length === 0) return;

    const weighted = options.map((dir) => {
      let weight = 1;
      if (dir === 'down') weight += 3 + state.level * 0.7;   // 更倾向于扑向基地
      if (dir === 'up') weight += 0.25;
      if (dir === 'left' || dir === 'right') weight += 1;
      if (!blocked && dir === OPPOSITE[tank.dir]) weight *= 0.15;
      return { dir, weight };
    });

    const total = weighted.reduce((sum, o) => sum + o.weight, 0);
    let roll = Math.random() * total;
    let chosen = weighted[weighted.length - 1].dir;
    for (const option of weighted) {
      roll -= option.weight;
      if (roll <= 0) { chosen = option.dir; break; }
    }
    setDir(tank, chosen);
  }

  /* ---------------- 粒子 / 爆炸 ---------------- */
  function makeParticle(x, y, color, speed, life, size, angle) {
    const a = angle === undefined ? Math.random() * Math.PI * 2 : angle + rand(-0.7, 0.7);
    return {
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      color,
      size,
      life,
      maxLife: life,
      round: Math.random() < 0.5,
    };
  }

  function explosion(x, y, big) {
    const count = big ? 30 : 16;
    const colors = big
      ? ['#fff3c4', '#ffd166', '#ff9f43', '#ff6b3d']
      : ['#ffe08a', '#ffb347', '#ff7b3d'];
    for (let i = 0; i < count; i++) {
      state.particles.push(makeParticle(
        x, y, colors[i % colors.length],
        rand(40, big ? 250 : 150),
        rand(0.25, big ? 0.75 : 0.5),
        rand(1.5, big ? 4.5 : 3)
      ));
    }
    state.rings.push({
      x, y,
      r: 4,
      maxR: big ? 64 : 34,
      life: 0.38,
      maxLife: 0.38,
      color: big ? '255, 190, 90' : '255, 200, 120',
    });
    state.shake = Math.max(state.shake, big ? 10 : 3.5);
  }

  function spark(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      state.particles.push(makeParticle(x, y, color, rand(30, 120), rand(0.12, 0.35), rand(1, 2.4)));
    }
  }

  function brickBurst(col, row, color) {
    const x = col * TILE + TILE / 2;
    const y = row * TILE + TILE / 2;
    for (let i = 0; i < 11; i++) {
      state.particles.push(makeParticle(
        x, y,
        color || pick(['#b45430', '#8a3d22', '#d1794b']),
        rand(30, 130),
        rand(0.2, 0.5),
        rand(1.2, 3)
      ));
    }
  }

  function addPopup(x, y, text, color = '#ffe08a') {
    state.popups.push({ x, y, text, color, life: 1.0, maxLife: 1.0 });
  }

  /* ---------------- 道具 ---------------- */
  function findFreeSpot() {
    for (let attempt = 0; attempt < 60; attempt++) {
      const col = Math.floor(Math.random() * COLS);
      const row = Math.floor(Math.random() * ROWS);
      if (state.tiles[row][col] !== T.EMPTY) continue;
      if (row === BASE_ROW && col === BASE_COL) continue;

      const box = { x: col * TILE + 2, y: row * TILE + 2, w: TILE - 4, h: TILE - 4 };
      let occupied = false;
      for (const tank of allTanks()) {
        if (!tank.dead && rectsOverlap(box, tank)) { occupied = true; break; }
      }
      if (occupied) continue;
      for (const u of state.powerups) {
        if (rectsOverlap(box, u)) { occupied = true; break; }
      }
      if (occupied) continue;
      return { col, row };
    }
    return null;
  }

  function dropPowerup() {
    if (state.powerups.length >= 2) return;
    const spot = findFreeSpot();
    if (!spot) return;
    state.powerups.push({
      type: pick(['shield', 'star', 'bomb', 'life']),
      x: spot.col * TILE + 4,
      y: spot.row * TILE + 4,
      w: 24,
      h: 24,
      life: 15,
      t: 0,
      dead: false,
    });
  }

  function applyPowerup(item) {
    Sound.powerup();
    const cx = item.x + item.w / 2;
    const cy = item.y + item.h / 2;
    const color = POWERUP_COLORS[item.type];
    for (let i = 0; i < 14; i++) {
      state.particles.push(makeParticle(cx, cy, color, rand(30, 110), rand(0.25, 0.6), rand(1.2, 2.6)));
    }

    switch (item.type) {
      case 'shield': {
        const p = state.player;
        if (p) p.invuln = Math.max(p.invuln, 9);
        addPopup(cx, cy - 14, '护盾', color);
        break;
      }
      case 'star':
        state.upgrade = Math.min(3, state.upgrade + 1);
        addPopup(cx, cy - 14, '强化', color);
        refreshHud();
        break;
      case 'bomb':
        for (const e of state.enemies) {
          if (!e.dead && e.spawnFlash <= 0) killEnemy(e, true);
        }
        state.enemies = state.enemies.filter((e) => !e.dead);
        state.shake = 14;
        addPopup(FIELD / 2, FIELD / 2 - 34, '全屏轰炸', color);
        refreshHud();
        break;
      case 'life':
        state.lives = Math.min(9, state.lives + 1);
        addPopup(cx, cy - 14, '+1 生命', color);
        refreshHud();
        break;
      default:
        break;
    }
  }

  /* ---------------- 战斗 ---------------- */
  function spawnBullet(tank) {
    const d = DIRS[tank.dir];
    const cx = tank.x + tank.w / 2 + d.x * (tank.w / 2 + 1);
    const cy = tank.y + tank.h / 2 + d.y * (tank.h / 2 + 1);
    state.bullets.push({
      x: cx - 3,
      y: cy - 3,
      w: 6,
      h: 6,
      dir: tank.dir,
      speed: tank.isPlayer ? 300 + state.upgrade * 45 : tank.bulletSpeed,
      owner: tank,
      fromPlayer: tank.isPlayer,
      power: tank.isPlayer && state.upgrade >= 3 ? 2 : 1,
      life: 3,
      dead: false,
    });
    for (let i = 0; i < 4; i++) {
      state.particles.push(makeParticle(
        cx, cy,
        tank.isPlayer ? '#ffe08a' : '#ffb0b0',
        rand(40, 90),
        rand(0.08, 0.2),
        rand(1, 2)
      ));
    }
  }

  function tryFire(tank) {
    if (tank.cooldown > 0 || tank.spawnFlash > 0) return false;

    const maxBullets = tank.isPlayer ? (state.upgrade >= 3 ? 2 : 1) : 1;
    let count = 0;
    for (const b of state.bullets) {
      if (!b.dead && b.owner === tank) count++;
    }
    if (count >= maxBullets) return false;

    if (tank.isPlayer) {
      tank.cooldown = Math.max(0.2, 0.36 - state.upgrade * 0.04);
      Sound.shoot();
    } else {
      const cfg = ENEMY_TYPES[tank.kind];
      tank.cooldown = rand(cfg.fireMin, cfg.fireMax);
      Sound.enemyShoot();
    }
    spawnBullet(tank);
    return true;
  }

  function killEnemy(enemy, noDrop) {
    if (enemy.dead) return;
    enemy.dead = true;
    const cfg = ENEMY_TYPES[enemy.kind];
    state.score += cfg.score;
    addPopup(enemy.x + enemy.w / 2, enemy.y + 2, `+${cfg.score}`);
    explosion(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.kind === 'armor');
    Sound.explode(enemy.kind === 'armor');
    if (!noDrop && (enemy.bonus || Math.random() < 0.18)) dropPowerup();
    state.high = Math.max(state.high, state.score);
    storageSet('tankHigh', String(state.high));
    refreshHud();
  }

  function hitPlayer() {
    const p = state.player;
    if (!p || p.invuln > 0 || state.endTimer !== null) return;

    explosion(p.x + p.w / 2, p.y + p.h / 2, true);
    Sound.explode(true);
    state.player = null;
    state.lives -= 1;
    state.upgrade = 0;
    state.shake = 12;
    refreshHud();

    if (state.lives > 0) {
      state.respawnTimer = 1.3;
    } else {
      triggerEnd('你的坦克全部被击毁', 1.6);
    }
  }

  function destroyBase() {
    // 结算动画期间忽略命中，避免已判定的关卡结果被残留子弹改写
    if (!state.baseAlive || state.endTimer !== null) return;
    state.baseAlive = false;
    const x = BASE_COL * TILE + TILE / 2;
    const y = BASE_ROW * TILE + TILE / 2;
    explosion(x, y, true);
    explosion(x - 9, y + 7, false);
    state.flashRed = 0.85;
    state.shake = 18;
    Sound.explode(true);
    triggerEnd('基地被摧毁', 1.9);
  }

  function triggerEnd(reason, delay) {
    if (state.endTimer !== null) return;
    state.endTimer = delay;
    state.endAction = { type: 'gameover', reason };
  }

  function beginClear() {
    if (state.endTimer !== null) return;
    state.endTimer = 1.4;
    state.endAction = { type: 'clear' };
    Sound.win();
    addPopup(FIELD / 2, FIELD / 2 - 30, '阶段完成', '#ffc857');
  }

  function resolveBullet(b) {
    if (b.dead) return;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;

    if (b.x < 0 || b.y < 0 || b.x + b.w > FIELD || b.y + b.h > FIELD) {
      b.dead = true;
      spark(clamp(cx, 2, FIELD - 2), clamp(cy, 2, FIELD - 2), '#ffd166', 4);
      return;
    }

    const c0 = Math.floor(b.x / TILE);
    const c1 = Math.floor((b.x + b.w - 1) / TILE);
    const r0 = Math.floor(b.y / TILE);
    const r1 = Math.floor((b.y + b.h - 1) / TILE);

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (r < 0 || c < 0 || r >= ROWS || c >= COLS) continue;
        const tile = state.tiles[r][c];

        if (tile === T.BRICK) {
          state.tiles[r][c] = T.EMPTY;
          brickBurst(c, r);
          b.dead = true;
          Sound.hit();
          return;
        }
        if (tile === T.STEEL) {
          if (b.power >= 2) {
            state.tiles[r][c] = T.EMPTY;
            brickBurst(c, r, '#c9d6e4');
          } else {
            spark(cx, cy, '#c9d6e4', 5);
          }
          b.dead = true;
          Sound.steel();
          return;
        }
        if (tile === T.BASE) {
          b.dead = true;
          destroyBase();
          return;
        }
      }
    }

    if (b.fromPlayer) {
      for (const enemy of state.enemies) {
        if (enemy.dead || enemy.spawnFlash > 0) continue;
        if (rectsOverlap(b, enemy)) {
          b.dead = true;
          enemy.hp -= 1;
          enemy.hitFlash = 0.15;
          if (enemy.hp <= 0) {
            killEnemy(enemy);
          } else {
            spark(cx, cy, '#ffe08a', 6);
            Sound.hit();
          }
          return;
        }
      }
    } else {
      const p = state.player;
      if (p && p.invuln <= 0 && rectsOverlap(b, p)) {
        b.dead = true;
        hitPlayer();
        return;
      }
    }
  }

  /* ---------------- 更新 ---------------- */
  function updatePlayer(dt) {
    const p = state.player;
    if (!p) {
      if (state.respawnTimer > 0) {
        state.respawnTimer -= dt;
        if (state.respawnTimer <= 0) spawnPlayer();
      }
      return;
    }

    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
    if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - dt);
    if (p.cooldown > 0) p.cooldown = Math.max(0, p.cooldown - dt);

    const dir = dirOrder[dirOrder.length - 1];
    if (dir) {
      setDir(p, dir);
      moveTank(p, dt);
    } else {
      p.moving = false;
    }

    if (keys.fire) tryFire(p);
  }

  function isAimingAtTarget(enemy) {
    const d = DIRS[enemy.dir];
    const cx = enemy.x + enemy.w / 2;
    const cy = enemy.y + enemy.h / 2;

    const p = state.player;
    if (p) {
      const px = p.x + p.w / 2;
      const py = p.y + p.h / 2;
      if (d.x !== 0 && Math.abs(cy - py) < 18 && Math.sign(px - cx) === d.x) return true;
      if (d.y !== 0 && Math.abs(cx - px) < 18 && Math.sign(py - cy) === d.y) return true;
    }

    if (state.baseAlive) {
      const bx = BASE_COL * TILE + TILE / 2;
      const by = BASE_ROW * TILE + TILE / 2;
      if (d.x !== 0 && Math.abs(cy - by) < 18 && Math.sign(bx - cx) === d.x) return true;
      if (d.y !== 0 && Math.abs(cx - bx) < 18 && Math.sign(by - cy) === d.y) return true;
    }
    return false;
  }

  function updateEnemies(dt) {
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;

      if (enemy.spawnFlash > 0) {
        enemy.spawnFlash = Math.max(0, enemy.spawnFlash - dt);
        continue;
      }

      if (enemy.hitFlash > 0) enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      if (enemy.cooldown > 0) enemy.cooldown = Math.max(0, enemy.cooldown - dt);
      enemy.decision -= dt;

      if (enemy.cooldown <= 0) {
        if (isAimingAtTarget(enemy)) {
          tryFire(enemy);
        } else if (Math.random() < 0.5 * dt) {
          tryFire(enemy);
        }
      }

      const moved = moveTank(enemy, dt);
      if (!moved) {
        chooseDirection(enemy, true);
        enemy.decision = rand(0.5, 1.0);
      } else if (enemy.decision <= 0) {
        if (Math.random() < 0.45) chooseDirection(enemy, false);
        else enemy.decision = rand(0.8, 1.8);
      }
    }

    state.enemies = state.enemies.filter((e) => !e.dead);
  }

  function updateSpawns(dt) {
    if (state.spawnQueue.length === 0) return;

    state.spawnTimer -= dt;
    if (state.spawnTimer > 0) return;
    if (state.enemies.length >= state.maxEnemies) {
      state.spawnTimer = 0.5;
      return;
    }

    const points = [[0, 0], [7, 0], [14, 0]];
    const start = state.spawnIndex % points.length;

    for (let i = 0; i < points.length; i++) {
      const [col, row] = points[(start + i) % points.length];
      const x = col * TILE + LANE;
      const y = row * TILE + LANE;
      const box = { x, y, w: TANK_SIZE, h: TANK_SIZE };

      let free = !boxHitsSolid(box);
      if (free) {
        for (const tank of allTanks()) {
          if (!tank.dead && rectsOverlap(box, tank)) { free = false; break; }
        }
      }
      if (!free) continue;

      const next = state.spawnQueue.shift();
      const enemy = makeTank(x, y, 'down', next.type);
      enemy.bonus = next.bonus;
      enemy.spawnFlash = 1.0;
      enemy.decision = rand(0.5, 1.2);
      state.enemies.push(enemy);

      state.spawnIndex = (start + i + 1) % points.length;
      state.spawnTimer = Math.max(0.8, 2.2 - state.level * 0.15);
      refreshHud();
      return;
    }

    state.spawnTimer = 0.4;
  }

  function updateBullets(dt) {
    for (const b of state.bullets) {
      if (b.dead) continue;
      b.life -= dt;
      if (b.life <= 0) { b.dead = true; continue; }

      const d = DIRS[b.dir];
      let remain = b.speed * dt;
      while (remain > 0 && !b.dead) {
        const step = Math.min(remain, 6);
        remain -= step;
        b.x += d.x * step;
        b.y += d.y * step;
        resolveBullet(b);
      }
    }

    // 子弹对撞
    for (let i = 0; i < state.bullets.length; i++) {
      const a = state.bullets[i];
      if (a.dead) continue;
      for (let j = i + 1; j < state.bullets.length; j++) {
        const b = state.bullets[j];
        if (b.dead || a.fromPlayer === b.fromPlayer) continue;
        if (rectsOverlap(a, b)) {
          a.dead = true;
          b.dead = true;
          spark(a.x + 3, a.y + 3, '#ffe08a', 5);
          Sound.hit();
          break;
        }
      }
    }

    state.bullets = state.bullets.filter((b) => !b.dead);
  }

  function updatePowerups(dt) {
    const p = state.player;
    for (const item of state.powerups) {
      if (item.dead) continue;
      item.t += dt;
      item.life -= dt;
      if (item.life <= 0) { item.dead = true; continue; }
      if (p && rectsOverlap(item, p)) {
        item.dead = true;
        applyPowerup(item);
      }
    }
    state.powerups = state.powerups.filter((item) => !item.dead);
  }

  function updateParticles(dt) {
    for (const p of state.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 3 * dt;
      p.vy *= 1 - 3 * dt;
    }
    state.particles = state.particles.filter((p) => p.life > 0);

    for (const ring of state.rings) {
      ring.life -= dt;
      const progress = 1 - Math.max(0, ring.life / ring.maxLife);
      ring.r = 4 + progress * (ring.maxR - 4);
    }
    state.rings = state.rings.filter((r) => r.life > 0);

    for (const popup of state.popups) {
      popup.life -= dt;
      popup.y -= 18 * dt;
    }
    state.popups = state.popups.filter((p) => p.life > 0);
  }

  function update(dt) {
    state.time += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
    if (state.flashRed > 0) state.flashRed = Math.max(0, state.flashRed - dt * 1.4);

    if (state.mode === 'paused') return;

    updateParticles(dt);

    if (state.mode !== 'playing') return;

    if (state.endTimer !== null) {
      state.endTimer -= dt;
      updateBullets(dt);
      if (state.endTimer <= 0) {
        const action = state.endAction;
        state.endTimer = null;
        state.endAction = null;
        if (action && action.type === 'clear') endLevelClear();
        else endGameOver(action ? action.reason : '战斗结束');
      }
      return;
    }

    updateSpawns(dt);
    updatePlayer(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updatePowerups(dt);

    if (state.endTimer === null && state.baseAlive && state.spawnQueue.length === 0 && state.enemies.length === 0) {
      beginClear();
    }
  }

  /* ---------------- 渲染 ---------------- */
  function drawGround() {
    ctx.fillStyle = '#070a0e';
    ctx.fillRect(0, 0, FIELD, FIELD);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if ((r + c) % 2 === 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.014)';
          ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
        }
      }
    }

    ctx.strokeStyle = 'rgba(120, 180, 255, 0.035)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < COLS; i++) {
      ctx.moveTo(i * TILE + 0.5, 0);
      ctx.lineTo(i * TILE + 0.5, FIELD);
    }
    for (let i = 1; i < ROWS; i++) {
      ctx.moveTo(0, i * TILE + 0.5);
      ctx.lineTo(FIELD, i * TILE + 0.5);
    }
    ctx.stroke();
  }

  function drawBrick(c, r) {
    const x = c * TILE;
    const y = r * TILE;
    const palette = ['#b05a35', '#a44f2c', '#bd6540'];

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, TILE, TILE);
    ctx.clip();
    ctx.fillStyle = '#2a1610';
    ctx.fillRect(x, y, TILE, TILE);

    for (let row = 0; row < 4; row++) {
      const yy = y + row * 8;
      const offset = (row % 2) * 8;
      for (let i = -1; i < 3; i++) {
        const bx = x + i * 16 + offset;
        ctx.fillStyle = palette[Math.abs(c * 3 + r * 5 + row + i + 9) % 3];
        ctx.fillRect(bx + 1, yy + 1, 14, 6);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.11)';
        ctx.fillRect(bx + 1, yy + 1, 14, 1);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(bx + 1, yy + 6, 14, 1);
      }
    }
    ctx.restore();
  }

  function drawSteel(c, r) {
    const x = c * TILE;
    const y = r * TILE;

    ctx.fillStyle = '#39424e';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#7c8b9e';
    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.fillStyle = '#aebbc9';
    ctx.fillRect(x + 3, y + 3, TILE - 6, 3);
    ctx.fillRect(x + 3, y + 3, 3, TILE - 6);
    ctx.fillStyle = '#55606e';
    ctx.fillRect(x + 3, y + TILE - 6, TILE - 6, 3);
    ctx.fillRect(x + TILE - 6, y + 3, 3, TILE - 6);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
    for (const [ox, oy] of [[7, 7], [TILE - 7, 7], [7, TILE - 7], [TILE - 7, TILE - 7]]) {
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWater(c, r) {
    const x = c * TILE;
    const y = r * TILE;
    const time = state.time;

    ctx.fillStyle = '#0c2337';
    ctx.fillRect(x, y, TILE, TILE);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, TILE, TILE);
    ctx.clip();

    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(90, 190, 255, ${0.16 + i * 0.07})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const baseY = y + 8 + i * 9;
      for (let px = 0; px <= TILE; px += 4) {
        const py = baseY + Math.sin((px + time * 40 + c * 9 + i * 7 + r * 5) / 9) * 2;
        if (px === 0) ctx.moveTo(x + px, py);
        else ctx.lineTo(x + px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTree(c, r) {
    const x = c * TILE + TILE / 2;
    const y = r * TILE + TILE / 2;

    ctx.save();
    ctx.globalAlpha = 0.94;
    const blobs = [[-7, -6, 10], [7, -5, 9], [0, 0, 12], [-8, 6, 8], [8, 7, 8]];
    const colors = ['#164a29', '#1b5c33', '#206b3b', '#164a29', '#1b5c33'];
    for (let i = 0; i < blobs.length; i++) {
      const [dx, dy, radius] = blobs[i];
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(120, 220, 150, 0.22)';
    ctx.beginPath();
    ctx.arc(x - 4, y - 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBase() {
    const x = BASE_COL * TILE;
    const y = BASE_ROW * TILE;

    ctx.fillStyle = '#10151c';
    ctx.fillRect(x, y, TILE, TILE);

    if (!state.baseAlive) {
      ctx.fillStyle = '#2a2f38';
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 26);
      ctx.lineTo(x + 10, y + 16);
      ctx.lineTo(x + 16, y + 22);
      ctx.lineTo(x + 23, y + 12);
      ctx.lineTo(x + 28, y + 26);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 90, 90, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 9, y + 9);
      ctx.lineTo(x + 24, y + 24);
      ctx.moveTo(x + 24, y + 9);
      ctx.lineTo(x + 9, y + 24);
      ctx.stroke();
      return;
    }

    const pulse = 0.5 + Math.sin(state.time * 3) * 0.5;

    ctx.save();
    ctx.translate(x + TILE / 2, y + TILE / 2);
    ctx.shadowColor = `rgba(255, 190, 80, ${0.32 + pulse * 0.36})`;
    ctx.shadowBlur = 10;

    ctx.fillStyle = '#232b36';
    roundRect(-13, -13, 26, 26, 5);
    ctx.fill();

    const gradient = ctx.createLinearGradient(0, -14, 0, 14);
    gradient.addColorStop(0, '#ffe39a');
    gradient.addColorStop(0.5, '#ffc857');
    gradient.addColorStop(1, '#c98f16');
    ctx.fillStyle = gradient;

    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(10, -7);
    ctx.lineTo(9, 4);
    ctx.lineTo(0, 12);
    ctx.lineTo(-9, 4);
    ctx.lineTo(-10, -7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(90, 55, 0, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#5a3a00';
    starPath(0, 0, 5, 5.6, 2.4);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 245, 210, 0.92)';
    ctx.beginPath();
    ctx.moveTo(-11, -4);
    ctx.lineTo(-15, -1);
    ctx.lineTo(-11, 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(11, -4);
    ctx.lineTo(15, -1);
    ctx.lineTo(11, 2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawTank(tank) {
    const style = STYLE[tank.kind] || STYLE.basic;

    ctx.save();
    ctx.translate(tank.x + tank.w / 2, tank.y + tank.h / 2);
    ctx.rotate(DIR_ANGLE[tank.dir]);

    const w = tank.w;
    const h = tank.h;

    // 影子
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);

    // 履带
    ctx.fillStyle = style.dark;
    ctx.fillRect(-w / 2, -h / 2 + 1, 7, h - 2);
    ctx.fillRect(w / 2 - 7, -h / 2 + 1, 7, h - 2);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    const phase = Math.floor((tank.phase || 0) / 4) % 4;
    for (let i = -h / 2 + 2 + phase; i < h / 2 - 2; i += 5) {
      ctx.fillRect(-w / 2 + 1, i, 5, 2);
      ctx.fillRect(w / 2 - 6, i, 5, 2);
    }

    // 车身
    const gradient = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    gradient.addColorStop(0, style.light);
    gradient.addColorStop(0.5, style.body);
    gradient.addColorStop(1, style.dark);
    ctx.fillStyle = gradient;
    roundRect(-w / 2 + 6, -h / 2 + 3, w - 12, h - 6, 3);
    ctx.fill();

    // 车灯
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillRect(-w / 2 + 8, -h / 2 + 4, 2, 2);
    ctx.fillRect(w / 2 - 10, -h / 2 + 4, 2, 2);

    // 炮管
    ctx.fillStyle = style.dark;
    ctx.fillRect(-3, -h / 2 - 5, 6, h / 2 + 3);
    ctx.fillStyle = style.light;
    ctx.fillRect(-1, -h / 2 - 5, 2, h / 2 + 3);

    // 炮塔
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fillStyle = style.body;
    ctx.fill();
    ctx.strokeStyle = style.accent;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = style.dark;
    ctx.fill();

    // 受击闪白
    if (tank.hitFlash > 0) {
      ctx.globalAlpha = Math.min(0.8, tank.hitFlash * 5);
      ctx.fillStyle = '#ffffff';
      roundRect(-w / 2 + 4, -h / 2 + 1, w - 8, h - 2, 4);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // 重甲血条
    if (!tank.isPlayer && tank.maxHp > 1) {
      const bw = 22;
      const bx = tank.x + (tank.w - bw) / 2;
      const by = tank.y - 6;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(bx, by, bw, 3);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(bx, by, bw * (tank.hp / tank.maxHp), 3);
    }

    // 携带道具的敌人：金色虚线光环
    if (!tank.isPlayer && tank.bonus) {
      ctx.save();
      ctx.translate(tank.x + tank.w / 2, tank.y + tank.h / 2);
      const glow = 0.32 + Math.sin(state.time * 6) * 0.22;
      ctx.strokeStyle = `rgba(255, 200, 87, ${glow})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, 18, state.time * 1.5, state.time * 1.5 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 护盾
    if (tank.isPlayer && tank.invuln > 0) {
      ctx.save();
      ctx.translate(tank.x + tank.w / 2, tank.y + tank.h / 2);
      const alpha = 0.32 + Math.sin(state.time * 14) * 0.18;
      ctx.strokeStyle = `rgba(99, 230, 255, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(0, 0, 19, state.time * 2, state.time * 2 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  function drawSpawnFlash(enemy) {
    const cx = enemy.x + enemy.w / 2;
    const cy = enemy.y + enemy.h / 2;
    const alpha = 0.5 + Math.sin(state.time * 30) * 0.4;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.time * 8);
    ctx.strokeStyle = `rgba(255, 225, 140, ${alpha})`;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 4, Math.sin(angle) * 4);
      ctx.lineTo(Math.cos(angle) * 15, Math.sin(angle) * 15);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 240, 180, 0.9)';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPowerupIcon(type, cx, cy, color) {
    ctx.save();
    ctx.translate(cx, cy);

    if (type === 'shield') {
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(7, -4);
      ctx.lineTo(6, 4);
      ctx.lineTo(0, 8);
      ctx.lineTo(-6, 4);
      ctx.lineTo(-7, -4);
      ctx.closePath();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    } else if (type === 'star') {
      ctx.fillStyle = color;
      starPath(0, 0, 5, 8, 3.6);
      ctx.fill();
    } else if (type === 'bomb') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffcf9e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(2, -4);
      ctx.quadraticCurveTo(6, -10, 9, -7);
      ctx.stroke();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(9, -7, 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'life') {
      ctx.fillStyle = color;
      roundRect(-2, -7, 4, 14, 1.5);
      ctx.fill();
      roundRect(-7, -2, 14, 4, 1.5);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawPowerups() {
    for (const item of state.powerups) {
      if (item.life < 3 && Math.floor(item.life * 8) % 2 === 0) continue;

      const color = POWERUP_COLORS[item.type];
      const pulse = 0.5 + Math.sin(state.time * 6 + item.t * 3) * 0.5;

      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12 + pulse * 8;
      ctx.fillStyle = 'rgba(8, 14, 20, 0.92)';
      roundRect(item.x, item.y, item.w, item.h, 6);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
      drawPowerupIcon(item.type, item.x + item.w / 2, item.y + item.h / 2, color);
      ctx.restore();
    }
  }

  function drawBullets() {
    for (const b of state.bullets) {
      if (b.dead) continue;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const d = DIRS[b.dir];

      ctx.strokeStyle = b.fromPlayer ? 'rgba(255, 220, 120, 0.5)' : 'rgba(255, 110, 110, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - d.x * 5, cy - d.y * 5);
      ctx.lineTo(cx - d.x * 13, cy - d.y * 13);
      ctx.stroke();

      ctx.save();
      ctx.shadowColor = b.fromPlayer ? '#ffd166' : '#ff6b6b';
      ctx.shadowBlur = 10;
      ctx.fillStyle = b.fromPlayer ? '#fff3c4' : '#ffd0d0';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of state.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha + 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawRings() {
    for (const ring of state.rings) {
      const alpha = Math.max(0, ring.life / ring.maxLife);
      ctx.strokeStyle = `rgba(${ring.color}, ${alpha * 0.65})`;
      ctx.lineWidth = 2 * alpha + 0.5;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawPopups() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 12px "Segoe UI", "Microsoft YaHei", sans-serif';
    for (const popup of state.popups) {
      const alpha = Math.min(1, (popup.life / popup.maxLife) * 1.8);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 2.5;
      ctx.strokeText(popup.text, popup.x, popup.y);
      ctx.fillStyle = popup.color;
      ctx.fillText(popup.text, popup.x, popup.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function render() {
    ctx.save();

    if (state.shake > 0.3) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }

    drawGround();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = state.tiles[r][c];
        if (tile === T.BRICK) drawBrick(c, r);
        else if (tile === T.STEEL) drawSteel(c, r);
        else if (tile === T.WATER) drawWater(c, r);
      }
    }

    drawBase();
    drawPowerups();

    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      if (enemy.spawnFlash > 0) drawSpawnFlash(enemy);
      else drawTank(enemy);
    }
    if (state.player) drawTank(state.player);

    drawBullets();
    drawParticles();
    drawRings();

    // 树林盖在坦克与子弹之上
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (state.tiles[r][c] === T.TREE) drawTree(c, r);
      }
    }

    drawPopups();

    if (state.flashRed > 0) {
      ctx.fillStyle = `rgba(255, 40, 40, ${Math.min(0.5, state.flashRed * 0.4)})`;
      ctx.fillRect(0, 0, FIELD, FIELD);
    }

    ctx.restore();
  }

  /* ---------------- 事件绑定 ---------------- */
  window.addEventListener('keydown', (e) => {
    const code = e.code;
    if (code === 'Space' || code.startsWith('Arrow')) e.preventDefault();
    Sound.init();

    if (code === 'KeyM') {
      toggleSound();
      return;
    }
    if (code === 'KeyP' || code === 'Escape') {
      if (state.mode === 'playing') pauseGame();
      else if (state.mode === 'paused') resumeGame();
      return;
    }
    if (code === 'Enter' || code === 'NumpadEnter') {
      handleAction();
      return;
    }

    if (state.mode !== 'playing') {
      if (code === 'Space') handleAction();
      return;
    }

    if (KEY_DIRS[code]) {
      setDirKey(KEY_DIRS[code], true);
      return;
    }
    if (code === 'Space' || code === 'KeyJ') keys.fire = true;
  });

  window.addEventListener('keyup', (e) => {
    const code = e.code;
    if (KEY_DIRS[code]) setDirKey(KEY_DIRS[code], false);
    if (code === 'Space' || code === 'KeyJ') keys.fire = false;
  });

  window.addEventListener('blur', () => {
    clearKeys();
    if (state.mode === 'playing') pauseGame();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.mode === 'playing') pauseGame();
  });

  overlayBtn.addEventListener('click', () => handleAction());

  function toggleSound() {
    Sound.enabled = !Sound.enabled;
    storageSet('tankSound', Sound.enabled ? 'on' : 'off');
    soundBtn.textContent = Sound.enabled ? '🔊' : '🔇';
    if (Sound.enabled) {
      Sound.init();
      Sound.tone(660, 0.09, 'triangle', 0.05, 900);
    }
  }

  soundBtn.addEventListener('click', toggleSound);

  pauseBtn.addEventListener('click', () => {
    if (state.mode === 'playing') pauseGame();
    else if (state.mode === 'paused') resumeGame();
  });

  restartBtn.addEventListener('click', () => startGame());

  // 触屏方向键
  document.querySelectorAll('.dpad button').forEach((btn) => {
    const dir = btn.dataset.dir;
    const press = (e) => {
      e.preventDefault();
      Sound.init();
      if (state.mode === 'playing') {
        setDirKey(dir, true);
        btn.classList.add('pressed');
      }
    };
    const release = (e) => {
      e.preventDefault();
      setDirKey(dir, false);
      btn.classList.remove('pressed');
    };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  const fireOn = (e) => {
    e.preventDefault();
    Sound.init();
    keys.fire = true;
    fireBtn.classList.add('pressed');
  };
  const fireOff = (e) => {
    e.preventDefault();
    keys.fire = false;
    fireBtn.classList.remove('pressed');
  };
  fireBtn.addEventListener('pointerdown', fireOn);
  fireBtn.addEventListener('pointerup', fireOff);
  fireBtn.addEventListener('pointercancel', fireOff);
  fireBtn.addEventListener('pointerleave', fireOff);
  fireBtn.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ---------------- 启动 ---------------- */
  let last = performance.now();

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  initPreview();
  refreshHud();
  soundBtn.textContent = Sound.enabled ? '🔊' : '🔇';
  showOverlay({
    kicker: 'TANK BATTLE',
    title: '坦克大战',
    text: '守住基地，消灭所有敌军。砖墙可以打穿，河流和钢墙不行——小心别打中自己的基地。',
    button: '开始战斗',
    hint: 'Enter 开始 · WASD / 方向键移动 · 空格射击',
  });

  // 方便测试与分享：打开 index.html#play 直接开始
  if (location.hash === '#play') startGame();

  // 调试入口：index.html?debug#play 可在控制台访问游戏状态
  if (new URLSearchParams(location.search).has('debug')) {
    window.__TANK_DEBUG__ = state;
  }

  requestAnimationFrame(frame);
})();
