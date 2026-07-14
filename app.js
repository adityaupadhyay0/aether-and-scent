/* ==========================================================================
   Aether & Scent Application Logic (Refined - White & Gold Flow)
   Includes: CSS3DRenderer Scene, Fibonacci Sphere & Curved Grid Math,
   Organic TWEEN Transitions, Centered Consultation Flow State Machine,
   and 3D Physical Drift.
   ========================================================================== */

// --- Global Application State ---
let scene, camera, renderer, controls;
let fragrances = [];
let cardObjects = []; // Holds the THREE.CSS3DObject elements
let sphereTargets = []; // Stores sphere {position, rotation}
let gridTargets = []; // Stores grid {position, rotation}
let activeLayout = 'sphere'; // 'sphere' or 'grid'

// Global drag guard — set by renderer.domElement move events
let isDragging = false;

// Quiz State
let currentQuestionIndex = 0;
let userAnswers = {}; // Map of questionId -> answerValue
let compatibilityScores = {}; // Map of perfumeId -> score (0 to 1)
let currentBranch = null; // 'Fresh' | 'Floral' | 'Woody' | 'Amber'

// UI State
let isInspectMode = false;
let preInspectCameraState = { position: new THREE.Vector3(), target: new THREE.Vector3() };
let activeSearchQuery = '';
let activeFamilyFilter = 'all';
let hideMismatches = false;
let isConsultationComplete = false;

// Conversational decision tree questions definition
const quizQuestions = [
  {
    id: "scentFamily",
    text: "Welcome to Aether & Scent. Let us begin our olfactory map. Which sensory escape calls to your spirit most?",
    type: "choice",
    options: [
      { text: "A crisp ocean breeze with fresh citrus", value: "Fresh", desc: "Zesty, marine, clean, and energetic" },
      { text: "A blooming rose garden after spring rain", value: "Floral", desc: "Romantic, delicate, sweet, and botanical" },
      { text: "A walk in a deep, damp forest of moss & cedar", value: "Woody", desc: "Dry, sophisticated, warm, and grounded" },
      { text: "An exotic spice market with warm vanilla", value: "Amber", desc: "Mysterious, sensual, rich, and enveloping" }
    ],
    scoreFn: (perfume, val) => (perfume.scentFamily === val ? 1.0 : 0.0)
  }
];

