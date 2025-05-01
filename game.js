// --- AUDIO ---
const sounds = {
  move: new Audio('sounds/move.wav'),
  drop: new Audio('sounds/drop.wav'),
  line: new Audio('sounds/line.wav'),
  gameover: new Audio('sounds/gameover.wav'),
  music: new Audio('sounds/music.wav'),
};

sounds.music.loop = true;
sounds.music.volume = 0.3;
let musicPlaying = false;
let musicInitialized = false;

// --- KONFIGURACJA GRY ---
const gameConfig = {
  blockSize: 30,
  arenaWidth: 15,
  arenaHeight: 25,
};

gameConfig.logicalWidth = gameConfig.arenaWidth * gameConfig.blockSize;
gameConfig.logicalHeight = gameConfig.arenaHeight * gameConfig.blockSize;

// --- CANVAS & GAME ---
const canvas = document.getElementById('tetris');
const context = canvas?.getContext('2d');
if (!canvas || !context) throw new Error('Brak dostępu do elementu canvas lub jego kontekstu!');
context.imageSmoothingEnabled = false;

const scoreElement = document.getElementById('score');
const gameOverElement = document.getElementById('game-over');
const pauseElement = document.getElementById('pause');
if (!scoreElement || !gameOverElement || !pauseElement) throw new Error('Brakuje wymaganych elementów DOM (#score, #game-over lub #pause)');

canvas.width = gameConfig.logicalWidth;
canvas.height = gameConfig.logicalHeight;
canvas.style.width = `${gameConfig.logicalWidth}px`;
canvas.style.height = `${gameConfig.logicalHeight}px`;

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let paused = false;
let gameOver = false;

const colors = [null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF', '#FF00FF', '#00FFFF', '#FFFF00', '#FFAA00', '#AAFF00', '#00FFAA', '#FF5733', '#33FF57', '#3357FF', '#FF33A1'];

const arena = createArena(gameConfig.arenaWidth, gameConfig.arenaHeight);

const player = {
  pos: { x: 0, y: 0 },
  matrix: null,
  score: 0,
};

let bag = [];
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getNextPiece() {
  if (bag.length === 0) {
    bag = shuffle('ILJOTSZXUYV'.split(''));
  }
  return bag.pop();
}

const pieces = {
  'T': [[0, 1, 0],[1, 1, 1],[0, 0, 0]],
  'O': [[2, 2],[2, 2]],
  'L': [[0, 3, 0],[0, 3, 0],[0, 3, 3]],
  'J': [[0, 4, 0],[0, 4, 0],[4, 4, 0]],
  'I': [[0, 0, 0, 0],[5, 5, 5, 5],[0, 0, 0, 0],[0, 0, 0, 0]],
  'S': [[0, 6, 6],[6, 6, 0],[0, 0, 0]],
  'Z': [[7, 7, 0],[0, 7, 7],[0, 0, 0]],
  'X': [[0, 10, 0],[10, 10, 10],[0, 10, 0]],
  'Y': [[0, 11, 0],[11, 11, 11],[0, 0, 0]],
  'U': [[12, 12, 0],[12, 12, 0],[0, 0, 0]],
  'V': [[13, 13, 13],[0, 13, 0],[0, 0, 0]],
};

function createPiece(type) {
  return JSON.parse(JSON.stringify(pieces[type] || pieces['T']));
}

function createArena(w, h) {
  return Array.from({ length: h }, () => Array(w).fill(0));
}

function drawMatrix(matrix, offset, isShadow = false) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        context.fillStyle = isShadow ? 'rgba(255,255,255,0.3)' : (colors[value] || '#FFFFFF');
        context.fillRect((x + offset.x) * gameConfig.blockSize, (y + offset.y) * gameConfig.blockSize, gameConfig.blockSize, gameConfig.blockSize);
      }
    });
  });
}

function merge(arena, player) {
  player.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        arena[y + player.pos.y][x + player.pos.x] = value;
      }
    });
  });
}

function collide(arena, player) {
  const m = player.matrix;
  const o = player.pos;
  for (let y = 0; y < m.length; ++y) {
    for (let x = 0; x < m[y].length; ++x) {
      if (m[y][x] !== 0 && (arena[y + o.y]?.[x + o.x] ?? 1) !== 0) {
        return true;
      }
    }
  }
  return false;
}

function playSound(sound) {
  const clone = sound.cloneNode();
  clone.play().catch(e => console.error('Sound play error:', e));
}

function arenaSweep() {
  let rowCount = 1;
  outer: for (let y = arena.length - 1; y >= 0; --y) {
    for (let x = 0; x < arena[y].length; ++x) {
      if (arena[y][x] === 0) continue outer;
    }
    const row = arena.splice(y, 1)[0].fill(0);
    arena.unshift(row);
    y++;
    player.score += rowCount * 10;
    rowCount *= 2;
    playSound(sounds.line);
  }
}

