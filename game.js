/**
 * JAIS Escape! - Main Game Engine
 * 
 * Manages game loop, player physics, background parallax scrolling,
 * obstacles spawning, collision detection, power-ups, meme events, 
 * character unlocks, and victory cutscene.
 */

const Game = {
  // Game states
  States: { MENU: 0, PLAYING: 1, GAMEOVER: 2, VICTORY: 3 },
  currentState: 0, // MENU by default

  // Canvas context
  canvas: null,
  ctx: null,

  // Loop & timing
  lastTime: 0,
  score: 0,
  highScore: 0,
  coconutsCollected: 0,
  nasiLemakCollected: 0,
  timePlayed: 0, // in seconds
  gameSpeed: 5,
  baseSpeed: 5,
  maxSpeed: 12,
  distanceToGoal: 5000, // Victory at 5000 score
  
  // Game entities
  player: null,
  jaisCar: null,
  obstacles: [],
  collectibles: [],
  particles: [],
  backgroundLayers: [],

  // Character selection
  selectedCharId: 'adudu',
  unlockedChars: ['adudu'],

  // Game Systems
  spawnerTimer: 0,
  spawnerInterval: 1800, // ms
  memeTimer: 0,
  activeMemeEvent: null, // 'rain', 'durian', 'kenduri', 'slippers'
  memeEventTimeLeft: 0,
  bossStageActive: false,
  bossStageTimer: 0,
  nextBossMilestone: 1000,
  warningTimer: 0,

  // Input states
  keys: {},
  touchControlsActive: false,

  // Cutscene management
  cutsceneStep: 0,
  cutsceneTimer: 0,
  cutsceneEntities: {},

  init() {
    console.log("Initializing Game Engine...");
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Set rendering style for pixel art
    this.ctx.imageSmoothingEnabled = false;

    // Load High Score and Unlocks
    this.loadSaveData();

    // Initialize Sprites
    Sprites.init();

    // Setup entities
    this.initBackgrounds();
    this.resetPlayer();
    this.resetJAIS();

    // Bind event listeners
    this.bindInputs();
    this.bindUI();

    // Setup dynamic scaling for mobile
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    // Populate Character Grid in UI
    this.populateCharacterGrid();

    // Draw initial menu state
    this.currentState = this.States.MENU;
    this.updateUI();

    // Draw menu frame
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  },

  loadSaveData() {
    this.highScore = parseInt(localStorage.getItem('jais_escape_highscore')) || 0;
    
    const savedUnlocks = localStorage.getItem('jais_escape_unlocks');
    if (savedUnlocks) {
      try {
        this.unlockedChars = JSON.parse(savedUnlocks);
      } catch(e) {
        this.unlockedChars = ['adudu'];
      }
    }
    
    // Ensure default is always unlocked
    if (!this.unlockedChars.includes('adudu')) {
      this.unlockedChars.push('adudu');
    }

    // Update character template lock statuses
    for (const id in Sprites.charTemplates) {
      if (this.unlockedChars.includes(id)) {
        Sprites.charTemplates[id].unlocked = true;
      }
    }
  },

  saveGameData() {
    localStorage.setItem('jais_escape_highscore', this.highScore);
    localStorage.setItem('jais_escape_unlocks', JSON.stringify(this.unlockedChars));
  },

  resetPlayer() {
    const template = Sprites.charTemplates[this.selectedCharId];
    
    // Check starting lives (Pak Cik Basikal starts with 4 lives)
    let startLives = 3;
    if (this.selectedCharId === 'pakcik') {
      startLives = 4;
    }

    this.player = {
      id: this.selectedCharId,
      name: template.name,
      ability: template.ability,
      x: 200,
      y: 420, // Ground level feet position
      width: 48,  // Scaled display width
      height: 64, // Scaled display height
      vy: 0,
      vx: 0,
      gravity: 0.6,
      jumpForce: this.selectedCharId === 'uncle' ? -15.4 : -14, // Uncle Kopiah jumps higher
      isGrounded: true,
      
      // Animations
      animFrame: 0,
      animTimer: 0,

      // Lives
      lives: startLives,
      maxLives: startLives,

      // Power-up durations (in frames)
      dashCooldown: 0,
      dashCooldownMax: this.selectedCharId === 'worker' ? 90 : 180, // Office worker 1.5s (90 frames), others 3s (180 frames)
      dashTime: 0,
      
      // Active states
      activePowerup: null, // 'songkok', 'bike', 'shield', 'tehtarik'
      powerupTimeLeft: 0,
      invulnerableTime: 0, // Flashing state
      stunTime: 0
    };
  },

  resetJAIS() {
    this.jaisCar = {
      x: -100,
      y: 400,
      width: 96,
      height: 48,
      distance: 70, // 0 (caught) to 100 (far away)
      animTimer: 0,
      sirenOn: true
    };
  },

  initBackgrounds() {
    // Parallax layers config
    // We will draw simple programmatic shapes on these layers
    this.backgroundLayers = [
      { speedFactor: 0.05, draw: (ctx, x) => this.drawSkyline(ctx, x) },
      { speedFactor: 0.2, draw: (ctx, x) => this.drawMidground(ctx, x) },
      { speedFactor: 0.6, draw: (ctx, x) => this.drawForeground(ctx, x) },
      { speedFactor: 1.0, draw: (ctx, x) => this.drawRoad(ctx, x) }
    ];
  },

  // Sequentially change background layers depending on score
  getCurrentZone() {
    const zones = [
      { name: "Kampung Road", color: "#10b981", sky: "#bae6fd" },
      { name: "Shah Alam Roundabout", color: "#3b82f6", sky: "#c7d2fe" },
      { name: "Mamak Stall", color: "#fbbf24", sky: "#fef3c7" },
      { name: "Pasar Malam", color: "#ec4899", sky: "#fbcfe8" },
      { name: "LRT Station", color: "#8b5cf6", sky: "#ddd6fe" },
      { name: "Paddy Field", color: "#10b981", sky: "#ccfbf1" },
      { name: "Rainy Neighborhood", color: "#6b7280", sky: "#cbd5e1" }
    ];
    // Rotate every 750 points
    const index = Math.floor(this.score / 750) % zones.length;
    return zones[index];
  },

  bindInputs() {
    // Keyboard inputs
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      
      // Handle Jump key down
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.currentState === this.States.PLAYING) {
          this.triggerJump();
        }
      }
      
      // Handle Dash key down
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        e.preventDefault();
        if (this.currentState === this.States.PLAYING) {
          this.triggerDash();
        }
      }

      // DEV CHEAT KEY: Press 'V' to get 4950 points (near victory)
      if ((e.key === 'v' || e.key === 'V') && this.currentState === this.States.PLAYING) {
        this.score = 4950;
        this.spawnFloatingText(this.player.x, this.player.y - 40, "CHEAT ACTIVATE!", "#f59e0b");
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Mobile Virtual Touch Buttons
    const bindTouch = (id, actionDown, actionUp) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        actionDown();
      });
      btn.addEventListener('mouseup', (e) => {
        e.preventDefault();
        if (actionUp) actionUp();
      });
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.touchControlsActive = true;
        actionDown();
      });
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (actionUp) actionUp();
      });
    };

    bindTouch('btn-touch-left', () => { this.keys['ArrowLeft'] = true; }, () => { this.keys['ArrowLeft'] = false; });
    bindTouch('btn-touch-right', () => { this.keys['ArrowRight'] = true; }, () => { this.keys['ArrowRight'] = false; });
    bindTouch('btn-touch-jump', () => { this.triggerJump(); });
    bindTouch('btn-touch-dash', () => { this.triggerDash(); });
  },

  bindUI() {
    const playSelect = () => GameAudio.playSelect();
    const playHover = () => GameAudio.playHover();

    document.getElementById('btn-play').addEventListener('click', () => {
      playSelect();
      this.startRun();
    });
    document.getElementById('btn-play').addEventListener('mouseenter', playHover);

    document.getElementById('btn-select-char').addEventListener('click', () => {
      playSelect();
      this.currentState = this.States.MENU;
      document.getElementById('start-screen').classList.add('hidden');
      document.getElementById('char-select-screen').classList.remove('hidden');
    });
    document.getElementById('btn-select-char').addEventListener('mouseenter', playHover);

    document.getElementById('btn-char-back').addEventListener('click', () => {
      playSelect();
      document.getElementById('char-select-screen').classList.add('hidden');
      document.getElementById('start-screen').classList.remove('hidden');
    });
    document.getElementById('btn-char-back').addEventListener('mouseenter', playHover);

    document.getElementById('btn-retry').addEventListener('click', () => {
      playSelect();
      this.startRun();
    });
    document.getElementById('btn-retry').addEventListener('mouseenter', playHover);

    document.getElementById('btn-go-menu').addEventListener('click', () => {
      playSelect();
      this.currentState = this.States.MENU;
      this.updateUI();
    });
    document.getElementById('btn-go-menu').addEventListener('mouseenter', playHover);

    document.getElementById('btn-victory-menu').addEventListener('click', () => {
      playSelect();
      this.currentState = this.States.MENU;
      this.updateUI();
    });
    document.getElementById('btn-victory-menu').addEventListener('mouseenter', playHover);

    // Cutscene text progress click
    document.getElementById('cutscene-dialogue-box').addEventListener('click', () => {
      playSelect();
      this.advanceCutscene();
    });
  },

  populateCharacterGrid() {
    const grid = document.getElementById('character-grid');
    grid.innerHTML = '';

    for (const [id, char] of Object.entries(Sprites.charTemplates)) {
      const card = document.createElement('div');
      card.className = `char-card ${char.unlocked ? '' : 'locked'} ${this.selectedCharId === id ? 'selected' : ''}`;
      card.dataset.id = id;

      // Draw character preview on card's canvas
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      // We draw the player standing frame on the card
      const spriteCanvas = Sprites.players[id].standing;
      ctx.drawImage(spriteCanvas, 0, 0, spriteCanvas.width, spriteCanvas.height, 8, 0, 48, 64);

      card.appendChild(canvas);

      const name = document.createElement('div');
      name.className = 'char-name';
      name.innerText = char.name;
      card.appendChild(name);

      const ability = document.createElement('div');
      ability.className = 'char-ability';
      ability.innerText = char.ability;
      card.appendChild(ability);

      if (!char.unlocked) {
        const lockInfo = document.createElement('div');
        lockInfo.className = 'lock-info';
        lockInfo.innerText = char.unlockText;
        card.appendChild(lockInfo);
      }

      card.addEventListener('mouseenter', () => {
        if (char.unlocked) GameAudio.playHover();
      });

      card.addEventListener('click', () => {
        if (char.unlocked) {
          GameAudio.playSelect();
          this.selectedCharId = id;
          
          // Update selected classes in DOM
          document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');

          // Update menu preview
          this.updateMenuPreview();
        } else {
          // Play a small buzzer or hit sound
          GameAudio.playHit();
        }
      });

      grid.appendChild(card);
    }
  },

  updateMenuPreview() {
    const previewCanvas = document.getElementById('menu-char-preview');
    const ctx = previewCanvas.getContext('2d');
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    ctx.imageSmoothingEnabled = false;

    const sprite = Sprites.players[this.selectedCharId].standing;
    ctx.drawImage(sprite, 0, 0, sprite.width, sprite.height, 16, 16, 64, 80);

    const template = Sprites.charTemplates[this.selectedCharId];
    document.getElementById('menu-char-name').innerText = template.name;
    document.getElementById('menu-char-ability').innerText = template.ability;
  },

  startRun() {
    console.log("Starting run...");
    this.score = 0;
    this.coconutsCollected = 0;
    this.nasiLemakCollected = 0;
    this.timePlayed = 0;
    this.gameSpeed = this.baseSpeed;
    this.obstacles = [];
    this.collectibles = [];
    this.particles = [];
    this.activeMemeEvent = null;
    this.memeEventTimeLeft = 0;
    this.bossStageActive = false;
    this.bossStageTimer = 0;
    this.nextBossMilestone = 1000;
    this.memeTimer = 0;
    this.spawnerTimer = 0;
    
    this.resetPlayer();
    this.resetJAIS();
    
    // Hide screens, show HUD
    this.currentState = this.States.PLAYING;
    this.updateUI();

    // Start background music
    GameAudio.startMusic();
    GameAudio.setMusicSpeed(false);
  },

  updateUI() {
    // Hide all overlays initially
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('char-select-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('victory-screen').classList.add('hidden');
    document.getElementById('game-hud').classList.add('hidden');
    document.getElementById('mobile-controls').classList.add('hidden');

    if (this.currentState === this.States.MENU) {
      document.getElementById('start-screen').classList.remove('hidden');
      this.updateMenuPreview();
    } 
    else if (this.currentState === this.States.PLAYING) {
      document.getElementById('game-hud').classList.remove('hidden');
      // Show mobile controls on mobile
      if (this.touchControlsActive || ('ontouchstart' in window)) {
        document.getElementById('mobile-controls').classList.remove('hidden');
      }
    } 
    else if (this.currentState === this.States.GAMEOVER) {
      document.getElementById('game-over-screen').classList.remove('hidden');
      
      // Update score and stats
      document.getElementById('go-score').innerText = String(Math.floor(this.score)).padStart(5, '0');
      document.getElementById('go-nasilemak').innerText = this.nasiLemakCollected;
      document.getElementById('go-coconuts').innerText = this.coconutsCollected;
      document.getElementById('go-time').innerText = `${Math.floor(this.timePlayed)}s`;

      // Save highscore
      if (this.score > this.highScore) {
        this.highScore = Math.floor(this.score);
        this.checkUnlocks();
        this.saveGameData();
        this.populateCharacterGrid();
      }
    } 
    else if (this.currentState === this.States.VICTORY) {
      document.getElementById('victory-screen').classList.remove('hidden');
      document.getElementById('credits-panel').classList.add('hidden');
      document.getElementById('cutscene-dialogue-box').classList.remove('hidden');
      
      // Unlock all secret characters for winning!
      for (const id in Sprites.charTemplates) {
        if (!this.unlockedChars.includes(id)) {
          this.unlockedChars.push(id);
          Sprites.charTemplates[id].unlocked = true;
        }
      }
      this.saveGameData();
      this.populateCharacterGrid();
    }
  },

  checkUnlocks() {
    const milestones = [
      { id: 'uncle', score: 500 },
      { id: 'tourist', score: 1000 },
      { id: 'panda', score: 1500 },
      { id: 'pakcik', score: 2000 },
      { id: 'worker', score: 3000 },
      { id: 'photographer', score: 4000 },
      { id: 'hagemaru', score: 5000 }
    ];

    milestones.forEach(m => {
      if (this.highScore >= m.score && !this.unlockedChars.includes(m.id)) {
        this.unlockedChars.push(m.id);
        Sprites.charTemplates[m.id].unlocked = true;
        console.log(`Unlocked character: ${m.id}`);
      }
    });
  },

  triggerJump() {
    if (this.player.isGrounded && this.player.stunTime <= 0) {
      this.player.vy = this.player.jumpForce;
      this.player.isGrounded = false;
      GameAudio.playJump();
      
      // Spawn dust clouds
      this.spawnDust(this.player.x, this.player.y, 4);
    }
  },

  triggerDash() {
    if (this.player.dashCooldown <= 0 && this.player.stunTime <= 0) {
      const isHagemaru = this.player.id === 'hagemaru';
      this.player.dashTime = isHagemaru ? 50 : 25; // Double dash duration for Hagemaru Ura
      this.player.dashCooldown = this.player.dashCooldownMax;
      
      // Boost speed
      this.player.vx = 8;
      
      // Invulnerability flash
      this.player.invulnerableTime = isHagemaru ? 50 : 25;
      
      GameAudio.playJump(); // Dash whoosh
      
      // Dash dust smoke
      this.spawnDust(this.player.x, this.player.y - 15, 6);
    }
  },

  // Game Loop
  loop(timestamp) {
    const elapsed = timestamp - this.lastTime;
    this.lastTime = timestamp;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.currentState === this.States.MENU) {
      this.updateBackgrounds(16);
      this.drawBackgrounds();
    } 
    else if (this.currentState === this.States.PLAYING) {
      this.updateGame(elapsed);
      this.drawGame();
    } 
    else if (this.currentState === this.States.GAMEOVER) {
      this.drawGame(); // Show frozen screen in background
    } 
    else if (this.currentState === this.States.VICTORY) {
      this.updateCutscene(elapsed);
      this.drawCutscene();
    }

    requestAnimationFrame((t) => this.loop(t));
  },

  updateGame(elapsed) {
    // Increment timer & score
    this.timePlayed += elapsed / 1000;
    
    // Game speed slowly goes up
    if (!this.bossStageActive && this.player.activePowerup !== 'tehtarik' && this.player.activePowerup !== 'bike') {
      this.gameSpeed = Math.min(this.maxSpeed, this.baseSpeed + (this.score / 600));
    }

    // Tick score based on speed
    this.score += (this.gameSpeed * 0.05);

    // Check boss stage trigger
    if (this.score >= this.nextBossMilestone && !this.bossStageActive) {
      this.triggerBossStage();
    }

    // Handle active boss duration
    if (this.bossStageActive) {
      this.bossStageTimer -= elapsed;
      if (this.bossStageTimer <= 0) {
        this.endBossStage();
      }
    }

    // Check Victory trigger
    if (this.score >= this.distanceToGoal) {
      this.triggerVictory();
      return;
    }

    // Update Director Systems (Meme events)
    if (!this.bossStageActive) {
      this.updateMemeDirector(elapsed);
    }

    // Spawner logic
    this.spawnerTimer += elapsed;
    const interval = this.bossStageActive ? 800 : this.spawnerInterval - (this.gameSpeed * 50);
    if (this.spawnerTimer >= interval) {
      this.spawnItem();
      this.spawnerTimer = 0;
    }

    // Update game entities
    this.updateBackgrounds(elapsed);
    this.updatePlayer(elapsed);
    this.updateJAIS(elapsed);
    this.updateObstaclesAndCollectibles(elapsed);
    this.updateParticles(elapsed);

    // Check collisions
    this.checkCollisions();

    // Update HUD display values
    this.updateHUD();
  },

  drawGame() {
    this.drawBackgrounds();

    // Draw gaps (under entities)
    this.obstacles.forEach(o => {
      if (o.type === 'drain') o.draw(this.ctx);
    });

    // Draw collectibles & obstacles
    this.collectibles.forEach(c => c.draw(this.ctx));
    this.obstacles.forEach(o => {
      if (o.type !== 'drain') o.draw(this.ctx);
    });

    // Draw active meme overlays (Rain)
    if (this.activeMemeEvent === 'rain') {
      this.drawRainEffect();
    }

    // Draw particles
    this.particles.forEach(p => p.draw(this.ctx));

    // Draw player
    this.drawPlayerEntity();

    // Draw JAIS police car
    this.drawJAISCar();

    // Draw danger warnings for durians
    if (this.activeMemeEvent === 'durian') {
      this.drawDurianWarnings();
    }

    // Draw boss warning banner
    if (this.bossStageActive && this.warningTimer > 0) {
      this.drawTrafficJamBanner();
    }
  },

  updateHUD() {
    document.getElementById('hud-score').innerText = String(Math.floor(this.score)).padStart(5, '0');
    document.getElementById('hud-highscore').innerText = String(this.highScore).padStart(5, '0');
    
    // Lives display
    let livesStr = '';
    for (let i = 0; i < this.player.maxLives; i++) {
      livesStr += (i < this.player.lives) ? '👑 ' : '❌ ';
    }
    document.getElementById('hud-lives').innerText = livesStr;

    // Power-up duration bar
    const pBar = document.getElementById('hud-powerup-bar');
    if (this.player.activePowerup) {
      pBar.classList.remove('hidden');
      const pName = document.getElementById('powerup-name');
      const pProgress = document.getElementById('powerup-progress');
      
      const names = {
        'songkok': 'INVISIBLE SONGKOK',
        'bike': 'GRAB BIKE RIDE',
        'shield': 'MAK CIK PROTECTION',
        'tehtarik': 'TEH TARIK BOOST'
      };
      pName.innerText = names[this.player.activePowerup] || '';
      
      const maxTime = this.player.activePowerup === 'bike' ? (this.player.id === 'photographer' ? 780 : 600) : 
                       (this.player.activePowerup === 'shield' ? 180 : 300);
      const percentage = (this.player.powerupTimeLeft / maxTime) * 100;
      pProgress.style.width = `${percentage}%`;
    } else {
      pBar.classList.add('hidden');
    }

    // Dash cooldown circle
    const cooldownFill = document.getElementById('dash-cooldown-progress');
    const dashIcon = document.getElementById('dash-icon');
    
    if (this.player.dashCooldown > 0) {
      const p = (this.player.dashCooldown / this.player.dashCooldownMax) * 100;
      cooldownFill.setAttribute('stroke-dasharray', `${p}, 100`);
      dashIcon.style.opacity = '0.4';
    } else {
      cooldownFill.setAttribute('stroke-dasharray', '0, 100');
      dashIcon.style.opacity = '1.0';
    }

    // JAIS distance meter
    const fill = document.getElementById('jais-warning-indicator');
    const car = document.getElementById('jais-car-icon');
    const pIcon = document.getElementById('player-icon');
    const txt = document.getElementById('jais-distance-text');

    const dist = this.jaisCar.distance;
    fill.style.width = `${dist}%`;

    // Colors: Green -> Orange -> Red
    fill.className = 'meter-fill ' + (dist > 60 ? 'green' : (dist > 30 ? 'yellow' : 'red'));

    // Position icons inside track (width is 260px minus padding/size)
    const trackWidth = 230;
    car.style.left = `${(100 - dist) * 0.8}%`; // JAIS chases from left (closter as dist shrinks)
    pIcon.style.left = '85%'; // Player stays right

    if (dist > 60) {
      txt.innerText = "SAFE DISTANCE";
      txt.className = "meter-subtext";
    } else if (dist > 30) {
      txt.innerText = "JAIS IS WATCHING!";
      txt.className = "meter-subtext text-yellow";
    } else {
      txt.innerText = "OH NO! PULL OVER!";
      txt.className = "meter-subtext alert-pulse";
    }
  },

  updateBackgrounds(elapsed) {
    const currentZone = this.getCurrentZone();
    
    // If the zone has rain, trigger the rain event banner automatically
    if (currentZone.name === "Rainy Neighborhood" && !this.activeMemeEvent && !this.bossStageActive) {
      this.triggerMemeEvent('rain');
    }

    // Update background scrolling positions
    this.backgroundLayers.forEach(layer => {
      // Scroll layer based on speed and speed factor
      layer.x = (layer.x || 0) - (this.gameSpeed * layer.speedFactor * (elapsed / 16));
      if (layer.x <= -960) layer.x = 0;
    });
  },

  drawBackgrounds() {
    const zone = this.getCurrentZone();

    // 1. Fill Sky Gradient
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, 420);
    skyGrad.addColorStop(0, zone.sky);
    skyGrad.addColorStop(1, '#ffffff');
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, this.canvas.width, 420);

    // 2. Draw Parallax layers
    this.backgroundLayers.forEach(layer => {
      this.ctx.save();
      layer.draw(this.ctx, layer.x || 0);
      this.ctx.restore();
    });
  },

  drawSkyline(ctx, x) {
    const zone = this.getCurrentZone();
    ctx.translate(x, 0);

    // Draw 2 copies for infinite scroll
    for (let copy = 0; copy < 2; copy++) {
      const offset = copy * 960;
      ctx.fillStyle = 'rgba(17, 24, 39, 0.08)'; // Very faint slate silhouettes

      if (zone.name.includes("Kampung") || zone.name.includes("Paddy")) {
        // Draw distant mountains/hills
        ctx.beginPath();
        ctx.moveTo(offset, 420);
        ctx.lineTo(offset + 200, 250);
        ctx.lineTo(offset + 400, 320);
        ctx.lineTo(offset + 600, 200);
        ctx.lineTo(offset + 800, 350);
        ctx.lineTo(offset + 960, 420);
        ctx.fill();
      } 
      else if (zone.name.includes("Roundabout") || zone.name.includes("LRT") || zone.name.includes("Neighborhood")) {
        // Draw distant City Skyline (tall buildings)
        ctx.fillRect(offset + 50, 220, 80, 200);
        ctx.fillRect(offset + 180, 150, 100, 270);
        ctx.fillRect(offset + 320, 260, 60, 160);
        ctx.fillRect(offset + 420, 100, 120, 320); // KLCC silhouette shape
        ctx.fillRect(offset + 600, 210, 70, 210);
        ctx.fillRect(offset + 720, 180, 90, 240);
        ctx.fillRect(offset + 850, 280, 50, 140);
      } 
      else {
        // Mamak or Pasar Malam: blend of buildings/tents silhouettes
        ctx.fillRect(offset + 10, 260, 180, 160);
        ctx.fillRect(offset + 250, 230, 150, 190);
        ctx.fillRect(offset + 500, 200, 200, 220);
        ctx.fillRect(offset + 780, 250, 130, 170);
      }
    }
  },

  drawMidground(ctx, x) {
    const zone = this.getCurrentZone();
    ctx.translate(x, 0);

    for (let copy = 0; copy < 2; copy++) {
      const offset = copy * 960;
      ctx.fillStyle = 'rgba(31, 41, 55, 0.2)'; // Solid silhouette

      if (zone.name.includes("Kampung") || zone.name.includes("Paddy")) {
        // Draw coconut trees and wooden houses
        for (let i = 0; i < 5; i++) {
          const tx = offset + 100 + (i * 200);
          // Trunk
          ctx.fillRect(tx, 260, 6, 160);
          // Leaves
          ctx.beginPath();
          ctx.arc(tx + 3, 260, 25, 0, Math.PI * 2);
          ctx.fill();
          
          // Kampung house on stilts
          ctx.fillRect(tx - 60, 360, 40, 40); // house body
          ctx.beginPath();
          ctx.moveTo(tx - 70, 360);
          ctx.lineTo(tx - 40, 330);
          ctx.lineTo(tx - 10, 360);
          ctx.fill();
        }
      } 
      else if (zone.name.includes("Roundabout")) {
        // Blue Dome of Shah Alam Mosque silhouette in distance
        const mx = offset + 350;
        ctx.beginPath();
        ctx.arc(mx, 360, 60, Math.PI, 0); // Blue Dome
        ctx.fill();
        ctx.fillRect(mx - 80, 220, 12, 200); // Minarets
        ctx.fillRect(mx + 68, 220, 12, 200);
      } 
      else if (zone.name.includes("LRT Station")) {
        // Elevated track lines
        ctx.fillRect(offset, 320, 960, 15);
        // Track pillars
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(offset + 100 + (i * 280), 335, 30, 85);
        }
      } 
      else if (zone.name.includes("Mamak") || zone.name.includes("Pasar Malam")) {
        // Draw rows of stall shop outlines / banners
        for (let i = 0; i < 4; i++) {
          const sx = offset + 50 + (i * 240);
          ctx.fillRect(sx, 320, 160, 100);
          // Roof canopy
          ctx.fillStyle = 'rgba(75, 85, 99, 0.3)';
          ctx.fillRect(sx - 10, 310, 180, 15);
          ctx.fillStyle = 'rgba(31, 41, 55, 0.2)';
        }
      } 
      else {
        // Neighbors: house blocks
        for (let i = 0; i < 6; i++) {
          ctx.fillRect(offset + 30 + (i * 160), 300, 110, 120);
        }
      }
    }
  },

  drawForeground(ctx, x) {
    const zone = this.getCurrentZone();
    ctx.translate(x, 0);

    for (let copy = 0; copy < 2; copy++) {
      const offset = copy * 960;
      ctx.fillStyle = 'rgba(55, 65, 81, 0.45)'; // Richer slate

      if (zone.name.includes("Kampung") || zone.name.includes("Paddy")) {
        // Picket fences and foliage bush clusters
        for (let i = 0; i < 8; i++) {
          const bx = offset + 50 + (i * 130);
          ctx.beginPath();
          ctx.arc(bx, 420, 20, Math.PI, 0);
          ctx.arc(bx + 15, 420, 15, Math.PI, 0);
          ctx.fill();
        }
      } 
      else if (zone.name.includes("Roundabout") || zone.name.includes("Neighborhood")) {
        // Street lamp posts
        for (let i = 0; i < 3; i++) {
          const lx = offset + 150 + (i * 320);
          ctx.fillRect(lx, 220, 8, 200); // Pole
          ctx.fillRect(lx - 15, 220, 25, 6);  // Light arm
        }
      } 
      else if (zone.name.includes("Mamak")) {
        // Mamak fans, stall signs, teh tarik signs
        for (let i = 0; i < 3; i++) {
          const mx = offset + 100 + (i * 300);
          // Sign post
          ctx.fillRect(mx, 260, 6, 160);
          // Sign board "RESTORAN AL-MAMAK"
          ctx.fillRect(mx - 40, 260, 86, 35);
        }
      } 
      else if (zone.name.includes("Pasar Malam")) {
        // Hanging bulb strings
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(55, 65, 81, 0.6)';
        ctx.beginPath();
        ctx.moveTo(offset, 250);
        ctx.quadraticCurveTo(offset + 240, 280, offset + 480, 250);
        ctx.quadraticCurveTo(offset + 720, 280, offset + 960, 250);
        ctx.stroke();
        
        // Small bulb silhouettes
        ctx.fillStyle = 'rgba(55, 65, 81, 0.7)';
        for (let i = 0; i < 16; i++) {
          const bx = offset + 30 + (i * 60);
          ctx.fillRect(bx, 265, 8, 12);
        }
      } 
      else if (zone.name.includes("LRT Station")) {
        // LRT Station signs or pillars close by
        for (let i = 0; i < 3; i++) {
          const rx = offset + 80 + (i * 350);
          ctx.fillRect(rx, 250, 40, 170); // Pillar block
        }
      }
    }
  },

  drawRoad(ctx, x) {
    // Road asphalt color
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 420, 960, 120);

    // Scrolling yellow lines (bottom edge)
    ctx.translate(x, 0);
    ctx.fillStyle = '#eab308';
    for (let copy = 0; copy < 3; copy++) {
      const offset = copy * 960;
      for (let i = 0; i < 8; i++) {
        ctx.fillRect(offset + (i * 120), 475, 50, 8);
      }
    }
  },

  updatePlayer(elapsed) {
    // 1. Dash logic
    if (this.player.dashTime > 0) {
      this.player.dashTime--;
      if (this.player.dashTime <= 0) {
        this.player.vx = 0; // stop surging
      }
    }

    // Cooldown
    if (this.player.dashCooldown > 0) {
      this.player.dashCooldown--;
    }

    // 2. Power-up cooldown ticking
    if (this.player.activePowerup) {
      this.player.powerupTimeLeft--;
      if (this.player.powerupTimeLeft <= 0) {
        this.endPowerup();
      }
    }

    // Flashing invulnerability frames
    if (this.player.invulnerableTime > 0) {
      this.player.invulnerableTime--;
    }

    // Stun ticking
    if (this.player.stunTime > 0) {
      this.player.stunTime--;
    }

    // 3. Movement controls physics
    if (this.player.stunTime <= 0) {
      // Left/Right arrows adjust horizontal positioning on the screen
      let walkSpeed = 5;
      if (this.activeMemeEvent === 'rain') {
        walkSpeed = 2.5; // Rain drags you down/slows horizontal dodging
      }

      if (this.keys['ArrowLeft']) {
        this.player.x -= walkSpeed;
      } else if (this.keys['ArrowRight']) {
        this.player.x += walkSpeed;
      } else {
        // Return slowly to default position (x=200)
        if (this.player.x < 200) this.player.x += 1;
        if (this.player.x > 200) this.player.x -= 1;
      }

      // Constrain player x boundaries
      this.player.x = Math.max(100, Math.min(800, this.player.x));
    }

    // 4. Vertical jumping physics
    this.player.vy += this.player.gravity;
    this.player.y += this.player.vy;

    // Road ground limit
    if (this.player.y >= 420) {
      this.player.y = 420;
      this.player.vy = 0;
      this.player.isGrounded = true;
    }

    // Check if player fell into a gap (drain or pothole)
    this.obstacles.forEach(o => {
      if ((o.type === 'drain' || o.type === 'pothole') && this.checkGapFall(o)) {
        this.player.y = 560; // fall down screen
        this.player.isGrounded = false;
        
        // Instant trigger collision / respawn hit
        this.triggerObstacleHit(o);
      }
    });

    // 5. Animation cycle
    this.player.animTimer += (this.gameSpeed * 0.15);
    if (this.player.animTimer >= 2) {
      this.player.animFrame = (this.player.animFrame + 1) % 2;
      this.player.animTimer = 0;
    }
  },

  checkGapFall(gap) {
    // Check if player is strictly positioned over the gap horizontally and is not jumping
    const px = this.player.x;
    const py = this.player.y;
    // Feet width range is smaller than total bounding box
    const leftFeet = px + 15;
    const rightFeet = px + 33;
    
    // Only fall when player's feet are flat on the ground level (or below)
    if (py >= 420) {
      if (leftFeet > gap.x && rightFeet < gap.x + gap.width) {
        // If player is in dash mode, they cross the gap safely!
        if (this.player.dashTime > 0 || this.player.activePowerup === 'bike') {
          return false;
        }
        return true;
      }
    }
    return false;
  },

  drawPlayerEntity() {
    if (this.player.invulnerableTime > 0 && Math.floor(this.player.invulnerableTime / 3) % 2 === 0) {
      return; // Skip drawing to simulate blinking
    }

    this.ctx.save();

    // Select sprite frame
    let sprite = Sprites.players[this.player.id].standing;
    
    if (this.player.activePowerup === 'bike') {
      sprite = Sprites.players[this.player.id].bike;
    } 
    else if (this.player.dashTime > 0) {
      sprite = Sprites.players[this.player.id].dash;
      
      // Draw trailing shadows for dash
      this.ctx.globalAlpha = 0.3;
      this.ctx.drawImage(sprite, this.player.x - 25, this.player.y - this.player.height, this.player.width, this.player.height);
      this.ctx.drawImage(sprite, this.player.x - 50, this.player.y - this.player.height, this.player.width, this.player.height);
      this.ctx.globalAlpha = 1.0;
    } 
    else if (!this.player.isGrounded) {
      sprite = Sprites.players[this.player.id].jump;
    } 
    else {
      sprite = this.player.animFrame === 0 ? Sprites.players[this.player.id].run1 : Sprites.players[this.player.id].run2;
    }

    // Draw active power-up styling (Songkok makes player translucent)
    if (this.player.activePowerup === 'songkok') {
      this.ctx.globalAlpha = 0.55;
    }

    // Render player sprite on canvas
    this.ctx.drawImage(sprite, this.player.x, this.player.y - this.player.height, this.player.width, this.player.height);

    // If Mak Cik shield active, draw Mak Cik flying next to the player
    if (this.player.activePowerup === 'shield') {
      const mcSprite = Sprites.decorations.makcik;
      this.ctx.drawImage(mcSprite, this.player.x - 45, this.player.y - 64, 40, 64);
      
      // Draw dialogue text
      this.ctx.fillStyle = '#ffffff';
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 3;
      this.ctx.font = 'bold 12px sans-serif';
      this.ctx.strokeText("Eh jangan kacau budak ni!", this.player.x - 70, this.player.y - 75);
      this.ctx.fillText("Eh jangan kacau budak ni!", this.player.x - 70, this.player.y - 75);
    }

    // Draw active Teh Tarik boost speed lines
    if (this.player.activePowerup === 'tehtarik') {
      this.ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
      this.ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const ly = this.player.y - 15 - (i * 20);
        this.ctx.beginPath();
        this.ctx.moveTo(this.player.x - 30, ly);
        this.ctx.lineTo(this.player.x + 10, ly);
        this.ctx.stroke();
      }
    }

    this.ctx.restore();
  },

  updateJAIS(elapsed) {
    // JAIS sirens flashing animation
    this.jaisCar.animTimer += elapsed;
    if (this.jaisCar.animTimer >= 200) {
      this.jaisCar.sirenOn = !this.jaisCar.sirenOn;
      this.jaisCar.animTimer = 0;
    }

    // JAIS position X is coupled with distance to player
    // If distance is 100, JAIS is offscreen. If distance is 0, they catch you.
    const targetX = this.player.x - 220 + (this.jaisCar.distance * 1.8);
    this.jaisCar.x += (targetX - this.jaisCar.x) * 0.1; // Smooth interpolate

    // During boss stages or victory, JAIS retreats offscreen left
    if (this.bossStageActive || this.currentState === this.States.VICTORY) {
      this.jaisCar.x = -200;
    }
  },

  drawJAISCar() {
    if (this.jaisCar.x <= -this.jaisCar.width) return;

    this.ctx.drawImage(Sprites.jaisCar, this.jaisCar.x, this.jaisCar.y, this.jaisCar.width, this.jaisCar.height);
    
    // Siren blinking lights overlay
    if (this.jaisCar.sirenOn) {
      this.ctx.fillStyle = 'rgba(239, 68, 68, 0.8)'; // red light
      this.ctx.beginPath();
      this.ctx.arc(this.jaisCar.x + 50, this.jaisCar.y + 4, 12, 0, Math.PI * 2);
      this.ctx.fill();
    } else {
      this.ctx.fillStyle = 'rgba(59, 130, 246, 0.8)'; // blue light
      this.ctx.beginPath();
      this.ctx.arc(this.jaisCar.x + 50, this.jaisCar.y + 4, 12, 0, Math.PI * 2);
      this.ctx.fill();
    }
  },

  updateObstaclesAndCollectibles(elapsed) {
    // Update Obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.update(elapsed, this.gameSpeed);
      
      // Remove offscreen
      if (o.x < -100) {
        this.obstacles.splice(i, 1);
      }
    }

    // Update Collectibles
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const c = this.collectibles[i];
      c.update(elapsed, this.gameSpeed);

      if (c.x < -100) {
        this.collectibles.splice(i, 1);
      }
    }
  },

  spawnItem() {
    const r = Math.random();
    
    if (this.bossStageActive) {
      // Boss stage only spawns potholes, White Myvis, and motorcycles
      if (r < 0.4) {
        this.spawnObstacle('myvi');
      } else if (r < 0.7) {
        this.spawnObstacle('motorcycle');
      } else {
        this.spawnObstacle('pothole');
      }
      return;
    }

    // Standard spawning: obstacles vs power-ups vs food
    if (r < 0.45) {
      // Spawn obstacle
      const types = ['cone', 'clipboard', 'cat', 'drain'];
      // If a specific meme event is active, prioritize event obstacles
      if (this.activeMemeEvent === 'kenduri') {
        this.spawnObstacle('kenduri');
      } else if (this.activeMemeEvent === 'slippers') {
        this.spawnObstacle('slippers');
      } else {
        const type = types[Math.floor(Math.random() * types.length)];
        this.spawnObstacle(type);
      }
    } 
    else if (r < 0.85) {
      // Spawn collectibles (coconuts vs nasi lemak)
      if (Math.random() < 0.4) {
        this.spawnCollectible('nasilemak');
      } else if (Math.random() < 0.05) {
        this.spawnCollectible('life'); // Rare extra life crown
      } else {
        this.spawnCollectible('coconut');
      }
    } 
    else {
      // Spawn funny power-ups
      const powerups = ['songkok', 'bike', 'shield', 'tehtarik'];
      const pu = powerups[Math.floor(Math.random() * powerups.length)];
      this.spawnCollectible(pu);
    }
  },

  spawnObstacle(type) {
    let y = 420; // Default ground
    let width = 32;
    let height = 32;
    
    if (type === 'cone' || type === 'clipboard') {
      width = 32; height = 32;
    } else if (type === 'cat') {
      width = 48; height = 32;
    } else if (type === 'drain') {
      y = 420; width = 64; height = 16;
    } else if (type === 'myvi') {
      y = 420; width = 80; height = 40;
    } else if (type === 'motorcycle') {
      y = 420; width = 48; height = 40;
    } else if (type === 'pothole') {
      y = 420; width = 48; height = 20;
    } else if (type === 'kenduri') {
      width = 64; height = 40;
    } else if (type === 'slippers') {
      width = 48; height = 24;
    }

    const obs = {
      type: type,
      x: 980,
      y: y,
      width: width,
      height: height,
      update(el, speed) {
        // Myvi runs faster towards the player!
        const multiplier = this.type === 'myvi' ? 1.5 : 1.0;
        this.x -= speed * multiplier * (el / 16);
      },
      draw(ctx) {
        const sprite = Sprites.obstacles[this.type];
        if (sprite) {
          ctx.drawImage(sprite, this.x, this.y - this.height, this.width, this.height);
        }
      }
    };
    this.obstacles.push(obs);
  },

  spawnCollectible(type) {
    let y = 350 - Math.random() * 80; // airborne height
    if (type === 'life' || type === 'coconut' || type === 'nasilemak') {
      // Can be ground or air
      if (Math.random() < 0.5) y = 420;
    }
    
    let label = '';
    let isPowerup = false;
    let size = 32;

    if (type === 'songkok') { label = '🎩'; isPowerup = true; }
    else if (type === 'bike') { label = '🏍️'; isPowerup = true; }
    else if (type === 'shield') { label = '👵'; isPowerup = true; }
    else if (type === 'tehtarik') { label = '☕'; isPowerup = true; }

    const coll = {
      type: type,
      x: 980,
      y: y,
      width: size,
      height: size,
      isPowerup: isPowerup,
      label: label,
      animTimer: 0,
      update(el, speed) {
        this.x -= speed * (el / 16);
        this.animTimer += 0.1;
      },
      draw(ctx) {
        ctx.save();
        if (this.isPowerup) {
          // Draw a glowing retro ring around powerups
          ctx.strokeStyle = '#00f3ff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(this.x + 16, this.y - 16, 20 + Math.sin(this.animTimer) * 3, 0, Math.PI * 2);
          ctx.stroke();
          
          // Draw standard emoji label or text
          ctx.font = '20px sans-serif';
          ctx.fillText(this.label, this.x + 6, this.y - 8);
        } else {
          // Draw generated sprite
          const sprite = Sprites.collectibles[this.type];
          if (sprite) {
            ctx.drawImage(sprite, this.x, this.y - this.height, this.width, this.height);
          }
        }
        ctx.restore();
      }
    };
    this.collectibles.push(coll);
  },

  updateMemeDirector(elapsed) {
    this.memeTimer += elapsed;
    
    // Every 20 seconds, trigger a random meme event
    if (this.memeTimer >= 20000) {
      const events = ['rain', 'durian', 'kenduri', 'slippers'];
      const ev = events[Math.floor(Math.random() * events.length)];
      this.triggerMemeEvent(ev);
      this.memeTimer = 0;
    }

    if (this.activeMemeEvent) {
      this.memeEventTimeLeft -= elapsed;
      
      // Special action: Spawn durians falling from sky
      if (this.activeMemeEvent === 'durian') {
        this.updateDurianRain(elapsed);
      }

      if (this.memeEventTimeLeft <= 0) {
        this.endMemeEvent();
      }
    }
  },

  triggerMemeEvent(ev) {
    this.activeMemeEvent = ev;
    this.memeEventTimeLeft = 8000; // Lasts 8 seconds
    
    const banner = document.getElementById('meme-event-banner');
    const title = document.getElementById('meme-event-title');
    const desc = document.getElementById('meme-event-desc');

    banner.classList.remove('hidden');

    if (ev === 'rain') {
      title.innerText = "⚡ HEAVY RAIN! ⚡";
      desc.innerText = "MOVEMENT SPEED SLOWED DOWN!";
    } else if (ev === 'durian') {
      title.innerText = "🥥 DURIAN SEASON! 🥥";
      desc.innerText = "DODGE THE FALLING FRUITS!";
      this.durianSpawnTimer = 0;
    } else if (ev === 'kenduri') {
      title.innerText = "🍛 KENDURI SELANGOR! 🍛";
      desc.innerText = "TABLES BLOCKING THE ROAD!";
    } else if (ev === 'slippers') {
      title.innerText = "👟 OPEN HOUSE! 👟";
      desc.innerText = "TOO MANY SLIPPERS ON GROUND!";
    }

    // Flash banner and hide after 3 seconds
    setTimeout(() => {
      if (this.activeMemeEvent === ev) {
        banner.classList.add('hidden');
      }
    }, 3000);
  },

  endMemeEvent() {
    this.activeMemeEvent = null;
    document.getElementById('meme-event-banner').classList.add('hidden');
  },

  updateDurianRain(elapsed) {
    this.durianSpawnTimer = (this.durianSpawnTimer || 0) + elapsed;
    if (this.durianSpawnTimer >= 700) {
      // Spawn falling durian
      const tx = 200 + Math.random() * 700; // falls in active player range
      const durian = {
        type: 'durian',
        x: tx,
        y: -50,
        vy: 8,
        width: 32,
        height: 32,
        warningTime: 60, // frames to show warning indicator
        update(el, speed) {
          if (this.warningTime > 0) {
            this.warningTime--;
          } else {
            this.y += this.vy * (el / 16);
          }
        },
        draw(ctx) {
          if (this.warningTime > 0) return; // invisible during warning
          const sprite = Sprites.obstacles['durian'];
          if (sprite) {
            ctx.drawImage(sprite, this.x, this.y, this.width, this.height);
          }
        }
      };
      this.obstacles.push(durian);
      this.durianSpawnTimer = 0;
    }
  },

  drawDurianWarnings() {
    this.obstacles.forEach(o => {
      if (o.type === 'durian' && o.warningTime > 0) {
        // Draw blinking red indicator at top of screen at o.x
        this.ctx.fillStyle = Math.floor(o.warningTime / 5) % 2 === 0 ? '#ef4444' : '#fbbf24';
        this.ctx.font = 'bold 24px sans-serif';
        this.ctx.fillText("⚠️", o.x - 10, 40);
      }
    });
  },

  drawRainEffect() {
    // Blue rain tint overlay
    this.ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw rain drops
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.lineWidth = 1.5;
    for (let i = 0; i < 20; i++) {
      const rx = (Math.random() * 960 + (performance.now() * 0.5)) % 960;
      const ry = (Math.random() * 540 + (performance.now() * 1.5)) % 540;
      this.ctx.beginPath();
      this.ctx.moveTo(rx, ry);
      this.ctx.lineTo(rx - 8, ry + 25);
      this.ctx.stroke();
    }
  },

  triggerBossStage() {
    this.bossStageActive = true;
    this.bossStageTimer = 15000; // 15 seconds duration
    this.warningTimer = 3000; // Show warning banner for 3s
    
    // Pull JAIS car back out of screen
    this.jaisCar.distance = 100;
    
    // Speed up a bit
    this.gameSpeed = 9.5;
    
    // Play sound alert
    GameAudio.playHit();
  },

  endBossStage() {
    this.bossStageActive = false;
    this.nextBossMilestone += 1000; // Next jam at +1000 points
    
    // Reset JAIS patrol chasing
    this.jaisCar.distance = 70;
  },

  drawTrafficJamBanner() {
    this.warningTimer -= 16;
    
    // Draw pulsing TRAFFIC JAM warning overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this.ctx.fillRect(0, 180, 960, 150);

    this.ctx.fillStyle = '#ef4444';
    this.ctx.font = 'bold 28px "Press Start 2P"';
    this.ctx.textAlign = 'center';
    this.ctx.fillText("⚠️ KESESAKAN JALAN RAYA ⚠️", 480, 245);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '16px "Outfit"';
    this.ctx.fillText("GIANT TRAFFIC JAM! DODGE MYVIS & POTHOLES!", 480, 295);
    this.ctx.textAlign = 'left'; // Reset
  },

  triggerPowerup(type) {
    this.player.activePowerup = type;
    
    if (type === 'songkok') {
      this.player.powerupTimeLeft = 300; // 5 seconds (300 frames)
    } 
    else if (type === 'bike') {
      // Photographer gets longer Grab bike duration (+3 seconds)
      const duration = this.player.id === 'photographer' ? 780 : 600;
      this.player.powerupTimeLeft = duration;
      this.gameSpeed = 10; // accelerate
    } 
    else if (type === 'shield') {
      this.player.powerupTimeLeft = 180; // 3 seconds
      
      // All current obstacles fade/clear
      this.obstacles.forEach(o => {
        this.spawnDust(o.x, o.y, 4);
      });
      this.obstacles = [];
      
      // Retreat JAIS patrol far back
      this.jaisCar.distance = Math.min(100, this.jaisCar.distance + 35);
    } 
    else if (type === 'tehtarik') {
      this.player.powerupTimeLeft = 300; // 5 seconds
      this.gameSpeed = this.gameSpeed * 1.5;
      
      // Speed up music tempo!
      GameAudio.setMusicSpeed(true);
    }

    GameAudio.playCollect();
    
    // Spawn power-up title floating text
    const names = {
      'songkok': 'INVISIBLE SONGKOK!',
      'bike': 'GRAB BIKE ACTIVE!',
      'shield': 'MAK CIK PROTECTION!',
      'tehtarik': 'TEH TARIK BOOST!'
    };
    this.spawnFloatingText(this.player.x, this.player.y - 70, names[type], '#00f3ff');
  },

  endPowerup() {
    if (this.player.activePowerup === 'tehtarik') {
      GameAudio.setMusicSpeed(false);
    }
    this.player.activePowerup = null;
  },

  updateParticles(elapsed) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update(elapsed);
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  },

  spawnDust(x, y, count = 3) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() * 20 - 10),
        y: y + (Math.random() * 10 - 5),
        vx: -Math.random() * 2 - 1,
        vy: -Math.random() * 1.5,
        size: Math.random() * 6 + 3,
        alpha: 1.0,
        decay: Math.random() * 0.05 + 0.02,
        update(el) {
          this.x += this.vx * (el / 16);
          this.y += this.vy * (el / 16);
          this.alpha -= this.decay;
        },
        draw(ctx) {
          ctx.save();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.globalAlpha = this.alpha;
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    }
  },

  spawnFloatingText(x, y, text, color) {
    this.particles.push({
      x: x,
      y: y,
      vy: -1.5,
      text: text,
      color: color,
      alpha: 1.0,
      update(el) {
        this.y += this.vy * (el / 16);
        this.alpha -= 0.02;
      },
      draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.font = 'bold 12px "Press Start 2P"';
        ctx.strokeText(this.text, this.x - 30, this.y);
        ctx.fillText(this.text, this.x - 30, this.y);
        ctx.restore();
      }
    });
  },

  checkCollisions() {
    // Bounding Box overlap helper
    const isOverlapping = (rect1, rect2) => {
      return rect1.x < rect2.x + rect2.width &&
             rect1.x + rect1.width > rect2.x &&
             rect1.y - rect1.height < rect2.y &&
             rect1.y > rect2.y - rect2.height;
    };

    const playerBox = {
      x: this.player.x + 5,
      y: this.player.y,
      width: this.player.width - 10,
      height: this.player.height
    };

    // 1. Check Collectibles collisions
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const c = this.collectibles[i];
      if (isOverlapping(playerBox, c)) {
        if (c.isPowerup) {
          this.triggerPowerup(c.type);
        } else {
          // Play collect chime
          GameAudio.playCollect();
          
          let points = 10;
          if (c.type === 'coconut') {
            points = this.player.id === 'tourist' ? 20 : 10; // Tourist Batik gets 2x points
            this.coconutsCollected++;
            this.spawnFloatingText(c.x, c.y, `+${points}`, '#fbbf24');
          } 
          else if (c.type === 'nasilemak') {
            points = this.player.id === 'panda' ? 40 : 20; // Rider Panda gets 2x points
            this.nasiLemakCollected++;
            this.spawnFloatingText(c.x, c.y, `+${points}`, '#10b981');
          } 
          else if (c.type === 'life') {
            if (this.player.lives < this.player.maxLives) {
              this.player.lives++;
              this.spawnFloatingText(c.x, c.y, `+1 LIFE 👑`, '#ec4899');
            } else {
              points = 100; // score bonus if full health
              this.spawnFloatingText(c.x, c.y, `+100 BONUS`, '#ec4899');
            }
          }
          this.score += points;

          // Increase JAIS distance slightly when playing well (+2)
          this.jaisCar.distance = Math.min(100, this.jaisCar.distance + 2);
        }

        // Remove item
        this.collectibles.splice(i, 1);
      }
    }

    // 2. Check Obstacles collisions
    // Gaps (drain/pothole) are evaluated in updatePlayer fall check, not standard bounding boxes
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      if (o.type === 'drain' || o.type === 'pothole') continue;

      if (isOverlapping(playerBox, o)) {
        this.triggerObstacleHit(o);
        this.obstacles.splice(i, 1);
      }
    }
  },

  triggerObstacleHit(obs) {
    // If player is immune (Dash active or powerups active)
    if (this.player.dashTime > 0 || this.player.activePowerup === 'songkok' || this.player.activePowerup === 'bike' || this.player.activePowerup === 'shield') {
      // Destroy obstacle with dust clouds
      this.spawnDust(obs.x, obs.y, 4);
      GameAudio.playCollect(); // smash sound
      return;
    }

    // If player is in stun cooloff frames, skip collision
    if (this.player.invulnerableTime > 0) return;

    // Trigger Hit
    GameAudio.playHit();

    // Deduct 1 life
    this.player.lives--;

    // Drag back JAIS distance meter
    this.jaisCar.distance = Math.max(0, this.jaisCar.distance - 22);

    // Flashing frames + hit stun
    this.player.invulnerableTime = 60; // 1s flash
    this.player.stunTime = 15; // 0.25s stun freeze
    this.player.x = Math.max(100, this.player.x - 80); // knocked back

    // Spawn warning text
    this.spawnFloatingText(this.player.x + 30, this.player.y - 50, "-1 LIFE 💥", '#ef4444');

    // Spawn dust explosion
    this.spawnDust(this.player.x + 30, this.player.y - 20, 5);

    // Death / Arrest Check
    if (this.player.lives <= 0 || this.jaisCar.distance <= 0) {
      this.triggerGameOver();
    }
  },

  triggerGameOver() {
    this.currentState = this.States.GAMEOVER;
    this.updateUI();
    GameAudio.playGameOver();
  },

  triggerVictory() {
    this.currentState = this.States.VICTORY;
    this.updateUI();
    GameAudio.playVictory();

    // Setup cutscene sequence properties
    this.cutsceneStep = 0;
    this.cutsceneTimer = 0;
    this.cutsceneEntities = {
      playerX: 150,
      stallX: 960,
      jaisX: -200,
      tableAlpha: 0
    };

    // Advance dialogues
    this.advanceCutscene();
  },

  updateCutscene(elapsed) {
    this.cutsceneTimer += elapsed;

    // 1. Scroll stall in from right
    if (this.cutsceneEntities.stallX > 550) {
      this.cutsceneEntities.stallX -= 4 * (elapsed / 16);
    }

    // 2. Walk player to center/stall
    if (this.cutsceneEntities.playerX < 420) {
      this.cutsceneEntities.playerX += 2 * (elapsed / 16);
    }

    // 3. Bring JAIS car in from left after a short delay
    if (this.cutsceneTimer > 1500 && this.cutsceneEntities.jaisX < 180) {
      this.cutsceneEntities.jaisX += 4 * (elapsed / 16);
    }

    // 4. Fade in Table once dialog is about eating
    if (this.cutsceneStep >= 3 && this.cutsceneEntities.tableAlpha < 1.0) {
      this.cutsceneEntities.tableAlpha += 0.05;
    }
  },

  drawCutscene() {
    // Draw static zone background
    const zone = this.getCurrentZone();
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, 420);
    skyGrad.addColorStop(0, zone.sky);
    skyGrad.addColorStop(1, '#ffffff');
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, this.canvas.width, 420);

    // Draw background hills/mosque dome
    this.drawSkyline(this.ctx, 0);
    this.drawMidground(this.ctx, 0);
    this.drawForeground(this.ctx, 0);

    // Draw Road asphalt (static)
    this.ctx.fillStyle = '#1e293b';
    this.ctx.fillRect(0, 420, 960, 120);

    // Draw Nasi Lemak Stall
    const stall = Sprites.decorations.stall;
    this.ctx.drawImage(stall, this.cutsceneEntities.stallX, 330, 128, 96);

    // Draw Mamak Table (Fading in)
    if (this.cutsceneEntities.tableAlpha > 0) {
      this.ctx.save();
      this.ctx.globalAlpha = this.cutsceneEntities.tableAlpha;
      const table = Sprites.decorations.mamak_table;
      this.ctx.drawImage(table, 360, 355, 96, 64);
      this.ctx.restore();
    }

    // Draw player (walking or sitting animation frame)
    const pSprite = this.cutsceneStep >= 4 ? Sprites.players[this.player.id].standing : 
                    (Math.floor(this.cutsceneTimer / 150) % 2 === 0 ? Sprites.players[this.player.id].run1 : Sprites.players[this.player.id].run2);
    
    // Draw player walking to stall
    const px = this.cutsceneStep >= 4 ? 350 : this.cutsceneEntities.playerX;
    const py = this.cutsceneStep >= 4 ? 390 : 420; // Sit/Stand table height adjustment
    this.ctx.drawImage(pSprite, px, py - 64, 48, 64);

    // Draw JAIS Car
    this.ctx.drawImage(Sprites.jaisCar, this.cutsceneEntities.jaisX, 400, 96, 48);

    // Draw JAIS officers standing next to car if stopped
    if (this.cutsceneEntities.jaisX >= 180) {
      // Draw 2 police officer templates (copy Player colors slightly)
      const policeSprite = Sprites.players['adudu'].standing; // Warrior layout but drawn in deep blue
      this.ctx.drawImage(policeSprite, this.cutsceneStep >= 4 ? 440 : 280, py - 64, 48, 64);
    }
  },

  advanceCutscene() {
    this.cutsceneStep++;
    
    const speaker = document.getElementById('cutscene-speaker');
    const text = document.getElementById('cutscene-text');
    const name = Sprites.charTemplates[this.player.id].name;

    const dialogues = [
      { speaker: "JAIS OFFICER:", text: "OI!!! Berhenti! Kenapa lari satu Selangor?!" },
      { speaker: name, text: "Sumpah encik! Saya lari sebab semua orang asyik kejar & jerit 'Oi!' kat saya!" },
      { speaker: "JAIS OFFICER:", text: "Kami kejar sebab nak pulangkan dompet awak tercicir masa beli teh tarik tadi!..." },
      { speaker: name, text: "Oooo... Tercicir? Ya Allah, saya ingatkan ada salah faham kes tauliah tadi! Haha!" },
      { speaker: "MAK CIK:", text: "Eh jangan kacau budak ni! Dia nak makan nasi lemak je. Jom pekena sekali." },
      { speaker: "JAIS OFFICER:", text: "Betul tu! Kak Som, nasi lemak ayam berempah tiga bungkus, teh tarik kurang manis!" },
      { speaker: "SYSTEM:", text: "Misunderstanding cleared. Everyone laughs. Game Over." }
    ];

    const currentDial = dialogues[this.cutsceneStep - 1];

    if (currentDial) {
      speaker.innerText = currentDial.speaker;
      text.innerText = currentDial.text;
    } else {
      // End cutscene, show credits panel
      document.getElementById('cutscene-dialogue-box').classList.add('hidden');
      document.getElementById('credits-panel').classList.remove('hidden');
    }
  },

  handleResize() {
    const container = document.getElementById('game-container');
    if (!container) return;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Target dimensions are 960x540
    const targetWidth = 960;
    const targetHeight = 540;

    // Calculate the scale needed to fit the screen
    const scaleX = windowWidth / targetWidth;
    const scaleY = windowHeight / targetHeight;
    
    // Use the smaller scale to ensure it fits entirely (maintain aspect ratio)
    // Subtract a tiny bit (0.95) to leave a small margin
    const scale = Math.min(scaleX, scaleY, 1.0) * 0.98;
    
    document.documentElement.style.setProperty('--game-scale', scale);
    
    // Auto-detect touch on resize/load
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      this.touchControlsActive = true;
      this.updateUI();
    }
  }
};

// Initialize on page load
window.addEventListener('load', () => {
  Game.init();
});
