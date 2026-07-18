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
    text: "Welcome to the Kaggle-powered Aether & Scent Engine. Let's begin by selecting a primary scent family based on dominant accords:",
    type: "choice",
    options: [
      { text: "Fresh, Citrus, & Aquatic Accords", value: "Fresh", desc: "Zesty, marine, and uplifting profiles" },
      { text: "Floral, Rose, & White Floral Accords", value: "Floral", desc: "Romantic, delicate, and blooming profiles" },
      { text: "Woody, Earthy, & Leather Accords", value: "Woody", desc: "Dry, sophisticated, and grounded profiles" },
      { text: "Amber, Warm Spicy, & Sweet Vanilla Accords", value: "Amber", desc: "Mysterious, rich, and exotic profiles" }
    ],
    scoreFn: (perfume, val) => (perfume.scentFamily === val ? 1.0 : 0.0)
  },
  {
    id: "gender",
    text: "How would you prefer the gender leaning of this fragrance?",
    type: "choice",
    options: [
      { text: "Distinctly Masculine", value: "Masculine", desc: "Bold, traditional male profiles" },
      { text: "Distinctly Feminine", value: "Feminine", desc: "Elegant, traditional female profiles" },
      { text: "Perfectly Unisex", value: "Unisex", desc: "Shared, balanced for anyone" }
    ],
    scoreFn: (perfume, val) => {
      if (perfume.gender === val) return 1.0;
      if (perfume.gender === 'Unisex') return 0.7; // Unisex is a safe fallback
      return 0.2; // Strong mismatch
    }
  }
];

const branches = {
  Fresh: [
    {
      id: "freshAccord",
      text: "Freshness has many faces. Which aromatic profile speaks to your style?",
      type: "choice",
      options: [
        { text: "Zesty lemon and sparkling citruses", value: "citrus", desc: "Bright, sparking, and uplifting" },
        { text: "Crisp ocean waves and aquatic breeze", value: "aquatic", desc: "Aqueous, breezy, and cool" }
      ],
      scoreFn: (perfume, val) => {
        // Checking the accords 1 to 5
        const matches = perfume.accords.some(a => a.toLowerCase().includes(val) || a.toLowerCase().includes('marine'));
        return matches ? 1.0 : 0.3;
      }
    },
    {
      id: "tier",
      text: "Do you prefer widespread classics or exclusive artistry?",
      type: "choice",
      options: [
        { text: "Designer Classics", value: "Designer", desc: "Renowned luxury fashion houses" },
        { text: "Niche Artistry", value: "Niche", desc: "Exclusive, avant-garde perfume houses" }
      ],
      scoreFn: (perfume, val) => (perfume.tier === val ? 1.0 : 0.5)
    }
  ],
  Floral: [
    {
      id: "floralAccord",
      text: "Floral essences carry deep emotional range. What kind of blossom matches your aura?",
      type: "choice",
      options: [
        { text: "Classic rose and elegant petals", value: "rose", desc: "Romantic, timeless, and delicate" },
        { text: "Intense white florals like jasmine & tuberose", value: "white floral", desc: "Intense, mysterious, and opulent" }
      ],
      scoreFn: (perfume, val) => {
        const matches = perfume.accords.some(a => a.toLowerCase().includes(val));
        return matches ? 1.0 : 0.3;
      }
    },
    {
      id: "tier",
      text: "Do you prefer widespread classics or exclusive artistry?",
      type: "choice",
      options: [
        { text: "Designer Classics", value: "Designer", desc: "Renowned luxury fashion houses" },
        { text: "Niche Artistry", value: "Niche", desc: "Exclusive, avant-garde perfume houses" }
      ],
      scoreFn: (perfume, val) => (perfume.tier === val ? 1.0 : 0.5)
    }
  ],
  Woody: [
    {
      id: "woodAccord",
      text: "A choice of profound substance. Which wood profile represents your character?",
      type: "choice",
      options: [
        { text: "Earthy, green, and mossy", value: "earthy", desc: "Fresh, damp, and grounded" },
        { text: "Dark, smoky oud & rich woods", value: "woody", desc: "Intense, deep, and mysterious" }
      ],
      scoreFn: (perfume, val) => {
        const matches = perfume.accords.some(a => a.toLowerCase().includes(val) || (val === 'woody' && a.toLowerCase().includes('oud')));
        return matches ? 1.0 : 0.3;
      }
    },
    {
      id: "tier",
      text: "Do you prefer widespread classics or exclusive artistry?",
      type: "choice",
      options: [
        { text: "Designer Classics", value: "Designer", desc: "Renowned luxury fashion houses" },
        { text: "Niche Artistry", value: "Niche", desc: "Exclusive, avant-garde perfume houses" }
      ],
      scoreFn: (perfume, val) => (perfume.tier === val ? 1.0 : 0.5)
    }
  ],
  Amber: [
    {
      id: "amberAccord",
      text: "Exotic and enveloping. Which facet of the East calls to you?",
      type: "choice",
      options: [
        { text: "Warm vanilla & sweet resins", value: "vanilla", desc: "Cozy, delicious, and inviting" },
        { text: "Warm spices & smoky incense", value: "warm spicy", desc: "Bold, exotic, and magnetic" }
      ],
      scoreFn: (perfume, val) => {
        const matches = perfume.accords.some(a => a.toLowerCase().includes(val) || a.toLowerCase().includes('sweet'));
        return matches ? 1.0 : 0.3;
      }
    },
    {
      id: "tier",
      text: "Do you prefer widespread classics or exclusive artistry?",
      type: "choice",
      options: [
        { text: "Designer Classics", value: "Designer", desc: "Renowned luxury fashion houses" },
        { text: "Niche Artistry", value: "Niche", desc: "Exclusive, avant-garde perfume houses" }
      ],
      scoreFn: (perfume, val) => (perfume.tier === val ? 1.0 : 0.5)
    }
  ]
};