const branches = {
  Fresh: [
    {
      id: "freshType",
      text: "An excellent choice. Freshness has many faces. Which aromatic profile speaks to your style?",
      type: "choice",
      options: [
        { text: "Zesty lemon, fresh bergamot, and clean herbs", value: "Citrus", desc: "Bright, sparking, and uplifting" },
        { text: "Crisp ocean waves, sea salt, and marine breeze", value: "Marine", desc: "Aqueous, breezy, and cool" }
      ],
      scoreFn: (perfume, val) => {
        const allNotes = [...perfume.topNotes, ...perfume.middleNotes, ...perfume.baseNotes].map(n => n.toLowerCase());
        if (val === "Marine") {
          return allNotes.some(n => n.includes("sea") || n.includes("marine") || n.includes("ocean") || n.includes("salt") || n.includes("water")) ? 1.0 : 0.3;
        }
        return allNotes.some(n => n.includes("lemon") || n.includes("bergamot") || n.includes("mint") || n.includes("citrus") || n.includes("lime") || n.includes("orange")) ? 1.0 : 0.3;
      }
    },
    {
      id: "intensity",
      text: "How loud should this fresh breeze carry in a room?",
      type: "slider",
      labels: ["Subtle Whisper", "Conversational Trail", "Commanding Presence"],
      min: 1, max: 5, defaultValue: 3,
      scoreFn: (perfume, val) => 1 - Math.abs(perfume.intensity - parseInt(val)) / 4
    },
    {
      id: "season",
      text: "What climate does this escape fit best?",
      type: "choice",
      options: [
        { text: "Bright sunshine & hot summer beaches", value: "Summer", desc: "Sunkissed skin & warm air" },
        { text: "Cool spring mornings & mountain air", value: "Spring", desc: "Dewy leaves & fresh starts" }
      ],
      scoreFn: (perfume, val) => (perfume.season === val ? 1.0 : 0.4)
    },
    {
      id: "vibe",
      text: "Lastly, choose the attire for this signature:",
      type: "choice",
      options: [
        { text: "Minimalist, clean, sporty & crisp white tees", value: "Clean", desc: "Pure, casual, and effortless" },
        { text: "Timeless elegance & tailored classics", value: "Sophisticated", desc: "Sharp, refined, and confident" }
      ],
      scoreFn: (perfume, val) => (perfume.vibe === val ? 1.0 : 0.3)
    }
  ],
  Floral: [
    {
      id: "floralType",
      text: "Floral essences carry deep emotional range. What kind of blossom matches your aura?",
      type: "choice",
      options: [
        { text: "Rich rose, sweet peony, and classic petals", value: "Rose", desc: "Romantic, timeless, and delicate" },
        { text: "Sensual jasmine, tuberose, and white flowers", value: "Jasmine", desc: "Intense, mysterious, and opulent" }
      ],
      scoreFn: (perfume, val) => {
        const allNotes = [...perfume.topNotes, ...perfume.middleNotes, ...perfume.baseNotes].map(n => n.toLowerCase());
        if (val === "Rose") {
          return allNotes.some(n => n.includes("rose") || n.includes("peony") || n.includes("freesia")) ? 1.0 : 0.3;
        }
        return allNotes.some(n => n.includes("jasmine") || n.includes("tuberose") || n.includes("neroli") || n.includes("blossom")) ? 1.0 : 0.3;
      }
    },
    {
      id: "longevity",
      text: "How long do you need this floral aura to linger on you?",
      type: "slider",
      labels: ["A morning garden splash", "Standard workday length", "Eternal day-and-night aura"],
      min: 1, max: 5, defaultValue: 3,
      scoreFn: (perfume, val) => 1 - Math.abs(perfume.longevity - parseInt(val)) / 4
    },
    {
      id: "vibe",
      text: "Describe the vibe you wish to project:",
      type: "choice",
      options: [
        { text: "Artistic, romantic, and soft pastel tones", value: "Romantic", desc: "Dreamy, warm, and gentle" },
        { text: "Timeless elegance, suits, and designer chic", value: "Sophisticated", desc: "Modern, high-fashion, and polished" }
      ],
      scoreFn: (perfume, val) => (perfume.vibe === val ? 1.0 : 0.3)
    },
    {
      id: "sweetness",
      text: "How do you feel about honeyed or sugary sweetness?",
      type: "slider",
      labels: ["Completely dry/tart", "Delicate hint of sweet", "Rich, dessert-like gourmand"],
      min: 1, max: 5, defaultValue: 3,
      scoreFn: (perfume, val) => 1 - Math.abs(perfume.sweetness - parseInt(val)) / 4
    }
  ],
  Woody: [
    {
      id: "woodType",
      text: "A choice of profound substance. Which wood profile represents your character?",
      type: "choice",
      options: [
        { text: "Creamy sandalwood & soft cedar shavings", value: "Sandalwood", desc: "Warm, smooth, and comforting" },
        { text: "Dark, smoky oud & rich patchouli earth", value: "Oud", desc: "Intense, deep, and mysterious" }
      ],
      scoreFn: (perfume, val) => {
        const allNotes = [...perfume.topNotes, ...perfume.middleNotes, ...perfume.baseNotes].map(n => n.toLowerCase());
        if (val === "Sandalwood") {
          return allNotes.some(n => n.includes("sandalwood") || n.includes("cedar") || n.includes("vetiver")) ? 1.0 : 0.3;
        }
        return allNotes.some(n => n.includes("oud") || n.includes("patchouli") || n.includes("agarwood") || n.includes("smok")) ? 1.0 : 0.3;
      }
    },
    {
      id: "intensity",
      text: "How powerful should this woody sillage project?",
      type: "slider",
      labels: ["Quiet skin scent", "Distinct personal bubble", "Commanding boardroom trail"],
      min: 1, max: 5, defaultValue: 3,
      scoreFn: (perfume, val) => 1 - Math.abs(perfume.intensity - parseInt(val)) / 4
    },
    {
      id: "season",
      text: "Which seasonal climate feels most fitting?",
      type: "choice",
      options: [
        { text: "Cool autumn breezes & woodsmoke", value: "Autumn", desc: "Crisp leaves & golden sunlight" },
        { text: "Chilly winter frost & log fires", value: "Winter", desc: "Snowy evenings & heavy coats" }
      ],
      scoreFn: (perfume, val) => (perfume.season === val ? 1.0 : 0.4)
    },
    {
      id: "vibe",
      text: "And the aesthetic attire for this scent:",
      type: "choice",
      options: [
        { text: "Timeless elegance & tailored lines", value: "Sophisticated", desc: "Classic, dignified, and elegant" },
        { text: "Bold, rugged boots & outdoor adventure", value: "Adventurous", desc: "Earthy, masculine, and untamed" }
      ],
      scoreFn: (perfume, val) => (perfume.vibe === val ? 1.0 : 0.3)
    }
  ],
  Amber: [
    {
      id: "amberType",
      text: "Exotic and enveloping. Which facet of the East calls to you?",
      type: "choice",
      options: [
        { text: "Warm vanilla, rich honey & sweet resins", value: "Sweet", desc: "Cozy, delicious, and inviting" },
        { text: "Cardamom spice, dark leather & smoky incense", value: "Spicy", desc: "Bold, exotic, and magnetic" }
      ],
      scoreFn: (perfume, val) => {
        const allNotes = [...perfume.topNotes, ...perfume.middleNotes, ...perfume.baseNotes].map(n => n.toLowerCase());
        if (val === "Sweet") {
          return allNotes.some(n => n.includes("vanilla") || n.includes("honey") || n.includes("tonka") || n.includes("benzoin")) ? 1.0 : 0.3;
        }
        return allNotes.some(n => n.includes("cardamom") || n.includes("spice") || n.includes("pepper") || n.includes("incense") || n.includes("leather")) ? 1.0 : 0.3;
      }
    },
    {
      id: "warmth",
      text: "Select the temperature of comfort you desire on your skin:",
      type: "slider",
      labels: ["Neutral/Balanced warmth", "Warm amber glow", "Intensely hot, spicy fireplace"],
      min: 1, max: 5, defaultValue: 3,
      scoreFn: (perfume, val) => 1 - Math.abs(perfume.warmth - parseInt(val)) / 4
    },
    {
      id: "timeOfDay",
      text: "When will you summon this mysterious signature?",
      type: "choice",
      options: [
        { text: "Intimate dinners and late night outings", value: "Night", desc: "Seductive, mysterious, and dark" },
        { text: "An all-day signature for any occasion", value: "All", desc: "Versatile, rich, and confident" }
      ],
      scoreFn: (perfume, val) => (perfume.timeOfDay === val ? 1.0 : 0.5)
    },
    {
      id: "vibe",
      text: "Select the vibe you wish to project:",
      type: "choice",
      options: [
        { text: "Mysterious, dark, and avant-garde", value: "Mysterious", desc: "Seductive, intriguing, and deep" },
        { text: "Cozy fireside, knitwear, and comfort", value: "Cozy", desc: "Warm, close, and affectionate" }
      ],
      scoreFn: (perfume, val) => (perfume.vibe === val ? 1.0 : 0.3)
    }
  ]
};

function getActiveQuestions() {
  if (!currentBranch) {
    return quizQuestions;
  }
  return [quizQuestions[0], ...branches[currentBranch]];
}

