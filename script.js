const container = document.getElementById('game-container');
const scoreElement = document.getElementById('score');
const timerElement = document.getElementById('timer');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const overlayBest = document.getElementById('overlay-best');
const overlayButton = document.getElementById('overlay-button');

// --- KONFIGURATION ---
const IMAGE_DIR = 'extracted_faces_webp';   // 160px WebP statt 200px PNG (18x kleiner)
const MARTIN_TOTAL = 783;
const CHRIS_TOTAL = 304;
const POOL_MARTIN = 200;     // Bilder, die pro Runde vorgeladen werden
const POOL_CHRIS = 100;
const MAX_FACES = 120;
const START_TIME = 30;
const SPAWN_EVERY = 10;      // Sekunden bis ein weiteres Martin-Gesicht dazukommt
const SWAP_EVERY = 3;        // Sekunden zwischen zufaelligem Bildtausch
const BASE_SPEED = 3;        // Pixel pro Frame bei 60 fps
const MAX_SPEED = 15;
const BOUNCE_JITTER = 0.5;   // Radiant Winkelstreuung beim Abprallen
const START_DENSITY = 90000; // Ein Start-Gesicht pro X Bildschirm-Pixel
const START_MIN = 8;         // So wenige Gesichter mindestens am Anfang
const START_MAX = 18;        // ... und hoechstens, auch auf grossen Monitoren
const FACES_PER_HIT = 2;     // Pro Treffer kommen so viele Martins dazu
const BEST_KEY = 'imposter-best-score';

// --- ZUSTAND ---
let faces = [];
let martinPool = [];
let chrisPool = [];
let state = 'loading';       // loading | ready | playing | paused | over
let score = 0;
let timeLeft = START_TIME;
let baseSize = 80;
let minSize = 45;
let faceSize = 80;
let targetSpeed = BASE_SPEED;
let lastFrame = 0;
let secondTimer = 0;
let spawnTimer = 0;
let swapTimer = 0;

// --- DYNAMISCHES SETUP ---
function calculateStartFaces() {
    const count = Math.floor((window.innerWidth * window.innerHeight) / START_DENSITY);
    return Math.min(Math.max(count, START_MIN), START_MAX);
}

function calculateBaseSize() {
    return window.innerWidth <= 600 ? 60 : 80;
}

function applyScreenSize() {
    baseSize = calculateBaseSize();
    minSize = Math.round(baseSize * 0.55);
    faceSize = Math.max(baseSize - score / 4, minSize);
}

// --- BILDER ---
function pickPool(name, total, count) {
    const chosen = new Set();
    while (chosen.size < Math.min(count, total)) {
        chosen.add(1 + Math.floor(Math.random() * total));
    }
    return [...chosen].map(i => `${IMAGE_DIR}/${name}/${name}_${i}.webp`);
}

function preload(urls, onProgress) {
    let done = 0;
    return Promise.all(urls.map(url => new Promise(resolve => {
        const img = new Image();
        const finish = () => { onProgress(++done, urls.length); resolve(); };
        img.onload = finish;
        img.onerror = finish;
        img.src = url;
    })));
}

function randomImage(faceObj) {
    const pool = faceObj.isChris ? chrisPool : martinPool;
    return pool[Math.floor(Math.random() * pool.length)];
}

// --- GESCHWINDIGKEIT ---
// Der Betrag wird immer neu gesetzt, nie multipliziert. Deshalb kann die
// Bewegung nicht mehr langsam auslaufen wie in der alten Abprall-Formel.
function speedOf(faceObj) {
    return Math.min(targetSpeed * faceObj.speedMultiplier, MAX_SPEED);
}

function setDirection(faceObj, angle) {
    const speed = speedOf(faceObj);
    faceObj.vx = Math.cos(angle) * speed;
    faceObj.vy = Math.sin(angle) * speed;
}

function refreshSpeed(faceObj) {
    setDirection(faceObj, Math.atan2(faceObj.vy, faceObj.vx));
}

