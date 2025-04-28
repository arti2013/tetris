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

// --- CANVAS & GAME ---
const canvas = document.getElementById('tetris');
const context = canvas?.getContext('2d');

if (!canvas || !context) {
  throw new Error('Brak dostępu do elementu canvas lub jego kontekstu!');
}

context.imageSmoothingEnabled = false;

const scoreElement = document.getElementById('score');
const gameOverElement = document.getElementById('game-over');
const pauseElement = document.getElementById('pause');

if (!scoreElement || !gameOverElement || !pauseElement) {
  throw new Error('Brakuje wymaganych elementów DOM (#score, #game-over lub #pause)');
}

const scaleFactor = 2;
canvas.width = 300 * scaleFactor;
canvas.height = 600 * scaleFactor;
context.scale((canvas.width / 10) / scaleFactor, (canvas.height / 20) / scaleFactor);
canvas.style.width = '300px';
canvas.style.height = '600px';

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let paused = false;
let gameOver = false;

const colors = [
  null,
  '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF',
];

const arena = createArena(10, 20);

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
    bag = shuffle('ILJOTSZ'.split(''));
  }
  return bag.pop();
}

const pieces = {
  'T': [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  'O': [
    [2, 2],
    [2, 2],
  ],
  'L': [
    [0, 3, 0],
    [0, 3, 0],
    [0, 3, 3],
  ],
  'J': [
    [0, 4, 0],
    [0, 4, 0],
    [4, 4, 0],
  ],
  'I': [
    [0, 5, 0, 0],
    [0, 5, 0, 0],
    [0, 5, 0, 0],
    [0, 5, 0, 0],
  ],
  'S': [
    [0, 6, 6],
    [6, 6, 0],
    [0, 0, 0],
  ],
  'Z': [
    [7, 7, 0],
    [0, 7, 7],
    [0, 0, 0],
  ],
};

function createPiece(type) {
  return pieces[type] ? JSON.parse(JSON.stringify(pieces[type])) : JSON.parse(JSON.stringify(pieces['T']));
}

function createArena(w, h) {
  return Array.from({ length: h }, () => Array(w).fill(0));
}

function drawMatrix(matrix, offset, isShadow = false) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        context.fillStyle = isShadow ? 'rgba(255,255,255,0.3)' : colors[value];
        context.fillRect(x + offset.x, y + offset.y, 1, 1);
      }
    });
  });
}

function merge(arena, player) {
  player.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0 && arena[y + player.pos.y]) {
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
      if (m[y][x] !== 0 && (!arena[y + o.y] || arena[y + o.y][x + o.x] !== 0)) {
        return true;
      }
    }
  }
  return false;
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
    try { sounds.line.play(); } catch (e) { console.error('Sound error:', e); }
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
    try { sounds.drop.play(); } catch (e) { console.error('Sound error:', e); }
  }
  dropCounter = 0;
}

function playerMove(dir) {
  if (paused || gameOver) return;
  player.pos.x += dir;
  if (collide(arena, player)) {
    player.pos.x -= dir;
  } else {
    try { sounds.move.play(); } catch (e) { console.error('Sound error:', e); }
  }
}

function playerReset() {
  player.matrix = createPiece(getNextPiece());
  player.pos.y = 0;
  player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);

  if (collide(arena, player)) {
    gameOver = true;
    gameOverElement.style.display = 'block';
    try { sounds.gameover.play(); } catch (e) { console.error('Sound error:', e); }
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
  if (dir > 0) {
    matrix.forEach(row => row.reverse());
  } else {
    matrix.reverse();
  }
}

function updateScore() {
  scoreElement.innerText = `Wynik: ${player.score}`;
}

function drawShadow() {
  const shadowPos = { x: player.pos.x, y: player.pos.y };
  const shadowPlayer = { matrix: player.matrix, pos: { ...shadowPos } };

  while (!collide(arena, shadowPlayer)) {
    shadowPlayer.pos.y++;
  }
  shadowPlayer.pos.y--;
  drawMatrix(player.matrix, shadowPlayer.pos, true);
}

function draw(time = 0) {
  context.fillStyle = '#000';
  context.fillRect(0, 0, canvas.width, canvas.height);

  drawMatrix(arena, { x: 0, y: 0 });
  drawShadow();
  drawMatrix(player.matrix, player.pos);

  if (paused) {
    const alpha = 0.5 + 0.5 * Math.sin(time / 300);
    context.globalAlpha = alpha;
    context.fillStyle = 'white';
    context.font = 'bold 2px Arial';
    context.textAlign = 'center';
    context.fillText('PAUSE', canvas.width / 2, canvas.height / 2);
    context.globalAlpha = 1.0;
  }

  pauseElement.style.display = paused ? 'block' : 'none';
}

function update(time = 0) {
  if (paused) {
    draw(time);
    requestAnimationFrame(update);
    return;
  }

  if (lastTime) {
    const deltaTime = time - lastTime;
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
      playerDrop();
    }
  }
  lastTime = time;

  draw(time);
  if (!gameOver) {
    requestAnimationFrame(update);
  }
}

document.addEventListener('keydown', (e) => {
  if (gameOver) return;

  switch (e.key) {
    case 'ArrowLeft':
      playerMove(-1);
      break;
    case 'ArrowRight':
      playerMove(1);
      break;
    case 'ArrowDown':
      playerDrop();
      break;
    case 'ArrowUp':
      playerRotate(1);
      break;
    case 'p':
    case 'P':
      paused = !paused;
      if (paused) {
        sounds.music.pause();
        musicPlaying = false;
      } else {
        sounds.music.play();
        musicPlaying = true;
        lastTime = performance.now(); // Resetujemy czas przy wznowieniu gry
      }
      break;
    case 'r':
    case 'R':
      restartGame();
      break;
    case 'm':
    case 'M':
      if (musicPlaying) {
        sounds.music.pause();
      } else {
        sounds.music.play();
      }
      musicPlaying = !musicPlaying;
      break;
  }
});

function restartGame() {
  gameOver = false;
  paused = false;
  gameOverElement.style.display = 'none';
  player.score = 0;
  updateScore();
  arena.forEach(row => row.fill(0));
  playerReset();
  
  if (!musicPlaying) {
    sounds.music.play();
    musicPlaying = true;
  }

  update();
}

// Start gry
playerReset();
update();