// --- Initializer & Setup ---
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  try {
    const progress = document.getElementById('loader-progress');
    progress.style.width = '30%';
    
    const response = await fetch('data/fragrances.json?v=' + Date.now());
    if (!response.ok) throw new Error("Failed to load fragrance dataset");
    fragrances = await response.json();
    
    progress.style.width = '60%';
    
    initThreeJS();
    
    progress.style.width = '90%';
    
    createPerfumeCards();
    calculateSphereLayout();
    calculateGridLayout();
    
    resetQuizState();
    
    transformLayout(activeLayout, 0); // Jump instantly at start
    
    progress.style.width = '100%';
    setTimeout(() => {
      const loader = document.getElementById('loader');
      loader.style.opacity = '0';
      setTimeout(() => loader.style.display = 'none', 800);
    }, 500);

    bindUIEvents();
    lucide.createIcons();
    
  } catch (error) {
    console.error("Initialization Error:", error);
    document.querySelector('.loader-text').innerText = "Error loading data: " + error.message;
    document.querySelector('.loader-bar').style.backgroundColor = "#ff4d4d";
  }
}

// --- Initialize Three.js Environment ---
function initThreeJS() {
  const container = document.getElementById('canvas-container');
  
  scene = new THREE.Scene();
  
  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000);
  camera.position.set(0, 0, 50); // Inside looking out
  
  renderer = new THREE.CSS3DRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);
  
  // ---- Projection-based card click detection ----
  // CSS3D hit testing is unreliable with OrbitControls pointer capture.
  // Instead: on mouseup, project every card's 3D world position to 2D screen
  // coordinates and open whichever card center is closest to the click point.
  let _downX = 0, _downY = 0;
  document.addEventListener('mousedown', (e) => {
    _downX = e.clientX;
    _downY = e.clientY;
  });
  document.addEventListener('mouseup', (e) => {
    // Ignore if this was a drag (> 6px movement)
    if (Math.hypot(e.clientX - _downX, e.clientY - _downY) > 6) return;
    // Ignore clicks on UI elements (drawers, buttons, overlays)
    if (e.target.closest('#product-drawer, #cart-drawer, .centered-overlay, .btn-consultation-trigger, .floating-controls-top, .cart-btn-fixed, #results-screen, #results-grid')) return;

    let closestId = null;
    let closestDist = Infinity;
    const MAX_DIST = 150; // px — how close the cursor must be to a card center

    cardObjects.forEach((object, index) => {
      const perfume = fragrances[index];
      // Skip cards that are explicitly disabled
      if (object.element.style.pointerEvents === 'none') return;

      // Compute the card's absolute world position (scene can be rotated)
      const worldPos = object.position.clone().applyEuler(scene.rotation);

      // Project world → Normalised Device Coordinates [-1, 1]
      const ndc = worldPos.clone().project(camera);

      // Discard anything behind the camera
      if (ndc.z >= 1) return;

      // Convert NDC to actual screen pixels
      const sx = (ndc.x + 1) * 0.5 * window.innerWidth;
      const sy = (-ndc.y + 1) * 0.5 * window.innerHeight;

      const dist = Math.hypot(e.clientX - sx, e.clientY - sy);
      if (dist < MAX_DIST && dist < closestDist) {
        closestDist = dist;
        closestId = perfume.id;
      }
    });

    if (closestId !== null) inspectCard(closestId);
  });
  
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 10;
  controls.maxDistance = 2500;
  
  window.addEventListener('resize', onWindowResize);
  animateLoop();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animateLoop() {
  requestAnimationFrame(animateLoop);
  
  TWEEN.update();
  controls.update();
  
  // Continuous slow rotation in Sphere mode to reveal 3D space organically
  if (activeLayout === 'sphere' && !isInspectMode) {
    scene.rotation.y += 0.0006;
    scene.rotation.x += 0.0002;
  } else {
    // Return scene rotation to neutral slowly when not in sphere
    scene.rotation.y += (0 - scene.rotation.y) * 0.05;
    scene.rotation.x += (0 - scene.rotation.x) * 0.05;
  }
  
  renderer.render(scene, camera);
}

// --- Create 3D CSS3DObject Card Elements ---
function createPerfumeCards() {
  fragrances.forEach((perfume) => {
    // Create card container
    const element = document.createElement('div');
    element.className = `perfume-card ${perfume.scentFamily}`;
    element.setAttribute('data-id', perfume.id);
    
    // Image container
    const imgContainer = document.createElement('div');
    imgContainer.className = 'card-image-container';
    
    const img = document.createElement('img');
    img.src = perfume.image;
    img.alt = perfume.name;
    img.className = 'card-img';
    img.loading = 'lazy';
    
    const glow = document.createElement('div');
    glow.className = 'card-glow-bg';
    
    // Tiny hidden badge for internal score tracking
    const scoreBadge = document.createElement('div');
    scoreBadge.className = 'card-match-badge';
    scoreBadge.innerText = '100%';
    
    imgContainer.appendChild(img);
    imgContainer.appendChild(glow);
    imgContainer.appendChild(scoreBadge);
    element.appendChild(imgContainer);
    
    // Minimalist Details
    const details = document.createElement('div');
    details.className = 'card-details';
    
    const brand = document.createElement('span');
    brand.className = 'card-brand';
    brand.innerText = perfume.brand;
    
    const name = document.createElement('h3');
    name.className = 'card-name';
    name.innerText = perfume.name;
    
    const priceVal = perfume.tier === 'Niche' ? (285 + (perfume.id % 7) * 10) : (135 + (perfume.id % 5) * 10);
    const price = document.createElement('span');
    price.className = 'card-note-hint';
    price.innerText = `$${priceVal}`;
    
    details.appendChild(brand);
    details.appendChild(name);
    details.appendChild(price);
    element.appendChild(details);
    // No per-card click handler — handled globally on renderer.domElement below

    const object = new THREE.CSS3DObject(element);
    
    // Start at correct full scale immediately — no ugly pop on first load
    object.scale.set(1.0, 1.0, 1.0);
    
    // Scatter cards in 3D initially
    object.position.x = (Math.random() - 0.5) * 4000;
    object.position.y = (Math.random() - 0.5) * 4000;
    object.position.z = (Math.random() - 0.5) * 4000;
    
    scene.add(object);
    cardObjects.push(object);
  });
}

// --- Layout Mathematics ---