function getActiveQuestions() {
  if (!currentBranch) {
    return quizQuestions;
  }
  return [...quizQuestions, ...branches[currentBranch]];
}

// --- Initializer & Setup ---
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  try {
    const progress = document.getElementById('loader-progress');
    progress.style.width = '15%';
    
    // Apply weather theme
    await applyWeatherBackground();
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
  // Removed global mouseup handler; clicks are now handled directly on the CSS3DObject elements.
  
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 10;
  controls.maxDistance = 2500;
  
  window.addEventListener('resize', onWindowResize);
  animateLoop();
}

let resizeTimeout;
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    // Recalculate positions for responsive design
    sphereTargets = [];
    gridTargets = [];
    calculateSphereLayout();
    calculateGridLayout();
    
    // Tween smoothly to new positions
    if (activeLayout === 'sphere') {
      transform(sphereTargets, 800);
    } else if (activeLayout === 'grid') {
      transform(gridTargets, 800);
    }
  }, 250);
}

let lastFrameTime = 0;
const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const targetFPS = isTouchDevice ? 30 : 60;
const frameInterval = 1000 / targetFPS;

function animateLoop(timestamp) {
  requestAnimationFrame(animateLoop);
  
  // Throttle frame rate on mobile/tablet
  if (timestamp - lastFrameTime < frameInterval) return;
  lastFrameTime = timestamp;
  
  TWEEN.update();
  controls.update();
  
  // Continuous slow rotation in Sphere mode — DESKTOP ONLY
  if (!isTouchDevice && activeLayout === 'sphere' && !isInspectMode) {
    scene.rotation.y += 0.0006;
    scene.rotation.x += 0.0002;
  } else if (!isTouchDevice) {
    // Return scene rotation to neutral slowly when not in sphere
    scene.rotation.y += (0 - scene.rotation.y) * 0.05;
    scene.rotation.x += (0 - scene.rotation.x) * 0.05;
  }
  
  renderer.render(scene, camera);
}