// --- GESICHTER ---
function createFace(isChris) {
    const element = document.createElement('img');
    element.className = 'face';
    element.alt = '';
    element.draggable = false;

    const faceObj = {
        isChris: isChris,
        element: element,
        x: Math.random() * Math.max(0, window.innerWidth - faceSize),
        y: Math.random() * Math.max(0, window.innerHeight - faceSize),
        vx: 0,
        vy: 0,
        speedMultiplier: 0.7 + Math.random() * 0.6
    };

    setDirection(faceObj, Math.random() * Math.PI * 2);
    element.src = randomImage(faceObj);
    element.style.width = element.style.height = faceSize + 'px';
    element.addEventListener('pointerdown', event => {
        event.preventDefault();
        handleFaceClick(faceObj);
    });

    container.appendChild(element);
    faces.push(faceObj);
    draw(faceObj);
}

function buildFaces() {
    faces.forEach(f => f.element.remove());
    faces = [];
    const count = calculateStartFaces();
    for (let i = 0; i < count - 1; i++) createFace(false);
    createFace(true);
}

function handleFaceClick(faceObj) {
    if (state !== 'playing') return;

    if (faceObj.isChris) {
        score += 10;
        timeLeft += 5;
        spawnEffect(faceObj, '✅ +10 · +5s');
        increaseDifficulty();
        for (let i = 0; i < FACES_PER_HIT && faces.length < MAX_FACES; i++) {
            createFace(false);
        }
        shuffleFaces();
    } else {
        score = Math.max(0, score - 5);
        timeLeft -= 2;
        spawnEffect(faceObj, '❌ −5 · −2s');
        increaseDifficulty();
    }

    updateHud();
    if (timeLeft <= 0) endGame();
}

function increaseDifficulty() {
    targetSpeed = Math.min(BASE_SPEED * (1 + score / 100), MAX_SPEED);
    faceSize = Math.max(baseSize - score / 4, minSize);

    faces.forEach(f => {
        refreshSpeed(f);
        f.element.style.width = f.element.style.height = faceSize + 'px';
    });
}

function spawnEffect(faceObj, text) {
    const el = document.createElement('div');
    el.className = faceObj.isChris ? 'effect hit' : 'effect miss';
    el.textContent = text;
    el.style.left = faceObj.x + 'px';
    el.style.top = faceObj.y + 'px';
    container.appendChild(el);
    setTimeout(() => el.remove(), 800);
}

// Nach einem Treffer wird alles neu gewuerfelt: Platz, Bild, Richtung und
// Tempo. Der speedMultiplier muss mit neu gezogen werden, sonst behaelt jedes
// Gesicht dauerhaft sein Tempo aus der Startaufstellung.
function shuffleFaces() {
    const maxX = Math.max(0, window.innerWidth - faceSize);
    const maxY = Math.max(0, window.innerHeight - faceSize);

    faces.forEach(f => {
        f.x = Math.random() * maxX;
        f.y = Math.random() * maxY;
        f.element.src = randomImage(f);
        f.speedMultiplier = 0.7 + Math.random() * 0.6;
        setDirection(f, Math.random() * Math.PI * 2);
        draw(f);
    });
}

function randomSwap() {
    const candidates = faces.filter(f => !f.isChris);
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    if (pick) pick.element.src = randomImage(pick);
}

// --- SPIELSCHLEIFE ---
function draw(faceObj) {
    faceObj.element.style.transform =
        `translate3d(${faceObj.x}px, ${faceObj.y}px, 0)`;
}

function bounce(faceObj, axis, direction) {
    const angle = Math.atan2(faceObj.vy, faceObj.vx) +
        (Math.random() - 0.5) * BOUNCE_JITTER;
    setDirection(faceObj, angle);
    if (axis === 'x') faceObj.vx = Math.abs(faceObj.vx) * direction;
    else faceObj.vy = Math.abs(faceObj.vy) * direction;
}