// A. Fibonacci Lattice Sphere Layout (Expanded Radius = 1200)
function calculateSphereLayout() {
  const N = fragrances.length;
  const radius = 1200; // Expanded radius to create distance
  const phi = Math.PI * (3 - Math.sqrt(5)); 
  
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2; 
    const radiusAtY = Math.sqrt(1 - y * y); 
    const theta = phi * i; 
    
    const x = Math.cos(theta) * radiusAtY * radius;
    const z = Math.sin(theta) * radiusAtY * radius;
    const yVal = y * radius;
    
    const position = new THREE.Vector3(x, yVal, z);
    
    const tempObj = new THREE.Object3D();
    tempObj.position.copy(position);
    tempObj.lookAt(0, 0, 0); // Face origin
    
    sphereTargets.push({
      position: position,
      rotation: tempObj.rotation.clone()
    });
  }
}

// B. Clean Flat Grid Wall Layout
function calculateGridLayout() {
  const N = fragrances.length;
  const cols = 10;
  const spacingX = 260; // Clean, straight layout spacing
  const spacingY = 320; 
  
  for (let i = 0; i < N; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    
    const x = (col - (cols - 1) / 2) * spacingX;
    const y = -(row - (Math.ceil(N / cols) - 1) / 2) * spacingY;
    const z = 0; // Flat wall
    
    const position = new THREE.Vector3(x, y, z);
    const rotation = new THREE.Euler(0, 0, 0); // Facing straight forward
    
    gridTargets.push({
      position: position,
      rotation: rotation
    });
  }
}

// --- Layout Transition Engine (TWEEN) ---
function transformLayout(targetLayoutName, duration = 1200) {
  activeLayout = targetLayoutName;
  TWEEN.removeAll(); 
  isInspectMode = false; 
  
  const targets = (targetLayoutName === 'sphere') ? sphereTargets : gridTargets;
  
  cardObjects.forEach((object, index) => {
    const perfume = fragrances[index];
    const score = compatibilityScores[perfume.id] !== undefined ? compatibilityScores[perfume.id] : 1.0;
    
    const target = targets[index];
    let targetPos = target.position.clone();
    let targetRot = target.rotation.clone();
    
    // Apply 3D Physics Drift based on score (only if consultation has run)
    if (isConsultationComplete) {
      if (score >= 0.85) {
        if (targetLayoutName === 'sphere') {
          const dir = new THREE.Vector3().copy(targetPos).normalize();
          targetPos.addScaledVector(dir, -350); // Float much closer to camera
        } else {
          targetPos.z += 200; // Pop grid card forward
        }
      } else if (score < 0.45) {
        if (targetLayoutName === 'sphere') {
          const dir = new THREE.Vector3().copy(targetPos).normalize();
          targetPos.addScaledVector(dir, 350); // Push mismatches far to back
        } else {
          targetPos.z -= 200; // Sink grid card backward
        }
      }
    }
    
    const delay = Math.random() * 150;
    
    // Position
    new TWEEN.Tween(object.position)
      .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, duration)
      .easing(TWEEN.Easing.Cubic.Out)
      .delay(delay)
      .start();
      
    // Rotation
    new TWEEN.Tween(object.rotation)
      .to({ x: targetRot.x, y: targetRot.y, z: targetRot.z }, duration)
      .easing(TWEEN.Easing.Cubic.Out)
      .delay(delay)
      .start();
      
    // Card Scale — full size (1.0) in free nav, score-weighted if consultation complete
    const targetScale = isConsultationComplete ? (0.4 + 0.6 * score) : 1.0;
    new TWEEN.Tween(object.scale)
      .to({ x: targetScale, y: targetScale, z: targetScale }, duration)
      .easing(TWEEN.Easing.Cubic.Out)
      .delay(delay)
      .start();
  });
  
  // Camera Adjustments
  let targetCamPos = { x: 0, y: 0, z: 50 }; 
  let targetControlsTarget = { x: 0, y: 0, z: 0 };
  
  if (targetLayoutName === 'grid') {
    targetCamPos = { x: 0, y: 0, z: 1800 }; // Zoomed back to frame wide grid
  }
  
  new TWEEN.Tween(camera.position)
    .to(targetCamPos, duration)
    .easing(TWEEN.Easing.Cubic.Out)
    .start();
    
  new TWEEN.Tween(controls.target)
    .to(targetControlsTarget, duration)
    .easing(TWEEN.Easing.Cubic.Out)
    .start();
}

// --- Scent Profiler Scoring Engine ---
function resetQuizState() {
  currentQuestionIndex = 0;
  userAnswers = {};
  isConsultationComplete = false;
  currentBranch = null;
  
  fragrances.forEach(p => {
    compatibilityScores[p.id] = 1.0;
  });
  
  updateCardVisuals3D();
  
  // Hide results screen, show 3D scene
  document.getElementById('results-screen').style.display = 'none';
  document.getElementById('product-drawer').classList.remove('active');
  
  // Reset overlay panels
  document.getElementById('panel-quiz').classList.remove('active');
  document.getElementById('panel-reveal').classList.remove('active');
  document.getElementById('btn-global-reset').style.display = 'none';
  document.getElementById('btn-open-consultation').style.display = 'block';
  
  restoreCameraAfterInspection();
}

function calculateCompatibility() {
  const answeredIds = Object.keys(userAnswers);
  
  if (answeredIds.length === 0) {
    fragrances.forEach(p => {
      compatibilityScores[p.id] = 1.0;
    });
    return;
  }
  
  const selectedFamily = userAnswers["scentFamily"];
  const activeQuestions = getActiveQuestions();
  
  fragrances.forEach(perfume => {
    let totalScore = 0;
    let totalWeight = 0;
    
    answeredIds.forEach(qId => {
      const question = activeQuestions.find(q => q.id === qId);
      if (!question) return;
      
      const answerVal = userAnswers[qId];
      const questionScore = question.scoreFn(perfume, answerVal);
      
      let weight = 1.0;
      if (qId === "scentFamily") weight = 2.0; // Scent family has heavy weight
      
      totalScore += questionScore * weight;
      totalWeight += weight;
    });
    
    let score = totalScore / (totalWeight || 1.0);
    
    // Apply Hard Family Filter
    if (selectedFamily && perfume.scentFamily !== selectedFamily) {
      score = score * 0.05; // Mismatches drop almost to zero
    }
    
    compatibilityScores[perfume.id] = score;
  });
}