// --- Background Gradient Helper ---
function getAccordGradient(accords) {
  const colorMap = {
    'citrus': 'rgba(230, 216, 117, 0.1)', 
    'fresh': 'rgba(163, 201, 183, 0.1)', 
    'marine': 'rgba(99, 160, 179, 0.1)', 
    'aquatic': 'rgba(99, 160, 179, 0.1)',
    'floral': 'rgba(217, 158, 189, 0.1)', 
    'rose': 'rgba(196, 90, 124, 0.1)', 
    'white floral': 'rgba(232, 230, 223, 0.1)', 
    'woody': 'rgba(133, 102, 81, 0.1)', 
    'earthy': 'rgba(96, 110, 87, 0.1)', 
    'patchouli': 'rgba(94, 78, 65, 0.1)', 
    'leather': 'rgba(66, 51, 41, 0.1)',
    'amber': 'rgba(194, 129, 58, 0.1)', 
    'vanilla': 'rgba(219, 204, 166, 0.1)', 
    'warm spicy': 'rgba(179, 93, 57, 0.1)', 
    'sweet': 'rgba(207, 169, 185, 0.1)',
    'musk': 'rgba(179, 168, 163, 0.1)', 
    'powdery': 'rgba(212, 199, 208, 0.1)'
  };
  
  let colors = [];
  accords.forEach(a => {
    const lower = a.toLowerCase();
    for (const [key, val] of Object.entries(colorMap)) {
      if (lower.includes(key) && !colors.includes(val) && colors.length < 3) {
        colors.push(val);
      }
    }
  });
  
  if (colors.length === 0) colors.push('rgba(30, 30, 35, 0.15)');
  if (colors.length === 1) colors.push('rgba(20, 20, 25, 0.15)');
  
  return `linear-gradient(135deg, ${colors[0]}, ${colors[1] || colors[0]})`;
}

// --- Create 3D CSS3DObject Card Elements ---
function createPerfumeCards() {
  fragrances.forEach((perfume) => {
    // Create card container
    const element = document.createElement('div');
    element.className = `perfume-card ${perfume.scentFamily}`;
    element.setAttribute('data-id', perfume.id);
    
    // Apply Dynamic Gradient
    element.style.background = getAccordGradient(perfume.accords);
    
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
    
    // Explicit pointer events to bypass OrbitControls interception
    let _cardDownX = 0, _cardDownY = 0;
    
    element.addEventListener('pointerdown', (e) => {
      _cardDownX = e.clientX;
      _cardDownY = e.clientY;
      // Stop OrbitControls from hijacking the pointer when clicking directly on a card
      e.stopPropagation();
    });
    
    element.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      // Ensure this was a click, not a drag on the card itself
      if (Math.hypot(e.clientX - _cardDownX, e.clientY - _cardDownY) < 6) {
        if (element.style.pointerEvents !== 'none' && !element.classList.contains('faded')) {
          inspectCard(perfume.id);
        }
      }
    });

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
  // Dynamic radius for responsive mobile sizing
  const isMobile = window.innerWidth <= 768;
  const isTablet = window.innerWidth <= 1024 && !isMobile;
  let radius = 1200;
  if (isTablet) radius = 900;
  if (isMobile) radius = 550;
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
    // Point the front face (+Z) towards the origin so it's not mirrored from the inside
    tempObj.lookAt(0, 0, 0);
    
    sphereTargets.push({
      position: position,
      rotation: tempObj.rotation.clone()
    });
  }
}

