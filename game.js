const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const pauseElement = document.getElementById('pause');

context.scale(20, 20); // Powiększenie

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let paused = false;
let gameOver = false;

const colors = [
    null,
    '#FF0D72', // T
    '#0DC2FF', // J
    '#0DFF72', // L
    '#F538FF', // O
    '#FF8E0D', // S
    '#FFE138', // Z
    '#3877FF', // I
    '#FF69B4', // U
    '#00FF9F', // +
    '#DDA0DD', // E
    '#8A2BE2', // P
    '#00CED1', // S2
    '#ADFF2F', // BigL
    '#FA8072', // LongI
    '#FFD700', // FatO
];

const arena = createMatrix(18, 28);

const player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    score: 0,
};

function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
    return matrix;
}

function createPiece(type) {
    switch (type) {
        case 'T':
            return [
                [0, 1, 0],
                [1, 1, 1],
                [0, 0, 0],
            ];
        case 'J':
            return [
                [2, 0, 0],
                [2, 2, 2],
                [0, 0, 0],
            ];
        case 'L':
            return [
                [0, 0, 3],
                [3, 3, 3],
                [0, 0, 0],
            ];
        case 'O':
            return [
                [4, 4],
                [4, 4],
            ];
        case 'S':
            return [
                [0, 5, 5],
                [5, 5, 0],
                [0, 0, 0],
            ];
        case 'Z':
            return [
                [6, 6, 0],
                [0, 6, 6],
                [0, 0, 0],
            ];
        case 'I':
            return [
                [0, 0, 0, 0],
                [7, 7, 7, 7],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
            ];
        case 'U':
            return [
                [8, 0, 8],
                [8, 8, 8],
                [0, 0, 0],
            ];
        case '+':
            return [
                [0, 9, 0],
                [9, 9, 9],
                [0, 9, 0],
            ];
        case 'E':
            return [
                [10, 10, 10],
                [10, 0, 0],
                [10, 10, 10],
            ];
        case 'P':
            return [
                [11, 11],
                [11, 0],
                [11, 0],
            ];
        case 'S2':
            return [
                [0, 12, 12],
                [12, 12, 0],
            ];
        case 'BigL':
            return [
                [13, 0, 0],
                [13, 0, 0],
                [13, 13, 13],
            ];
        case 'LongI':
            return [
                [14],
                [14],
                [14],
                [14],
                [14],
            ];
        case 'FatO':
            return [
                [15, 15, 15],
                [15, 15, 15],
                [15, 15, 15],
            ];
    }
}

function drawMatrix(matrix, offset, transparent = false) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.fillStyle = transparent ? 'rgba(255,255,255,0.3)' : colors[value];
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

function collide(arena, player) {
    const m = player.matrix;
    const o = player.pos;
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
                (arena[y + o.y] &&
                 arena[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        playerReset();
        arenaSweep();
        updateScore();
    }
    dropCounter = 0;
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) {
        player.pos.x -= dir;
    }
}

function playerReset() {
    const pieces = ['T', 'J', 'L', 'O', 'S', 'Z', 'I', 'U', '+', 'E', 'P', 'S2', 'BigL', 'LongI', 'FatO'];
    player.matrix = createPiece(pieces[Math.floor(Math.random() * pieces.length)]);
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    if (collide(arena, player)) {
        arena.forEach(row => row.fill(0));
        player.score = 0;
        alert('Koniec gry!');
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

function arenaSweep() {
    outer: for (let y = arena.length - 1; y >= 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) {
                continue outer;
            }
        }
        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        player.score += 10;
    }
}

function updateScore() {
    scoreElement.innerText = `Wynik: ${player.score}`;
}

function drawShadow() {
    const shadowPos = { ...player.pos };
    while (!collide(arena, { ...player, pos: shadowPos })) {
        shadowPos.y++;
    }
    shadowPos.y--;
    drawMatrix(player.matrix, shadowPos, true);
}

function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);

    drawMatrix(arena, { x: 0, y: 0 });
    drawShadow();
    drawMatrix(player.matrix, player.pos);
}

function update(time = 0) {
    if (paused) return;
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }
    draw();
    requestAnimationFrame(update);
}

document.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') {
        playerMove(-1);
    } else if (event.key === 'ArrowRight') {
        playerMove(1);
    } else if (event.key === 'ArrowDown') {
        playerDrop();
    } else if (event.key === 'ArrowUp') {
        playerRotate(1);
    } else if (event.key.toLowerCase() === 'p') {
        paused = !paused;
        pauseElement.style.display = paused ? 'block' : 'none';
        if (!paused) {
            update();
        }
    }
});

playerReset();
update();