function updateCardVisuals3D() {
  const isConsultationActive = document.getElementById('panel-quiz').classList.contains('active');
  const answeredKeys = Object.keys(userAnswers);
  const isAnyAnswered = answeredKeys.length > 0;
  
  // Find top 5 matches to pull into the foreground
  let top5Ids = [];
  if (isConsultationActive && isAnyAnswered) {
    const sorted = [...fragrances].sort((a, b) => compatibilityScores[b.id] - compatibilityScores[a.id]);
    top5Ids = sorted.slice(0, 5).map(p => p.id);
  }
  
  cardObjects.forEach((object, index) => {
    const perfume = fragrances[index];
    const score = compatibilityScores[perfume.id];
    const element = object.element;
    
    const badge = element.querySelector('.card-match-badge');
    if (badge) {
      const percent = Math.round(score * 100);
      badge.innerText = `${percent}% Match`;
    }
    
    element.classList.remove('highlighted', 'faded');
    
    if (isConsultationActive) {
      if (isAnyAnswered) {
        if (top5Ids.includes(perfume.id)) {
          element.classList.add('highlighted');
          element.style.opacity = '1';
          element.style.pointerEvents = 'auto';
          
          // Animate cards into a neat foreground semi-circular arc (shifted right by +150 to keep it visible next to sidebar)
          const rank = top5Ids.indexOf(perfume.id);
          const angle = (rank - 2) * 0.35; // Horizontally spaced arc
          
          const targetX = 150 + Math.sin(angle) * 320; 
          const targetY = (rank % 2 === 0 ? 30 : -30); // Soft vertical wave offset
          const targetZ = 380 - (Math.cos(angle) * 60);
          
          new TWEEN.Tween(object.position)
            .to({ x: targetX, y: targetY, z: targetZ }, 900)
            .easing(TWEEN.Easing.Cubic.Out)
            .start();
            
          new TWEEN.Tween(object.rotation)
            .to({ x: 0, y: -angle * 0.8, z: 0 }, 900)
            .easing(TWEEN.Easing.Cubic.Out)
            .start();
            
          new TWEEN.Tween(object.scale)
            .to({ x: 0.6, y: 0.6, z: 0.6 }, 900) // Visible but not too big during consultation
            .easing(TWEEN.Easing.Cubic.Out)
            .start();
        } else {
          element.classList.add('faded');
          element.style.opacity = '0.12';
          element.style.pointerEvents = 'none';
          
          // Recede other cards back
          const basePos = (activeLayout === 'sphere') ? sphereTargets[index].position : gridTargets[index].position;
          new TWEEN.Tween(object.position)
            .to({ x: basePos.x, y: basePos.y, z: basePos.z - 400 }, 900)
            .easing(TWEEN.Easing.Cubic.Out)
            .start();
            
          new TWEEN.Tween(object.scale)
            .to({ x: 0.35, y: 0.35, z: 0.35 }, 900) // Slightly larger faded scale
            .easing(TWEEN.Easing.Cubic.Out)
            .start();
        }
      } else {
        // No answers yet (first step): show default layouts at normal readable size
        const baseTarget = (activeLayout === 'sphere') ? sphereTargets[index] : gridTargets[index];
        new TWEEN.Tween(object.position)
          .to({ x: baseTarget.position.x, y: baseTarget.position.y, z: baseTarget.position.z }, 800)
          .easing(TWEEN.Easing.Cubic.Out)
          .start();
          
        new TWEEN.Tween(object.rotation)
          .to({ x: baseTarget.rotation.x, y: baseTarget.rotation.y, z: baseTarget.rotation.z }, 800)
          .easing(TWEEN.Easing.Cubic.Out)
          .start();
          
        new TWEEN.Tween(object.scale)
          .to({ x: 0.5, y: 0.5, z: 0.5 }, 800) // Visible default during consultation
          .easing(TWEEN.Easing.Cubic.Out)
          .start();
          
        element.style.opacity = '';
        element.style.pointerEvents = '';
      }
    } else {
      // Normal free navigation mode
      const baseTarget = (activeLayout === 'sphere') ? sphereTargets[index] : gridTargets[index];
      let targetPos = baseTarget.position.clone();
      let targetRot = baseTarget.rotation.clone();
      let targetScale = 1.0;
      
      if (isConsultationComplete) {
        if (score >= 0.85) {
          element.classList.add('highlighted');
          targetScale = 1.5; // Large highlighted matches
          if (activeLayout === 'sphere') {
            const dir = new THREE.Vector3().copy(targetPos).normalize();
            targetPos.addScaledVector(dir, -250);
          } else {
            targetPos.z += 200;
          }
        } else if (score < 0.45) {
          element.classList.add('faded');
          targetScale = 0.55;
          element.style.opacity = '0.15';
          if (activeLayout === 'sphere') {
            const dir = new THREE.Vector3().copy(targetPos).normalize();
            targetPos.addScaledVector(dir, 250);
          } else {
            targetPos.z -= 200;
          }
        }
      }
      
      new TWEEN.Tween(object.position)
        .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, 800)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();
        
      new TWEEN.Tween(object.rotation)
        .to({ x: targetRot.x, y: targetRot.y, z: targetRot.z }, 800)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();
        
      new TWEEN.Tween(object.scale)
        .to({ x: targetScale, y: targetScale, z: targetScale }, 800)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();
        
      element.style.opacity = '';
      element.style.pointerEvents = '';
    }
  });
}

