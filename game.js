// --- AUDIO ---
const sounds = {
  move: new Audio('sounds/move.wav'),
  drop: new Audio('sounds/drop.wav'),
  line: new Audio('sounds/line.wav'),
  gameover: new Audio('sounds/gameover.wav'),
  music: new Audio('sounds/music.wav'),
};

// Właściwości muzyki w tle
sounds.music.loop = true;   // Muzyka powtarza się
sounds.music.volume = 0.3;  // Muzyka gra ciszej

let musicPlaying = false;

// --- CANVAS & GAME ---
const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = false; // Wyłączenie interpolacji pikseli
const scoreElement = document.getElementById('score');
const gameOverElement = document.getElementById('game-over');
const pauseElement = document.getElementById('pause');

// Wyższa rozdzielczość
const scaleFactor = 2; // Skalowanie dla lepszej jakości
canvas.width = 300 * scaleFactor;
canvas.height = 600 * scaleFactor;
context.scale((canvas.width / 10) / scaleFactor, (canvas.height / 20) / scaleFactor);

// CSS dla kompaktowego wyświetlania
canvas.style.width = '300px';
canvas.style.height = '600px';

if (!gameOverElement || !pauseElement) {
  console.error('Brak wymaganych elementów DOM (#game-over lub #pause)');
}

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let paused = false;
let gameOver = false;

const colors = [
null,
'#FF0D72', // 1
'#0DC2FF', // 2
'#0DFF72', // 3
'#F538FF', // 4
'#FF8E0D', // 5
'#FFE138', // 6
'#3877FF', // 7
];

const arena = createArena(10, 20); // Plansza

const player = {
pos: {x: 0, y: 0},
matrix: null,
score: 0,
};

let bag = [];

function getNextPiece() {
  if (bag.length === 0) {
    bag = 'ILJOTSZ'.split('').sort(() => Math.random() - 0.5);
  }
  return bag.pop();
}

function createPiece(type) {
  if (type === 'T') {
    return [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ];
  } else if (type === 'O') {
    return [
      [2, 2],
      [2, 2],
    ];
  } else if (type === 'L') {
    return [
      [0, 3, 0],
      [0, 3, 0],
      [0, 3, 3],
    ];
  } else if (type === 'J') {
    return [
      [0, 4, 0],
      [0, 4, 0],
      [4, 4, 0],
    ];
  } else if (type === 'I') {
    return [
      [0, 5, 0, 0],
      [0, 5, 0, 0],
      [0, 5, 0, 0],
      [0, 5, 0, 0],
    ];
  } else if (type === 'S') {
    return [
      [0, 6, 6],
      [6, 6, 0],
      [0, 0, 0],
    ];
  } else if (type === 'Z') {
    return [
      [7, 7, 0],
      [0, 7, 7],
      [0, 0, 0],
    ];
  }
}

function createArena(w, h) {
const arena = [];
while (h--) {
  arena.push(new Array(w).fill(0));
}
return arena;
}

function drawMatrix(matrix, offset, isShadow = false) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        context.fillStyle = isShadow 
          ? 'rgba(255, 255, 255, 0.3)' // Kolor cienia
          : colors[value]; // Kolor figury
        context.fillRect(x + offset.x, y + offset.y, 1, 1);
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

function arenaSweep() {
  let rowCount = 1;
  outer: for (let y = arena.length - 1; y >= 0; --y) {
    for (let x = 0; x < arena[y].length; ++x) {
      if (arena[y][x] === 0) {
        continue outer; // Jeśli wiersz nie jest pełny, przejdź do następnego
      }
    }
    const row = arena.splice(y, 1)[0].fill(0); // Usuń pełny wiersz
    arena.unshift(row); // Dodaj pusty wiersz na górze
    ++y; // Sprawdź ponownie ten sam wiersz
    player.score += rowCount * 10; // Zwiększ wynik
    rowCount *= 2; // Zwiększ mnożnik punktów
    console.log('Row cleared. Arena:', arena); // Debug: sprawdzenie planszy po usunięciu wiersza
    sounds.line.play(); // Odtwórz dźwięk usunięcia linii
  }
}