// B. Clean Flat Grid Wall Layout
function calculateGridLayout() {
  const N = fragrances.length;
  const isMobile = window.innerWidth <= 768;
  const isTablet = window.innerWidth <= 1024 && !isMobile;
  
  let cols = 10;
  if (isTablet) cols = 6;
  if (isMobile) cols = 4;
  
  const spacingX = isMobile ? 180 : 260; // Tighter on mobile
  const spacingY = isMobile ? 260 : 320; 
  
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
    const aspect = window.innerWidth / window.innerHeight;
    let gridZ = 1800;
    if (aspect < 1.0) {
      gridZ = 1800 / Math.max(aspect, 0.5); // Push camera back on portrait, max distance 3600
    }
    targetCamPos = { x: 0, y: 0, z: gridZ }; // Zoomed back to frame wide grid
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
  document.querySelector('.explore-search-container').style.display = 'block';
  
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
    
    // Apply Active Search Filter (if user started consultation from a search)
    const searchInputStr = document.getElementById('explore-search').value.toLowerCase().trim();
    if (searchInputStr) {
       const match = perfume.name.toLowerCase().includes(searchInputStr) || 
                     perfume.brand.toLowerCase().includes(searchInputStr) || 
                     perfume.scentFamily.toLowerCase().includes(searchInputStr) ||
                     perfume.topNotes.some(n => n.toLowerCase().includes(searchInputStr)) ||
                     perfume.middleNotes.some(n => n.toLowerCase().includes(searchInputStr)) ||
                     perfume.baseNotes.some(n => n.toLowerCase().includes(searchInputStr)) ||
                     perfume.accords.some(n => n.toLowerCase().includes(searchInputStr));
       if (!match) {
         score = 0; // Exclude entirely if it doesn't match the search
       }
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
          
          // Animate cards into a neat foreground semi-circular arc
          const rank = top5Ids.indexOf(perfume.id);
          const angle = (rank - 2) * 0.35; // Horizontally spaced arc
          
          const aspect = window.innerWidth / window.innerHeight;
          let consultZ = 950;
          if (aspect < 1.0) { consultZ = 950 / Math.max(aspect, 0.45); }
          
          const offsetX = window.innerWidth > 1024 ? -250 : 0; // Camera shift only on desktop
          const targetZ = 200 - (Math.cos(angle) * 60);
          
          // Perspective correct center:
          const depthRatio = (consultZ - targetZ) / consultZ;
          const visualCenterX = offsetX + Math.abs(offsetX) * depthRatio;
          
          // Keep physical spread at 450 so cards fan out elegantly with slight overlap
          const targetX = visualCenterX + Math.sin(angle) * 450; 
          const targetY = (rank % 2 === 0 ? 30 : -30); // Soft vertical wave offset
          
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
  
  // Explore Search Logic
  const searchInput = document.getElementById('explore-search');
  const searchClearBtn = document.getElementById('search-clear-btn');
  
  function handleSearch() {
    const q = searchInput.value.toLowerCase().trim();
    if (q.length > 0) {
      searchClearBtn.style.display = 'block';
    } else {
      searchClearBtn.style.display = 'none';
    }
    
    // Check if consultation is active; if it is, search shouldn't override quiz highlights
    if (document.getElementById('panel-quiz').classList.contains('active')) return;
    
    cardObjects.forEach((object, index) => {
      const perfume = fragrances[index];
      const match = !q || 
                    perfume.name.toLowerCase().includes(q) || 
                    perfume.brand.toLowerCase().includes(q) || 
                    perfume.scentFamily.toLowerCase().includes(q) ||
                    perfume.topNotes.some(n => n.toLowerCase().includes(q)) ||
                    perfume.middleNotes.some(n => n.toLowerCase().includes(q)) ||
                    perfume.baseNotes.some(n => n.toLowerCase().includes(q)) ||
                    perfume.accords.some(n => n.toLowerCase().includes(q));
      
      if (match) {
        object.element.classList.remove('faded');
        object.element.style.pointerEvents = '';
      } else {
        object.element.classList.add('faded');
        object.element.style.pointerEvents = 'none';
      }
    });
  }

  searchInput.addEventListener('input', handleSearch);
  
  searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    handleSearch();
  });

  // Start Consultation Trigger Button
  document.getElementById('btn-open-consultation').addEventListener('click', () => {
    document.querySelector('.explore-search-container').style.display = 'none';
    document.getElementById('panel-quiz').classList.add('active');
    
    // Save camera state for restoring
    preInspectCameraState.position.copy(camera.position);
    preInspectCameraState.target.copy(controls.target);
    
    // Animate camera to accommodate the left sidebar (on desktop) or bottom drawer (on tablet)
    controls.enabled = false;
    const aspect = window.innerWidth / window.innerHeight;
    let consultZ = 950;
    if (aspect < 1.0) { consultZ = 950 / Math.max(aspect, 0.45); }
    
    const offsetX = window.innerWidth > 1024 ? -250 : 0; // Shift camera left only on desktop
    new TWEEN.Tween(camera.position)
      .to({ x: offsetX, y: 0, z: consultZ }, 1000)
      .easing(TWEEN.Easing.Cubic.Out)
      .start();
    new TWEEN.Tween(controls.target)
      .to({ x: offsetX, y: 0, z: 0 }, 1000)
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
    document.querySelector('.explore-search-container').style.display = 'flex';
    
    // Clear search on exit so the full explore view resets
    searchInput.value = '';
    searchClearBtn.style.display = 'none';
    
    restoreCameraAfterInspection();
    calculateCompatibility();
    updateCardVisuals3D();
    
    // Re-apply any search filter (which is now empty)
    handleSearch();
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
  const checkoutBtn = document.querySelector('.btn-checkout');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      alert("Vanity signature acquired! Commencing packaging ritual with hand-melted gold wax sealing...");
      cart = [];
      updateCartUI();
      document.getElementById('cart-drawer').classList.remove('active');
    });
  }

  // Add Swipe-To-Dismiss for mobile bottom drawers
  addSwipeToDismiss('product-drawer', () => document.getElementById('product-drawer').classList.remove('active'));
  addSwipeToDismiss('cart-drawer', () => document.getElementById('cart-drawer').classList.remove('active'));
  
  // Quiz: on mobile, swipe the parent sidebar-wizard panel, not the inner card
  const quizPanel = document.getElementById('panel-quiz');
  if (quizPanel) {
    addSwipeToDismiss('panel-quiz', () => {
      document.getElementById('btn-close-quiz').click(); // Properly triggers full cleanup
    });
  }
}