function update(now) {
    requestAnimationFrame(update);

    if (state === 'paused' || state === 'loading') {
        lastFrame = now;
        return;
    }

    // Auf 60 fps normiert, damit 120-Hz-Displays nicht doppelt so schnell laufen
    const elapsed = Math.min(now - lastFrame, 100);
    lastFrame = now;
    const dt = elapsed / (1000 / 60);

    const maxX = Math.max(0, window.innerWidth - faceSize);
    const maxY = Math.max(0, window.innerHeight - faceSize);

    for (const f of faces) {
        f.x += f.vx * dt;
        f.y += f.vy * dt;

        if (f.x <= 0) { f.x = 0; bounce(f, 'x', 1); }
        else if (f.x >= maxX) { f.x = maxX; bounce(f, 'x', -1); }

        if (f.y <= 0) { f.y = 0; bounce(f, 'y', 1); }
        else if (f.y >= maxY) { f.y = maxY; bounce(f, 'y', -1); }

        draw(f);
    }

    if (state === 'playing') tickTimers(elapsed);
}

function tickTimers(elapsed) {
    secondTimer += elapsed;
    spawnTimer += elapsed;
    swapTimer += elapsed;

    while (secondTimer >= 1000) {
        secondTimer -= 1000;
        timeLeft--;
        updateHud();
        if (timeLeft <= 0) { endGame(); return; }
    }

    if (spawnTimer >= SPAWN_EVERY * 1000) {
        spawnTimer = 0;
        if (faces.length < MAX_FACES) {
            createFace(false);
            increaseDifficulty();
        }
    }

    if (swapTimer >= SWAP_EVERY * 1000) {
        swapTimer = 0;
        randomSwap();
    }
}

// --- ANZEIGE ---
function updateHud() {
    scoreElement.textContent = `Score: ${score}`;
    timerElement.textContent = `Zeit: ${Math.max(0, timeLeft)}s`;
    timerElement.classList.toggle('warning', timeLeft <= 5);
}

function showOverlay(title, text, buttonLabel, onClick, bestText) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlayBest.textContent = bestText || '';
    overlayButton.textContent = buttonLabel;
    overlayButton.disabled = !onClick;
    overlayButton.onclick = onClick || null;
    overlay.hidden = false;
}

function readBest() {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}

function writeBest(value) {
    try { localStorage.setItem(BEST_KEY, String(value)); } catch { /* egal */ }
}

// --- SPIELABLAUF ---
function startGame() {
    score = 0;
    timeLeft = START_TIME;
    targetSpeed = BASE_SPEED;
    secondTimer = spawnTimer = swapTimer = 0;
    applyScreenSize();
    buildFaces();
    updateHud();
    overlay.hidden = true;
    state = 'playing';
    lastFrame = performance.now();
}

function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused';
    showOverlay('Pause', 'Das Spiel wartet auf dich.', 'Weiter', resumeGame);
}

function resumeGame() {
    overlay.hidden = true;
    state = 'playing';
    lastFrame = performance.now();
}

function endGame() {
    state = 'over';
    timeLeft = 0;
    updateHud();

    const best = Math.max(score, readBest());
    writeBest(best);

    showOverlay(
        'Game Over!',
        `Dein Score: ${score}`,
        'Nochmal',
        startGame,
        `Bestleistung: ${best}`
    );
}

// --- EVENTS ---
window.addEventListener('resize', () => {
    applyScreenSize();
    const maxX = Math.max(0, window.innerWidth - faceSize);
    const maxY = Math.max(0, window.innerHeight - faceSize);
    faces.forEach(f => {
        f.x = Math.min(f.x, maxX);
        f.y = Math.min(f.y, maxY);
        f.element.style.width = f.element.style.height = faceSize + 'px';
        draw(f);
    });
});

// Der Timer lief bisher im Hintergrund weiter - jetzt pausiert das Spiel.
document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame();
});

// --- START ---
async function boot() {
    applyScreenSize();
    martinPool = pickPool('Martin', MARTIN_TOTAL, POOL_MARTIN);
    chrisPool = pickPool('Chris', CHRIS_TOTAL, POOL_CHRIS);

    await preload([...martinPool, ...chrisPool], (done, total) => {
        overlayButton.textContent = `Lade Gesichter … ${Math.round((done / total) * 100)}%`;
    });

    state = 'ready';
    buildFaces();
    updateHud();
    requestAnimationFrame(update);

    const best = readBest();
    showOverlay(
        'Finde den Imposter!',
        'Unter lauter Martins versteckt sich genau ein Chris. Klick ihn an, bevor die Zeit abläuft.',
        'Start',
        startGame,
        best ? `Bestleistung: ${best}` : ''
    );
}

boot();
