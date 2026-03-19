const container = document.getElementById('game-container');
const scoreElement = document.getElementById('score');
const timerElement = document.getElementById('timer');

// --- DYNAMISCHES SETUP ---
function calculateNumFaces() {
    const area = window.innerWidth * window.innerHeight;
    // Ein Gesicht pro 25.000 Pixel (Wert anpassen für mehr/weniger Dichte)
    // Auf einem iPhone (ca. 400.000 px) wären das ~16 Gesichter
    // Auf einem Full-HD Monitor (ca. 2.000.000 px) wären das ~80 Gesichter
    const density = 25000; 
    let count = Math.floor(area / density);
    
    // Limits setzen, damit es nicht zu extrem wird
    return Math.min(Math.max(count, 15), 120); 
}

let numFaces = calculateNumFaces();
let score = 0;
let timeLeft = 30;
let gameActive = true;

// Deine Bilder-Listen bleiben gleich
const meineBilder = Array.from({length: 783}, (_, i) => `Martin/Martin_${i+1}.png`);
const chrisBilder = Array.from({length: 304}, (_, i) => `Chris/Chris_${i+1}.png`);

let faces = [];

function createFace(isChris) {
    const faceObj = {
        isChris: isChris,
        element: document.createElement('img'),
        x: Math.random() * (window.innerWidth - 80),
        y: Math.random() * (window.innerHeight - 80),
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8
    };

    faceObj.element.className = 'face';
    // Zufälliges Bild aus der jeweiligen Liste wählen
    const bildeAuswahl = isChris ? chrisBilder : meineBilder;
    faceObj.element.src = `extracted_faces/${bildeAuswahl[Math.floor(Math.random() * bildeAuswahl.length)]}`;
    
    faceObj.element.addEventListener('click', () => handleFaceClick(faceObj));
    container.appendChild(faceObj.element);
    faces.push(faceObj);
}

function handleFaceClick(faceObj) {
    if (!gameActive) return;

    if (faceObj.isChris) {
        score += 10;
        timeLeft += 5; // Zeitbonus für Treffer
        scoreElement.innerText = `Score: ${score}`;
        spawnEffect(faceObj.x, faceObj.y, "✅ +5s");
        resetPositions(); // Alles neu mischen bei Treffer
    } else {
        score = Math.max(0, score - 5);
        timeLeft -= 2; // Strafe für falschen Klick
        scoreElement.innerText = `Score: ${score}`;
        spawnEffect(faceObj.x, faceObj.y, "❌ -2s");
    }
}

// Erzeugt einen kurzen Text-Effekt an der Klick-Stelle
function spawnEffect(x, y, text) {
    const el = document.createElement('div');
    el.innerText = text;
    el.style.position = 'absolute';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.color = text.includes('✅') ? '#00ff00' : '#ff0000';
    el.style.fontWeight = 'bold';
    container.appendChild(el);
    setTimeout(() => el.remove(), 800);
}

function resetPositions() {
    faces.forEach(f => {
        f.x = Math.random() * (window.innerWidth - 80);
        f.y = Math.random() * (window.innerHeight - 80);
        // Bild auch beim Reset zufällig neu wählen
        const bildeAuswahl = f.isChris ? chrisBilder : meineBilder;
        f.element.src = `extracted_faces/${bildeAuswahl[Math.floor(Math.random() * bildeAuswahl.length)]}`;
    });
}

// Tauscht alle 3 Sekunden ein zufälliges "Ich"-Gesicht gegen ein anderes aus
function randomSwap() {
    if (!gameActive) return;
    const nonChrisFaces = faces.filter(f => !f.isChris);
    const randomFace = nonChrisFaces[Math.floor(Math.random() * nonChrisFaces.length)];
    randomFace.element.src = `extracted_faces/${meineBilder[Math.floor(Math.random() * meineBilder.length)]}`;
}

function update() {
    if (!gameActive) return;

    faces.forEach(f => {
        f.x += f.vx; f.y += f.vy;
        if (f.x + 80 > window.innerWidth || f.x < 0) f.vx *= -1;
        if (f.y + 80 > window.innerHeight || f.y < 0) f.vy *= -1;
        f.element.style.left = f.x + 'px';
        f.element.style.top = f.y + 'px';
    });
    requestAnimationFrame(update);
}

// Timer Logik
const timerInterval = setInterval(() => {
    if (!gameActive) return;
    timeLeft--;
    timerElement.innerText = `Zeit: ${timeLeft}s`;
    if (timeLeft <= 0) {
        gameActive = false;
        alert(`Game Over! Dein Score: ${score}`);
        clearInterval(timerInterval);
        location.reload();
    }
}, 1000);

window.addEventListener('resize', () => {
    // Falls das Spiel aktiv ist, korrigieren wir die Positionen der Gesichter,
    // damit sie nicht außerhalb des neuen Sichtfelds landen.
    faces.forEach(f => {
        if (f.x + 80 > window.innerWidth) f.x = window.innerWidth - 80;
        if (f.y + 80 > window.innerHeight) f.y = window.innerHeight - 80;
    });
});

// Start
for (let i = 0; i < numFaces - 1; i++) createFace(false);
createFace(true); // Der Bruder
setInterval(randomSwap, 3000); // Alle 3 Sek. Bilder variieren
update();