// --- Mobile Touch Gestures ---
function addSwipeToDismiss(elementId, closeAction) {
  const el = document.getElementById(elementId);
  if (!el) return;
  
  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  
  el.addEventListener('touchstart', (e) => {
    if (window.innerWidth > 1024) return;
    
    // Prevent swipe-to-dismiss if the user is scrolling inside a scrollable body
    const scrollable = el.querySelector('.drawer-body');
    if (scrollable && scrollable.scrollTop > 5) return;
    
    startY = e.touches[0].clientY;
    currentY = startY; // FIX: Reset currentY on new touch!
    isDragging = true;
    el.style.transition = 'none';
  }, { passive: true });
  
  el.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;
    if (deltaY > 0) { // Only swipe down
      el.style.transform = `translateY(${deltaY}px)`;
    }
  }, { passive: true });
  
  el.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    el.style.transition = ''; // restore CSS transitions
    
    const deltaY = currentY - startY;
    el.style.transform = ''; // Clear inline transform
    
    if (deltaY > 120) {
      closeAction();
    }
  });
}

// --- Weather Background System ---
function applyWeatherBackground() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,is_day`);
        const data = await res.json();
        
        if (data && data.current) {
          const code = data.current.weather_code;
          const isDay = data.current.is_day;
          
          let gradient = 'linear-gradient(135deg, #0a0a0f, #1a1a24)'; // default dark
          
          // WMO Weather codes → dark luxury-appropriate gradients
          if (code === 0 || code === 1) { // Clear
             gradient = isDay 
               ? 'linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #122a45 100%)' 
               : 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)';
          } else if (code === 2 || code === 3) { // Cloudy
             gradient = isDay 
               ? 'linear-gradient(135deg, #1a1e2e 0%, #2a2f42 100%)' 
               : 'linear-gradient(135deg, #141e30 0%, #243b55 100%)';
          } else if (code >= 45 && code <= 48) { // Fog
             gradient = 'linear-gradient(135deg, #1c1f2e 0%, #2d3040 100%)';
          } else if (code >= 51 && code <= 67) { // Rain
             gradient = 'linear-gradient(135deg, #1a2a3a 0%, #1e2340 100%)';
          } else if (code >= 71 && code <= 77) { // Snow
             gradient = 'linear-gradient(135deg, #1a1e2e 0%, #2a3040 100%)';
          } else if (code >= 95) { // Thunderstorm
             gradient = 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)';
          }
          
          document.body.style.background = gradient;
        }
      } catch (err) {
        console.error("Failed to fetch weather for background:", err);
      }
    }, (err) => {
      console.warn("Geolocation denied or failed, using default background.");
    });
  }
}