function playerDrop() {
  if (paused || gameOver) return; // Sprawdzenie pauzy i końca gry
  player.pos.y++;
  console.log('Player position after drop:', player.pos); // Debug: sprawdzenie pozycji po opadnięciu

  if (collide(arena, player)) {
    player.pos.y--; // Cofnij ruch, jeśli wystąpiła kolizja
    merge(arena, player); // Połącz figurę z planszą
    console.log('Arena after merge:', arena); // Debug: sprawdzenie planszy po połączeniu
    playerReset(); // Zresetuj gracza (nowa figura)
    arenaSweep(); // Usuń pełne wiersze
    updateScore(); // Zaktualizuj wynik
    sounds.drop.play(); // Odtwórz dźwięk opadania
  }
  dropCounter = 0; // Zresetuj licznik opadania
}

function playerMove(dir) {
  if (paused || gameOver) return; // Dodano sprawdzenie pauzy i końca gry
  player.pos.x += dir;
  if (collide(arena, player)) {
    player.pos.x -= dir;
  } else {
    sounds.move.play();
  }
}

function playerReset() {
  player.matrix = createPiece(getNextPiece()); // Generowanie nowej figury
  player.pos.y = 0; // Ustawienie figury na górze planszy
  player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0); // Wyśrodkowanie figury

  console.log('Player matrix:', player.matrix); // Debug: sprawdzenie macierzy figury
  console.log('Player position:', player.pos); // Debug: sprawdzenie pozycji figury
  console.log('Arena:', arena); // Debug: sprawdzenie planszy

  if (collide(arena, player)) {
    gameOver = true; // Jeśli nowa figura koliduje, gra się kończy
    gameOverElement.style.display = 'block';
    console.log('Game Over!'); // Debug: komunikat o końcu gry
    sounds.gameover.play();
    sounds.music.pause();
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

function collide(arena, player) {
  const m = player.matrix;
  const o = player.pos;
  for (let y = 0; y < m.length; ++y) {
    for (let x = 0; x < m[y].length; ++x) {
      if (m[y][x] !== 0 && // Jeśli komórka figury nie jest pusta
          (arena[y + o.y] && // Jeśli istnieje odpowiedni wiersz w planszy
           arena[y + o.y][x + o.x]) !== 0) { // Jeśli komórka planszy jest zajęta
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
      if (arena[y][x] === 0) {
        continue outer; // Jeśli wiersz nie jest pełny, przejdź do następnego
      }
    }
    const row = arena.splice(y, 1)[0].fill(0); // Usuń pełny wiersz
    arena.unshift(row); // Dodaj pusty wiersz na górze
    ++y; // Sprawdź ponownie ten sam wiersz
    player.score += rowCount * 10; // Zwiększ wynik
    rowCount *= 2; // Zwiększ mnożnik punktów
    sounds.line.play(); // Odtwórz dźwięk usunięcia linii
  }
}

function updateScore() {
scoreElement.innerText = `Wynik: ${player.score}`;
}

function drawShadow() {
  const shadowPos = {x: player.pos.x, y: player.pos.y};
  while (!collide(arena, {...player, pos: shadowPos})) {
    shadowPos.y++;
  }
  shadowPos.y--; // Zatrzymuje cień na ostatniej dostępnej pozycji
  drawMatrix(player.matrix, shadowPos, true); // Rysowanie cienia z innym kolorem
}

function draw() {
  context.fillStyle = '#000';
  context.fillRect(0, 0, canvas.width, canvas.height);

  console.log('Drawing arena and player...'); // Debug: sprawdzenie rysowania
  drawMatrix(arena, {x: 0, y: 0});
  drawShadow(); // Rysowanie cienia
  drawMatrix(player.matrix, player.pos);

  if (paused) {
    pauseElement.style.display = 'block';
  } else {
    pauseElement.style.display = 'none';
  }
}

function update(time = 0) {
  if (paused) return; // Zatrzymuje aktualizację, jeśli gra jest wstrzymana

  const deltaTime = time - lastTime;
  lastTime = time;
  dropCounter += deltaTime;

  if (dropCounter > dropInterval) {
    console.log('Dropping piece...'); // Debug: sprawdzenie, czy figura spada
    playerDrop();
  }

  draw();

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
    } else {
      sounds.music.play();
    }
    break;
  case 'r':
  case 'R':
    restartGame();
    break;
  case 'm':
  case 'M':
    if (!musicPlaying) {
      sounds.music.play();
    } else {
      sounds.music.pause();
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
  arena.forEach((row, y) => arena[y].fill(0)); // Wyczyszczenie planszy
  playerReset(); // Zresetowanie gracza
  console.log('Game restarted.'); // Debug: komunikat o restarcie gry
  update();
}

playerReset();
console.log('Game initialized.'); // Debug: sprawdzenie inicjalizacji gry
update();