// Show full-screen 2D results grid after consultation
function showResultsScreen() {
  const isAnyAnswered = Object.keys(userAnswers).length > 0;
  if (!isAnyAnswered || !isConsultationComplete) return;

  const sorted = [...fragrances].sort((a, b) => compatibilityScores[b.id] - compatibilityScores[a.id]);
  // Show top 10 or all that scored reasonably well (> 5%)
  const topMatches = sorted.filter(p => compatibilityScores[p.id] > 0.05).slice(0, 12);

  const grid = document.getElementById('results-grid');
  grid.innerHTML = '';

  topMatches.forEach((perfume, idx) => {
    const percent = Math.round(compatibilityScores[perfume.id] * 100);
    const priceVal = perfume.tier === 'Niche' ? (285 + (perfume.id % 7) * 10) : (135 + (perfume.id % 5) * 10);

    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <span class="rc-rank">#${idx + 1}</span>
      <span class="rc-match-pct">${percent}%</span>
      <div class="rc-img-wrap">
        <img src="${perfume.image}" alt="${perfume.name}" loading="lazy">
      </div>
      <div class="rc-info">
        <div class="rc-brand">${perfume.brand}</div>
        <div class="rc-name">${perfume.name}</div>
        <div class="rc-price">$${priceVal}</div>
      </div>
    `;

    // Every card click opens the right-side product drawer
    card.addEventListener('click', () => {
      openDetailModal(perfume);
    });

    grid.appendChild(card);
  });

  // Show the results screen, hide 3D canvas
  document.getElementById('results-screen').style.display = 'flex';
  lucide.createIcons();
}

const familyIcons = {
  Fresh: 'wind',
  Floral: 'flower',
  Woody: 'trees',
  Amber: 'sparkles'
};

/// --- Render Quiz Questionnaire HTML ---
function renderQuestion() {
  const container = document.getElementById('question-card');
  const progressText = document.getElementById('quiz-question-number');
  const progressFill = document.getElementById('quiz-progress-fill');
  
  const activeQuestions = getActiveQuestions();
  const q = activeQuestions[currentQuestionIndex];
  
  const progressPercent = ((currentQuestionIndex + 1) / activeQuestions.length) * 100;
  progressFill.style.width = `${progressPercent}%`;
  progressText.innerText = `Step ${currentQuestionIndex + 1} of ${activeQuestions.length}`;
  
  let html = `
    <div class="question-card-inner">
      <div class="consultant-chat-bubble">
        "${q.text}"
      </div>
  `;
  
  if (q.type === 'choice') {
    html += `<div class="choice-grid-wrapper">`;
    q.options.forEach((opt) => {
      const isSelected = userAnswers[q.id] === opt.value;
      let familyIconHtml = '';
      if (q.id === "scentFamily") {
        const iconName = familyIcons[opt.value] || 'sparkles';
        familyIconHtml = `<div class="choice-icon-wrap"><i data-lucide="${iconName}"></i></div>`;
      }
      
      html += `
        <div class="visual-choice-card ${isSelected ? 'selected' : ''}" data-value="${opt.value}">
          ${familyIconHtml}
          <div class="choice-title">${opt.text}</div>
          <div class="choice-description">${opt.desc || ''}</div>
        </div>
      `;
    });
    html += `</div>`;
  } 
  else if (q.type === 'slider') {
    const currentVal = userAnswers[q.id] !== undefined ? userAnswers[q.id] : q.defaultValue;
    html += `
      <div class="luxury-slider-container">
        <input type="range" class="luxury-slider" id="question-slider" 
               min="${q.min}" max="${q.max}" value="${currentVal}">
        <div class="slider-labels-row">
          <span>${q.labels[0]}</span>
          <span>${q.labels[1]}</span>
          <span>${q.labels[2]}</span>
        </div>
      </div>
    `;
  }
  
  html += `</div>`;
  container.innerHTML = html;
  
  // Bind Choice Card clicks
  if (q.type === 'choice') {
    container.querySelectorAll('.visual-choice-card').forEach(card => {
      card.addEventListener('click', () => {
        const val = card.getAttribute('data-value');
        userAnswers[q.id] = val;
        
        container.querySelectorAll('.visual-choice-card').forEach(b => b.classList.remove('selected'));
        card.classList.add('selected');
        
        // Handle scentFamily selection (which updates the branching path!)
        if (q.id === "scentFamily") {
          currentBranch = val;
          // Reset answers to other questions since path changed
          Object.keys(userAnswers).forEach(k => {
            if (k !== "scentFamily") delete userAnswers[k];
          });
        }
        
        calculateCompatibility();
        updateCardVisuals3D();
        
        setTimeout(() => {
          advanceFlow();
        }, 400);
      });
    });
  } 
  // Bind slider changes
  else if (q.type === 'slider') {
    const slider = document.getElementById('question-slider');
    slider.addEventListener('input', (e) => {
      const val = e.target.value;
      userAnswers[q.id] = val;
      calculateCompatibility();
      updateCardVisuals3D();
    });
  }
  
  updateQuizNavigationButtons();
}

function advanceFlow() {
  const activeQuestions = getActiveQuestions();
  if (currentQuestionIndex < activeQuestions.length - 1) {
    currentQuestionIndex++;
    renderQuestion();
  } else {
    // Show Reveal Panel
    document.getElementById('panel-quiz').classList.remove('active');
    document.getElementById('panel-reveal').classList.add('active');
  }
}

function updateQuizNavigationButtons() {
  const prevBtn = document.getElementById('btn-quiz-prev');
  const nextBtn = document.getElementById('btn-quiz-next');
  
  prevBtn.disabled = currentQuestionIndex === 0;
  
  // Show Next button ONLY for range sliders (so choices auto-advance)
  const activeQuestions = getActiveQuestions();
  const q = activeQuestions[currentQuestionIndex];
  if (q.type === 'slider') {
    nextBtn.style.display = 'flex';
    if (currentQuestionIndex === activeQuestions.length - 1) {
      nextBtn.innerHTML = `Finish <i data-lucide="check"></i>`;
    } else {
      nextBtn.innerHTML = `Next <i data-lucide="chevron-right"></i>`;
    }
  } else {
    nextBtn.style.display = 'none';
  }
  
  lucide.createIcons();
}

// --- Card Inspector (Camera Zoom Focus) ---
function inspectCard(perfumeId) {
  const object = cardObjects.find(obj => obj.element.getAttribute('data-id') == perfumeId);
  const perfume = fragrances.find(p => p.id == perfumeId);
  
  if (!object || !perfume) return;
  
  if (!isInspectMode) {
    preInspectCameraState.position.copy(camera.position);
    preInspectCameraState.target.copy(controls.target);
  }
  
  isInspectMode = true;
  
  const cardPos = object.position.clone();
  // Project camera vectors relative to scene rotation (since scene rotates, get absolute position)
  const absoluteCardPos = cardPos.clone().applyEuler(scene.rotation);
  const dir = new THREE.Vector3().copy(absoluteCardPos).normalize();
  
  let cameraTargetPos = absoluteCardPos.clone();
  
  if (activeLayout === 'sphere') {
    cameraTargetPos.addScaledVector(dir, -420); // Zoom in closer
  } else {
    cameraTargetPos.z += 420;
  }
  
  controls.enabled = false;
  
  new TWEEN.Tween(controls.target)
    .to({ x: absoluteCardPos.x, y: absoluteCardPos.y, z: absoluteCardPos.z }, 1000)
    .easing(TWEEN.Easing.Cubic.Out)
    .start();
    
  new TWEEN.Tween(camera.position)
    .to({ x: cameraTargetPos.x, y: cameraTargetPos.y, z: cameraTargetPos.z }, 1000)
    .easing(TWEEN.Easing.Cubic.Out)
    .onComplete(() => {
      controls.enabled = true;
      controls.target.copy(absoluteCardPos);
    })
    .start();
    
  openDetailModal(perfume);
}

function restoreCameraAfterInspection() {
  if (!isInspectMode) return;
  isInspectMode = false;
  
  controls.enabled = false;
  
  new TWEEN.Tween(camera.position)
    .to({ 
      x: preInspectCameraState.position.x, 
      y: preInspectCameraState.position.y, 
      z: preInspectCameraState.position.z 
    }, 1000)
    .easing(TWEEN.Easing.Cubic.Out)
    .start();
    
  new TWEEN.Tween(controls.target)
    .to({ 
      x: preInspectCameraState.target.x, 
      y: preInspectCameraState.target.y, 
      z: preInspectCameraState.target.z 
    }, 1000)
    .easing(TWEEN.Easing.Cubic.Out)
    .onComplete(() => {
      controls.enabled = true;
    })
    .start();
}

// --- Detail Drawer Populate & Render ---
function openDetailModal(perfume) {
  const drawer = document.getElementById('product-drawer');
  
  const glow = document.getElementById('drawer-glow-bg');
  glow.style.backgroundColor = getFamilyGlowColor(perfume.scentFamily);
  
  const familyTag = document.getElementById('drawer-family');
  familyTag.className = `drawer-family ${perfume.scentFamily}`;
  familyTag.innerText = perfume.scentFamily.toUpperCase();
  
  document.getElementById('drawer-perfume-img').src = perfume.image;
  document.getElementById('drawer-brand').innerText = perfume.brand;
  document.getElementById('drawer-name').innerText = perfume.name;
  document.getElementById('drawer-description').innerText = perfume.description;
  
  document.getElementById('drawer-top-notes').innerText = perfume.topNotes.join(', ');
  document.getElementById('drawer-middle-notes').innerText = perfume.middleNotes.join(', ');
  document.getElementById('drawer-base-notes').innerText = perfume.baseNotes.join(', ');
  
  // Set progress bars
  setMetricBar('intensity', perfume.intensity);
  setMetricBar('longevity', perfume.longevity);
  setMetricBar('warmth', perfume.warmth);
  
  const priceVal = perfume.tier === 'Niche' ? (285 + (perfume.id % 7) * 10) : (135 + (perfume.id % 5) * 10);
  document.getElementById('drawer-price').innerText = `$${priceVal}`;
  
  // Store the active perfume on the drawer
  drawer.setAttribute('data-active-perfume-id', perfume.id);
  
  // Open right drawer
  drawer.classList.add('active');
  lucide.createIcons();
}

function setMetricBar(metricId, rating) {
  const fill = document.getElementById(`drawer-metric-${metricId}-fill`);
  const percentage = (rating / 5) * 100;
  if (fill) {
    fill.style.width = `${percentage}%`;
  }
}

// Helper color function
function getFamilyGlowColor(family) {
  if (family === 'Fresh') return '#40e0d0';
  if (family === 'Floral') return '#ffb6c1';
  if (family === 'Woody') return '#90ee90';
  if (family === 'Amber') return '#ff8c00';
  return '#c5a880';
}

// --- Shopping Bag (Vanity Cart) Logic ---
let cart = [];

function addToCart(perfume) {
  if (cart.some(item => item.id === perfume.id)) {
    alert(`"${perfume.name}" is already inside your Vanity Collection.`);
    return;
  }
  
  const priceVal = perfume.tier === 'Niche' ? (285 + (perfume.id % 7) * 10) : (135 + (perfume.id % 5) * 10);
  
  cart.push({
    ...perfume,
    price: priceVal
  });
  
  updateCartUI();
  
  // Bounce the cart button visually
  const cartBtn = document.getElementById('btn-open-cart');
  cartBtn.classList.add('pulse');
  setTimeout(() => cartBtn.classList.remove('pulse'), 500);
}

function removeFromCart(perfumeId) {
  cart = cart.filter(item => item.id !== perfumeId);
  updateCartUI();
}

function updateCartUI() {
  const countBadge = document.getElementById('cart-count');
  countBadge.innerText = cart.length;
  
  const listContainer = document.getElementById('cart-items-list');
  const footer = document.getElementById('cart-footer');
  const totalPriceLabel = document.getElementById('cart-total-price');
  
  if (cart.length === 0) {
    listContainer.innerHTML = `
      <div class="cart-empty-state">
        <p>Your bag is empty.</p>
        <p class="sub">Select a perfume to add to your collection.</p>
      </div>
    `;
    footer.style.display = 'none';
  } else {
    listContainer.innerHTML = '';
    let total = 0;
    
    cart.forEach(item => {
      total += item.price;
      const itemEl = document.createElement('div');
      itemEl.className = 'cart-item';
      itemEl.innerHTML = `
        <img class="cart-item-img" src="${item.image}" alt="${item.name}">
        <div class="cart-item-details">
          <span class="cart-item-brand">${item.brand}</span>
          <span class="cart-item-name">${item.name}</span>
          <span class="cart-item-price">$${item.price}</span>
        </div>
        <button class="cart-item-remove-btn" data-id="${item.id}" title="Remove Scent">
          <i data-lucide="trash-2"></i>
        </button>
      `;
      
      // Wire up remove button click
      itemEl.querySelector('.cart-item-remove-btn').addEventListener('click', () => {
        removeFromCart(item.id);
      });
      
      listContainer.appendChild(itemEl);
    });
    
    totalPriceLabel.innerText = `$${total}`;
    footer.style.display = 'block';
  }
  
  lucide.createIcons();
}

// --- Bind Interactive UI Event Listeners ---
function bindUIEvents() {
  // Start Consultation Trigger Button
  document.getElementById('btn-open-consultation').addEventListener('click', () => {
    document.getElementById('btn-open-consultation').style.display = 'none';
    document.getElementById('panel-quiz').classList.add('active');
    
    // Save camera state for restoring
    preInspectCameraState.position.copy(camera.position);
    preInspectCameraState.target.copy(controls.target);
    
    // Animate camera to perfect consultation focus
    controls.enabled = false;
    new TWEEN.Tween(camera.position)
      .to({ x: 0, y: 0, z: 700 }, 1000)
      .easing(TWEEN.Easing.Cubic.Out)
      .start();
    new TWEEN.Tween(controls.target)
      .to({ x: 0, y: 0, z: 0 }, 1000)
      .easing(TWEEN.Easing.Cubic.Out)
      .onComplete(() => {
        controls.enabled = true;
      })
      .start();
      
    currentQuestionIndex = 0;
    userAnswers = {};
    currentBranch = null;
    renderQuestion(); 
    calculateCompatibility();
    updateCardVisuals3D();
  });

  // Close Scent Consultation (Exit quiz back to orbit)
  document.getElementById('btn-close-quiz').addEventListener('click', () => {
    document.getElementById('panel-quiz').classList.remove('active');
    document.getElementById('btn-open-consultation').style.display = 'block';
    restoreCameraAfterInspection();
    calculateCompatibility();
    updateCardVisuals3D();
  });

  // Quiz Navigation
  const prevBtn = document.getElementById('btn-quiz-prev');
  const nextBtn = document.getElementById('btn-quiz-next');
  
  prevBtn.addEventListener('click', () => {
    if (currentQuestionIndex > 0) {
      currentQuestionIndex--;
      // If we go back to the first question, reset the branch path selection
      if (currentQuestionIndex === 0) {
        currentBranch = null;
        userAnswers = {};
      }
      renderQuestion();
      calculateCompatibility();
      updateCardVisuals3D();
    }
  });
  
  nextBtn.addEventListener('click', () => {
    advanceFlow();
  });
  
  // View Matches (Reveal Screen) → show full 2D results grid
  document.getElementById('btn-view-matches').addEventListener('click', () => {
    isConsultationComplete = true;
    calculateCompatibility();
    document.getElementById('panel-reveal').classList.remove('active');
    document.getElementById('panel-quiz').classList.remove('active');
    document.getElementById('btn-global-reset').style.display = 'block';
    showResultsScreen();
  });

  // Global Reset link
  document.getElementById('btn-global-reset').addEventListener('click', () => {
    resetQuizState();
  });
  
  // Results screen reset button
  document.getElementById('btn-results-reset').addEventListener('click', () => {
    resetQuizState();
  });
  
  // Layout Toggles
  const sphereLayoutBtn = document.getElementById('btn-layout-sphere');
  const gridLayoutBtn = document.getElementById('btn-layout-grid');
  
  sphereLayoutBtn.addEventListener('click', () => {
    sphereLayoutBtn.classList.add('active');
    gridLayoutBtn.classList.remove('active');
    transformLayout('sphere');
  });
  
  gridLayoutBtn.addEventListener('click', () => {
    gridLayoutBtn.classList.add('active');
    sphereLayoutBtn.classList.remove('active');
    transformLayout('grid');
  });
  
  // Drawers Open / Close listeners
  
  // Product Drawer Close
  document.getElementById('btn-close-drawer').addEventListener('click', () => {
    document.getElementById('product-drawer').classList.remove('active');
    restoreCameraAfterInspection();
  });
  
  // Shopping Cart Open
  document.getElementById('btn-open-cart').addEventListener('click', () => {
    document.getElementById('cart-drawer').classList.add('active');
  });
  
  // Shopping Cart Close
  document.getElementById('btn-close-cart-drawer').addEventListener('click', () => {
    document.getElementById('cart-drawer').classList.remove('active');
  });
  
  // Add to Bag CTA
  document.getElementById('btn-add-to-bag').addEventListener('click', () => {
    const drawer = document.getElementById('product-drawer');
    const perfumeId = drawer.getAttribute('data-active-perfume-id');
    const perfume = fragrances.find(p => p.id == perfumeId);
    if (perfume) {
      addToCart(perfume);
      // Visual feedback: slide close product drawer & slide open cart drawer!
      drawer.classList.remove('active');
      setTimeout(() => {
        document.getElementById('cart-drawer').classList.add('active');
      }, 300);
    }
  });
  
  // Checkout CTA
  document.querySelector('.btn-checkout').addEventListener('click', () => {
    alert("Vanity signature acquired! Commencing packaging ritual with hand-melted gold wax sealing...");
    cart = [];
    updateCartUI();
    document.getElementById('cart-drawer').classList.remove('active');
  });
}