function playerDrop() {
  if (paused || gameOver) return;
  player.pos.y++;
  if (collide(arena, player)) {
    player.pos.y--;
    merge(arena, player);
    playerReset();
    arenaSweep();
    updateScore();
    playSound(sounds.drop);
  }
  dropCounter = 0;
}

function playerMove(dir) {
  if (paused || gameOver) return;
  player.pos.x += dir;
  if (collide(arena, player)) player.pos.x -= dir;
  else playSound(sounds.move);
}

let nextQueue = [getNextPiece(), getNextPiece(), getNextPiece()];

function playerReset() {
  const nextPiece = nextQueue.shift();
  nextQueue.push(getNextPiece());
  player.matrix = createPiece(nextPiece);
  player.pos.y = 0;
  player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
  drawNextQueue();

  if (collide(arena, player)) {
    console.error('Kolizja przy generowaniu nowego klocka. Koniec gry.');
    gameOver = true;
    gameOverElement.style.display = 'block';
    playSound(sounds.gameover);
    sounds.music.pause();
    musicPlaying = false;
    updateScore();
  }
}

function playerRotate(dir) {
  const pos = player.pos.x;
  let offset = 1;
  rotate(player.matrix, dir);
  while (collide(arena, player)) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > player.matrix[0].length) {
      rotate(player.matrix, -dir);
      player.pos.x = pos;
      return;
    }
  }
}

function rotate(matrix, dir) {
  for (let y = 0; y < matrix.length; ++y) {
    for (let x = 0; x < y; ++x) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  if (dir > 0) matrix.forEach(row => row.reverse());
  else matrix.reverse();
}

function updateScore() {
  scoreElement.innerText = `Wynik: ${player.score}`;
}

function drawShadow() {
  const shadowPlayer = { matrix: player.matrix, pos: { ...player.pos } };
  while (!collide(arena, shadowPlayer)) {
    shadowPlayer.pos.y++;
  }
  shadowPlayer.pos.y--;
  drawMatrix(player.matrix, shadowPlayer.pos, true);
}

function draw() {
  context.fillStyle = '#000';
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawMatrix(arena, { x: 0, y: 0 });
  drawShadow();
  drawMatrix(player.matrix, player.pos);
  pauseElement.style.display = paused ? 'block' : 'none';
}

function update(time) {
  if (paused) return;
  if (lastTime != null) {
    const deltaTime = time - lastTime;
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) playerDrop();
  }
  lastTime = time;
  draw();
  if (!gameOver) requestAnimationFrame(update);
}

document.addEventListener('keydown', (e) => {
  if (!musicInitialized) {
    sounds.music.play().catch(() => {});
    musicPlaying = true;
    musicInitialized = true;
  }
  if (gameOver) return;
  switch (e.key) {
    case 'ArrowLeft': playerMove(-1); break;
    case 'ArrowRight': playerMove(1); break;
    case 'ArrowDown': playerDrop(); break;
    case 'ArrowUp': playerRotate(1); break;
    case 'p': case 'P': togglePause(); break;
    case 'r': case 'R': restartGame(); break;
    case 'm': case 'M': toggleMusic(); break;
  }
});

function restartGame() {
  gameOver = false;
  paused = false;
  dropCounter = 0;
  lastTime = performance.now();
  gameOverElement.style.display = 'none';
  player.score = 0;
  updateScore();
  arena.forEach(row => row.fill(0));
  nextQueue = [getNextPiece(), getNextPiece(), getNextPiece()];
  playerReset();
  if (!musicPlaying) {
    sounds.music.play();
    musicPlaying = true;
  }
  update();
}

function togglePause() {
  paused = !paused;
  if (paused) {
    sounds.music.pause();
    musicPlaying = false;
    pauseElement.style.display = 'block';
  } else {
    sounds.music.play();
    musicPlaying = true;
    pauseElement.style.display = 'none';
    lastTime = performance.now();
    requestAnimationFrame(update);
  }
}

function toggleMusic() {
  if (musicPlaying) sounds.music.pause();
  else sounds.music.play();
  musicPlaying = !musicPlaying;
}

// --- NEXT PIECE ---
const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas?.getContext('2d');
if (!nextCanvas || !nextContext) throw new Error('Brak canvasu next!');
const nextBlockSize = gameConfig.blockSize;
nextCanvas.width = nextBlockSize * 4;
nextCanvas.height = nextBlockSize * 15;
nextContext.scale(nextBlockSize, nextBlockSize);

function drawNextQueue() {
  nextContext.fillStyle = '#000';
  nextContext.fillRect(0, 0, nextCanvas.width / nextBlockSize, nextCanvas.height / nextBlockSize);
  nextQueue.forEach((type, index) => {
    const matrix = createPiece(type);
    const offsetY = index * 5;
    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          nextContext.fillStyle = colors[value] || '#FFF';
          nextContext.fillRect(x, y + offsetY, 1, 1);
        }
      });
    });
  });
}

// Start gry
playerReset();
update();
