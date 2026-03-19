const container = document.getElementById('game-container');
const scoreElement = document.getElementById('score');
const timerElement = document.getElementById('timer');

// --- DYNAMISCHES SETUP ---
function calculateNumFaces() {
    const area = window.innerWidth * window.innerHeight;
    const density = 25000; 
    let count = Math.floor(area / density);
    return Math.min(Math.max(count, 15), 120); 
}

// --- DIFFICULTY SETUP ---
let baseSpeed = 3;         
let maxSpeed = 15;        
let currentDifficulty = 1; 

let baseSize = 80;         
let minSize = 45;          

let numFaces = calculateNumFaces();
let score = 0;
let timeLeft = 30;
let gameActive = true;

const meineBilder = Array.from({length: 783}, (_, i) => `Martin/Martin_${i+1}.png`);
const chrisBilder = Array.from({length: 304}, (_, i) => `Chris/Chris_${i+1}.png`);

let faces = [];

function createFace(isChris) {
    const faceObj = {
        isChris: isChris,
        element: document.createElement('img'),
        x: Math.random() * (window.innerWidth - baseSize),
        y: Math.random() * (window.innerHeight - baseSize),
        vx: (Math.random() - 0.5) * 2 * baseSpeed,
        vy: (Math.random() - 0.5) * 2 * baseSpeed
    };

    faceObj.element.className = 'face';
    const bildeAuswahl = isChris ? chrisBilder : meineBilder;
    faceObj.element.src = `extracted_faces/${bildeAuswahl[Math.floor(Math.random() * bildeAuswahl.length)]}`;
    
    faceObj.element.style.width = baseSize + 'px';
    faceObj.element.style.height = baseSize + 'px';
    
    faceObj.element.addEventListener('click', () => handleFaceClick(faceObj));
    container.appendChild(faceObj.element);
    faces.push(faceObj);
}

function handleFaceClick(faceObj) {
    if (!gameActive) return;

    if (faceObj.isChris) {
        score += 10;
        timeLeft += 5; 
        scoreElement.innerText = `Score: ${score}`;
        spawnEffect(faceObj.x, faceObj.y, "✅ +5s");
        resetPositions(); 
        increaseDifficulty(); // Schwierigkeit bei Treffer anpassen
    } else {
        score = Math.max(0, score - 5);
        timeLeft -= 2; 
        scoreElement.innerText = `Score: ${score}`;
        spawnEffect(faceObj.x, faceObj.y, "❌ -2s");
        increaseDifficulty();
    }
}

function increaseDifficulty() {
    currentDifficulty = 1 + (score / 100); 
    const speedScale = Math.min(currentDifficulty, 1);
    const newSize = Math.max(baseSize - (score / 4), minSize);

    faces.forEach(f => {
        // Geschwindigkeit skalieren (Richtung beibehalten)
        f.vx = f.vx * speedScale;
        f.vy = f.vy * speedScale;
        
        // Größe anpassen
        f.element.style.width = newSize + 'px';
        f.element.style.height = newSize + 'px';
    });
}

function spawnEffect(x, y, text) {
    const el = document.createElement('div');
    el.innerText = text;
    el.style.position = 'absolute';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.color = text.includes('✅') ? '#00ff00' : '#ff0000';
    el.style.fontWeight = 'bold';
    el.style.pointerEvents = 'none'; // Klicks durchlassen
    container.appendChild(el);
    setTimeout(() => el.remove(), 800);
}

function resetPositions() {
    const currentWidth = faces[0].element.offsetWidth;
    faces.forEach(f => {
        f.x = Math.random() * (window.innerWidth - currentWidth);
        f.y = Math.random() * (window.innerHeight - currentWidth);
        const bildeAuswahl = f.isChris ? chrisBilder : meineBilder;
        f.element.src = `extracted_faces/${bildeAuswahl[Math.floor(Math.random() * bildeAuswahl.length)]}`;
    });
}

function randomSwap() {
    if (!gameActive) return;
    const nonChrisFaces = faces.filter(f => !f.isChris);
    const randomFace = nonChrisFaces[Math.floor(Math.random() * nonChrisFaces.length)];
    if (randomFace) {
        randomFace.element.src = `extracted_faces/${meineBilder[Math.floor(Math.random() * meineBilder.length)]}`;
    }
}

function update() {
    if (!gameActive) return;

    faces.forEach(f => {
        f.x += f.vx; 
        f.y += f.vy;
        
        const currentWidth = f.element.offsetWidth;
        const currentHeight = f.element.offsetHeight;

        // --- Kollision Links/Rechts ---
        if (f.x + currentWidth > window.innerWidth || f.x < 0) {
            // Richtung umkehren
            f.vx *= -1;
            // Zufällige Variation der Geschwindigkeit beim Abprall (z.B. +/- 20%)
            f.vx += (Math.random() - 0.5) * 2; 
            // Auch die vertikale Geschwindigkeit leicht verändern für "schräge" Abpraller
            f.vy += (Math.random() - 0.5) * 2;
            
            // Verhindern, dass sie im Rand stecken bleiben
            f.x = f.x < 0 ? 0 : window.innerWidth - currentWidth;
        }

        // --- Kollision Oben/Unten ---
        if (f.y + currentHeight > window.innerHeight || f.y < 0) {
            // Richtung umkehren
            f.vy *= -1;
            // Zufällige Variation
            f.vy += (Math.random() - 0.5) * 2;
            f.vx += (Math.random() - 0.5) * 2;

            f.y = f.y < 0 ? 0 : window.innerHeight - currentHeight;
        }
        
        // --- Speed-Limit (optional, damit sie nicht zu extrem beschleunigen) ---
        const speed = Math.sqrt(f.vx * f.vx + f.vy * f.vy);
        const maxLimit = baseSpeed * currentDifficulty * 2;
        if (speed > maxLimit) {
            f.vx *= 0.9;
            f.vy *= 0.9;
        }

        f.element.style.left = f.x + 'px';
        f.element.style.top = f.y + 'px';
    });
    requestAnimationFrame(update);
}

const timerInterval = setInterval(() => {
    if (!gameActive) return;
    timeLeft--;
    
    // Alle 10 Sekunden ein neues Martin-Gesicht für mehr Stress
    if (timeLeft > 0 && timeLeft % 10 === 0 && faces.length < 120) {
        createFace(false);
        increaseDifficulty(); // Neu gespawnte Gesichter an aktuelle Difficulty anpassen
    }

    timerElement.innerText = `Zeit: ${timeLeft}s`;
    if (timeLeft <= 0) {
        gameActive = false;
        alert(`Game Over! Dein Score: ${score}`);
        clearInterval(timerInterval);
        location.reload();
    }
}, 1000);

window.addEventListener('resize', () => {
    faces.forEach(f => {
        const currentWidth = f.element.offsetWidth;
        if (f.x + currentWidth > window.innerWidth) f.x = window.innerWidth - currentWidth;
        if (f.y + currentWidth > window.innerHeight) f.y = window.innerHeight - currentWidth;
    });
});

// Start
for (let i = 0; i < numFaces - 1; i++) createFace(false);
createFace(true); 
setInterval(randomSwap, 3000); 
update();
