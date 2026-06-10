/**
 * JAIS Escape! - Programmatic Pixel-Art Sprites Generator
 * 
 * Generates all 16-bit retro sprites at startup onto offscreen canvases.
 * Eliminates external file dependencies and ensures crisp pixel-art scaling.
 */

const Sprites = {
  // Canvases stored here after generation
  players: {}, // format: { characterId: { standing: canvas, run1: canvas, run2: canvas, jump: canvas, dash: canvas, bike: canvas } }
  jaisCar: null,
  collectibles: {},
  obstacles: {},
  decorations: {},
  backgrounds: {},

  // Color Palette Definitions
  Palette: {
    '.': 'transparent',
    'k': '#000000', // Outline / Black
    'w': '#ffffff', // White
    'g': '#374151', // Dark Grey (Asphalt)
    'd': '#6b7280', // Grey
    's': '#fde047', // Light skin tone
    't': '#ca8a04', // Dark skin tone / tan
    'b': '#1d4ed8', // Royal Blue (Melayu/Warrior theme)
    'r': '#dc2626', // Red
    'y': '#fbbf24', // Gold / Yellow
    'n': '#047857', // Emerald Green (Banana Leaf / Islamic Cap)
    'p': '#db2777', // FoodPanda Pink
    'o': '#f97316', // Orange (Traffic cone / Cat)
    'c': '#78350f', // Brown (Coconut / Table)
    'e': '#93c5fd', // Light Blue (Glass / Sky)
    'm': '#a855f7', // Purple (Batik pattern)
    'a': '#1e293b', // Deep Slate
  },

  // Helper to draw a pixel grid to an offscreen canvas
  createCanvasFromGrid(grid, width, height, scale = 2) {
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    for (let r = 0; r < height; r++) {
      const row = grid[r];
      if (!row) continue;
      for (let c = 0; c < width; c++) {
        const char = row[c];
        if (char && char !== '.' && this.Palette[char]) {
          ctx.fillStyle = this.Palette[char];
          ctx.fillRect(c * scale, r * scale, scale, scale);
        }
      }
    }
    return canvas;
  },

  init() {
    console.log("Initializing Pixel Art Sprites...");
    this.generatePlayers();
    this.generateVehicles();
    this.generateCollectibles();
    this.generateObstacles();
    this.generateDecorations();
    console.log("Sprites generation complete.");
  },

  generatePlayers() {
    // Each character is 24x32 pixels
    const charTemplates = {
      // 1. Pang5 Adudu (Legendary warrior with a grand blue tanjak)
      adudu: {
        name: "Pang5 Adudu",
        ability: "Dash Cooldown: 3s (Base)",
        unlockText: "Unlocked by default",
        unlocked: true,
        colors: { hat: 'b', shirt: 'b', pants: 'g', detail: 'y' }
      },
      // 2. Uncle with Kopiah (Unlock at 500 score)
      uncle: {
        name: "Uncle Kopiah",
        ability: "High Jump (+10%)",
        unlockText: "Score 500 to unlock",
        unlocked: false,
        colors: { hat: 'w', shirt: 'w', pants: 'c', detail: 'd' }
      },
      // 3. Tourist in Batik (Unlock at 1000 score)
      tourist: {
        name: "Tourist Batik",
        ability: "Coconut points x2",
        unlockText: "Score 1000 to unlock",
        unlocked: false,
        colors: { hat: 'o', shirt: 'm', pants: 'd', detail: 'y' }
      },
      // 4. FoodPanda Rider (Unlock at 1500 score)
      panda: {
        name: "Rider Panda",
        ability: "Nasi Lemak points x2",
        unlockText: "Score 1500 to unlock",
        unlocked: false,
        colors: { hat: 'p', shirt: 'p', pants: 'g', detail: 'w' }
      },
      // 5. Pak Cik on Basikal (Unlock at 2000 score)
      pakcik: {
        name: "Pak Cik Basikal",
        ability: "Extra Life (+1 Life max)",
        unlockText: "Score 2000 to unlock",
        unlocked: false,
        colors: { hat: 'y', shirt: 'n', pants: 'c', detail: 'w' }
      },
      // 6. Office Worker (Unlock at 3000 score)
      worker: {
        name: "Office Worker",
        ability: "Dash Cooldown: 1.5s",
        unlockText: "Score 3000 to unlock",
        unlocked: false,
        colors: { hat: 'd', shirt: 'w', pants: 'k', detail: 'r' }
      },
      // 7. Wedding Photographer (Unlock at 4000 score)
      photographer: {
        name: "Fotografer",
        ability: "Teh Tarik duration +3s",
        unlockText: "Score 4000 to unlock",
        unlocked: false,
        colors: { hat: 'k', shirt: 'g', pants: 'g', detail: 'd' }
      },
      // 8. Hagemaru Ura (Unlock at 5000 score - Win game!)
      hagemaru: {
        name: "Hagemaru Ura",
        ability: "Double Dash Duration",
        unlockText: "Clear the game to unlock",
        unlocked: false,
        colors: { hat: 'p', shirt: 'p', pants: 'w', detail: 'y' }
      }
    };

    // Keep templates data accessible
    this.charTemplates = charTemplates;

    for (const [id, char] of Object.entries(charTemplates)) {
      this.players[id] = {
        standing: this.drawPlayerFrame(char.colors, 'standing', id),
        run1: this.drawPlayerFrame(char.colors, 'run1', id),
        run2: this.drawPlayerFrame(char.colors, 'run2', id),
        jump: this.drawPlayerFrame(char.colors, 'jump', id),
        dash: this.drawPlayerFrame(char.colors, 'dash', id),
        bike: this.drawPlayerGrabBike(char.colors, id)
      };
    }
  },

  // Dynamic player frame generator based on character color scheme
  drawPlayerFrame(colors, pose, id) {
    const H = colors.hat;     // Hat color (Tanjak, Kopiah, Batik hat, helmet)
    const S = colors.shirt;   // Shirt color
    const P = colors.pants;   // Pants color
    const D = colors.detail;  // Accessory color (belt, camera, bag, tie)
    const skin = 's';         // Skin tone

    // Base grid layout of 24x32
    const grid = Array(32).fill().map(() => "........................");

    // 1. Draw big head (pixels 2 to 14 vertically)
    // Tanjak/Hat shape (row 2 to 7)
    grid[2] = "........kkkkk...........";
    grid[3] = `.......kk${H}${H}${H}${H}kk..........`;
    grid[4] = `......kk${H}${H}${H}${H}${H}${H}kk.........`;
    grid[5] = `.....kk${H}${H}${H}${H}${H}${H}${H}${H}kk........`;
    grid[6] = `.....kk${H}${H}${D}${D}${H}${H}${H}${H}kk........`;
    grid[7] = `....kkkkkkkkkkkkkkkkkk..`;

    // Face (row 8 to 14)
    grid[8] =  "....kksssssssssssssskk..";
    grid[9] =  "....kksssssssssssssskk..";
    grid[10] = "....kksskksssssskksskk.."; // Eyes
    grid[11] = "....kksssssssssssssskk..";
    grid[12] = "....kksssskkkkkksssskk.."; // Mouth
    grid[13] = ".....kksssssssssssskk...";
    grid[14] = "......kkkkkkkkkkkkkk....";

    // 2. Draw Torso / Body (row 15 to 23)
    grid[15] = `......kkkk${S}${S}${S}${S}kkkk......`;
    grid[16] = `.....kk${S}${S}kk${S}${S}${S}${S}kk${S}${S}kk.....`;
    grid[17] = `.....kk${S}${S}kk${S}${S}${S}${S}kk${S}${S}kk.....`;
    grid[18] = `.....kkkkkk${S}${S}${S}${S}kkkkkk.....`;
    grid[19] = `.......kk${S}${S}${S}${S}${S}${S}kk.......`;
    grid[20] = `.......kk${S}${D}${D}${D}${D}${S}kk.......`; // Belt/details
    grid[21] = `.......kk${P}${P}${P}${P}${P}${P}kk.......`; // Pants start
    grid[22] = `.......kk${P}${P}${P}${P}${P}${P}kk.......`;
    grid[23] = `.......kkkkkkkkkkkk.......`;

    // 3. Draw Legs based on Pose (row 24 to 31)
    if (pose === 'standing') {
      grid[24] = "........kk....kk........";
      grid[25] = `........kk${P}....kk${P}........`;
      grid[26] = `........kk${P}....kk${P}........`;
      grid[27] = `........kk${P}....kk${P}........`;
      grid[28] = "........kk....kk........";
      grid[29] = "........kk....kk........";
      grid[30] = ".......kkkk..kkkk.......";
      grid[31] = ".......kkkk..kkkk.......";
    } 
    else if (pose === 'run1') {
      grid[24] = "........kk....kk........";
      grid[25] = `.......kk${P}.....kk${P}........`;
      grid[26] = `......kk${P}......kk${P}........`;
      grid[27] = `......kk.......kk${P}.......`;
      grid[28] = ".....kk.........kk......";
      grid[29] = ".....kk.........kk......";
      grid[30] = "....kkkk.........kkkk...";
      grid[31] = "....kkkk..........kkkk..";
    } 
    else if (pose === 'run2') {
      grid[24] = "........kk....kk........";
      grid[25] = `........kk${P}.....kk${P}.......`;
      grid[26] = `........kk${P}......kk${P}......`;
      grid[27] = `.......kk${P}.......kk......`;
      grid[28] = "......kk.........kk.....";
      grid[29] = "......kk.........kk.....";
      grid[30] = "...kkkk.........kkkk....";
      grid[31] = "..kkkk..........kkkk....";
    } 
    else if (pose === 'jump') {
      grid[24] = "........kk....kk........";
      grid[25] = `.......kk${P}....kk${P}........`;
      grid[26] = `......kk${P}......kk${P}.......`;
      grid[27] = "......kk........kk......";
      grid[28] = ".....kkkk......kkkk.....";
      grid[29] = ".....kkkk......kkkk.....";
      grid[30] = "........................";
      grid[31] = "........................";
    } 
    else if (pose === 'dash') {
      // Leaning forward body, wind trails
      grid[15] = `....kkkk${S}${S}${S}${S}kkkk........`;
      grid[16] = `...kk${S}${S}kk${S}${S}${S}${S}kk${S}${S}kk.......`;
      grid[17] = `..kk${S}${S}kk${S}${S}${S}${S}kk${S}${S}kk........`;
      grid[18] = `...kkkkkk${S}${S}${S}${S}kkkkkk.......`;
      grid[19] = `.....kk${S}${S}${S}${S}${S}${S}kk.........`;
      grid[20] = `.....kk${S}${D}${D}${D}${D}${S}kk.........`;
      grid[21] = `.....kk${P}${P}${P}${P}${P}${P}kk.........`;
      grid[22] = `.....kk${P}${P}${P}${P}${P}${P}kk.........`;
      grid[23] = `.....kkkkkkkkkkkk.........`;
      grid[24] = "......kk....kk..........";
      grid[25] = `.....kk${P}....kk${P}..........`;
      grid[26] = `....kk${P}......kk${P}.........`;
      grid[27] = "....kk........kk........";
      grid[28] = "....kk........kk........";
      grid[29] = "...kkkk......kkkk.......";
      grid[30] = "........................";
      grid[31] = "........................";
    }

    // Specialize templates slightly for visual differences
    if (colors.hat === 'w' && colors.shirt === 'w') {
      // Uncle Kopiah gets a little grey beard
      grid[12] = "....kkssskkkkkssskk..";
      grid[13] = ".....kkssddddssskk...";
      grid[14] = "......kkkkddkkkk....";
    } else if (colors.hat === 'o') {
      // Tourist gets sunglasses
      grid[10] = "....kksskkkksskkkksskk..";
    } else if (colors.hat === 'p' && id !== 'hagemaru') {
      // FoodPanda rider gets a food bag on back
      grid[16] = `...kkppkk${S}${S}${S}${S}kk${S}${S}kk.....`;
      grid[17] = `...kkppkk${S}${S}${S}${S}kk${S}${S}kk.....`;
      grid[18] = `...kkppkk${S}${S}${S}${S}kkkkkk.....`;
    } else if (id === 'hagemaru') {
      // Bow shape at top
      grid[2] = "............kk...kk.............";
      grid[3] = `...........kk${H}${H}kk${H}${H}kk............`;
      grid[4] = `..........kk${H}${H}${H}${H}${H}${H}${H}${H}kk...........`;
      grid[5] = `..........kk${H}${H}${H}${H}${H}${H}${H}${H}kk...........`;
      grid[6] = `...........kkkk${D}${D}kkkkkk...........`;
      grid[7] = "..........kkkkkkkkkkkkkk........";

      // Twin tails
      grid[8]  = "....kk..kksssssssssssssskk..kk..";
      grid[9]  = "...kkkkkkksssssssssssssskkkkkkk.";
      grid[10] = "..kkkkkkkksskksssssskksskkkkkkkk";
      grid[11] = "..kkkkkkkksssssssssssssskkkkkkkk";
      grid[12] = "..kkkkkkkksssskkkkkksssskkkkkkkk";
      grid[13] = "...kkkkkkksssssssssssssskkkkkkk.";
      grid[14] = "....kkkkkkkkkkkkkkkkkkkkkkkkkk..";

      // Body (dress starts at col 8, ends at 23, dress width is 16)
      grid[15] = `........kkkk${S}${S}${S}${S}kkkk........`;
      grid[16] = `.......kk${S}${S}kk${S}${S}${S}${S}kk${S}${S}kk.......`;
      grid[17] = `.......kk${S}${S}kk${S}${S}${S}${S}kkkk${S}${S}kk......`;
      grid[18] = `.......kkkkkk${S}${S}${S}${S}kkkkkk.......`;
      grid[19] = `.........kk${S}${S}${S}${S}${S}${S}kk.........`;
      grid[20] = `........kk${S}${S}${S}${S}${S}${S}${S}${S}kk........`;
      grid[21] = `.......kk${S}${S}${S}${S}${S}${S}${S}${S}${S}${S}kk.......`;
      grid[22] = `......kk${S}${S}${S}${S}${S}${S}${S}${S}${S}${S}${S}${S}kk......`;
      grid[23] = "......kkkkkkkkkkkkkkkkkk........";

      // Legs
      if (pose === 'standing') {
        grid[24] = "..........kk....kk..............";
        grid[25] = `..........kk${P}....kk${P}..............`;
        grid[26] = `..........kk${P}....kk${P}..............`;
        grid[27] = `..........kk${P}....kk${P}..............`;
        grid[28] = "..........kk....kk..............";
        grid[29] = "..........kk....kk..............";
        grid[30] = ".........kkkk..kkkk.............";
        grid[31] = ".........kkkk..kkkk.............";
      } else if (pose === 'run1') {
        grid[24] = "..........kk....kk..............";
        grid[25] = `.........kk${P}.....kk${P}..............`;
        grid[26] = `........kk${P}......kk${P}..............`;
        grid[27] = `........kk.......kk${P}.............`;
        grid[28] = ".......kk.........kk............";
        grid[29] = ".......kk.........kk............";
        grid[30] = "......kkkk.........kkkk.........";
        grid[31] = "......kkkk..........kkkk........";
      } else if (pose === 'run2') {
        grid[24] = "..........kk....kk..............";
        grid[25] = `..........kk${P}.....kk${P}.............`;
        grid[26] = `..........kk${P}......kk${P}............`;
        grid[27] = `.........kk${P}.......kk............`;
        grid[28] = "........kk.........kk...........";
        grid[29] = "........kk.........kk...........";
        grid[30] = ".....kkkk.........kkkk..........";
        grid[31] = "....kkkk..........kkkk..........";
      } else if (pose === 'jump') {
        grid[24] = "..........kk....kk..............";
        grid[25] = `.........kk${P}....kk${P}..............`;
        grid[26] = `........kk${P}......kk${P}.............`;
        grid[27] = "........kk........kk............";
        grid[28] = ".......kkkk......kkkk...........";
        grid[29] = ".......kkkk......kkkk...........";
      } else if (pose === 'dash') {
        grid[24] = "........kk....kk................";
        grid[25] = `.......kk${P}....kk${P}................`;
        grid[26] = `......kk${P}......kk${P}...............`;
        grid[27] = "......kk........kk..............";
        grid[28] = "......kk........kk..............";
        grid[29] = ".....kkkk......kkkk.............";
      }
    }

    const frameWidth = id === 'hagemaru' ? 32 : 24;
    return this.createCanvasFromGrid(grid, frameWidth, 32);
  },

  // Grab bike: player riding a motorcycle. Size is 32x32
  drawPlayerGrabBike(colors, id) {
    const H = colors.hat;
    const S = colors.shirt;
    const skin = 's';
    const G = 'n'; // Grab Green
    const D = colors.detail; // detail color

    const grid = [
      "................................",
      "..........kkkkk.................",
      ".........kk" + H + H + H + H + "kk................",
      "........kk" + H + H + H + H + H + H + "kk...............",
      ".......kk" + H + H + H + H + H + H + H + H + "kk..............",
      ".......kkkkkkkkkkkkkkkkkk.......",
      "......kksssssssssssssskk........",
      "......kksskksssssskksskk........",
      "......kksssskkkkkksssskk........",
      ".......kksssssssssssskk.........",
      "........kkkkkkkkkkkkkk..........",
      ".........kkkk" + S + S + S + S + "kkkk...........",
      "........kk" + S + S + "kk" + S + S + S + S + "kk" + S + S + "kk..........",
      ".......kk" + S + S + "kk" + S + S + S + S + "kkkkkk...........",
      ".......kkkkkk" + S + S + S + S + "kkkk.............",
      ".........kkkkkkkkkkkk...........",
      "..........kk" + G + G + G + G + "kkk..kk..........", // Motorcycle starts
      "........kkkk" + G + G + G + G + G + "kkkkkkk.........",
      "......kkkk" + G + G + G + G + G + G + G + G + G + "kkkkkk........",
      ".....kkkkkk" + G + G + G + G + G + G + G + G + "kkkkkk.......",
      "....kkkk.kk" + G + G + G + G + G + G + G + G + "kk.kkkk......",
      "....kk...kkkkkkkkkkkkkkkk...kk..",
      ".........kkkkkkkkkkkkkkkk.......",
      ".......kkkkkkkk....kkkkkkkk.....",
      "......kkkkddkkkk..kkkkddkkkk....",
      ".....kkkddddddkkkkkkddddddkkk...",
      ".....kkddkkkkddkkkkddkkkkddkk...",
      ".....kkddkkkkddkkkkddkkkkddkk...",
      ".....kkkddddddkkkkkkddddddkkk...",
      "......kkkkddkkkk..kkkkddkkkk....",
      ".......kkkkkkkk....kkkkkkkk....."
    ];
    if (id === 'hagemaru') {
      grid[1] = "..........kk...kk...............";
      grid[2] = ".........kk" + H + H + "kk" + H + H + "kk.............";
      grid[3] = "........kk" + H + H + H + H + H + H + H + H + "kk...........";
      grid[4] = "........kk" + H + H + H + H + H + H + H + H + "kk...........";
      grid[5] = ".........kkkkk" + D + "kkkkkk..........."; // bow center
      grid[6] = "........kkkkkkkkkkkkkk..........";
      grid[7] = "......kk..kksssssssssssssskk..kk"; // twin tails
      grid[8] = ".....kkkkkkksssssssssssssskkkkkk";
      grid[9] = ".....kkkkkkksskksssssskksskkkkkk";
      grid[10] = ".....kkkkkkksssskkkkkksssskkkkkk";
      grid[11] = "......kkkkkkksssssssssssskkkkkk.";
      grid[12] = ".......kkkkkkkkkkkkkkkkkkkkkk...";
    }

    return this.createCanvasFromGrid(grid, 32, 32);
  },

  generateVehicles() {
    // JAIS Patrol Car (Size: 48x24)
    // Red/blue siren flashing lights on top
    const jaisGrid = [
      "................................................",
      "...................kkkkkk.......................",
      "..................kkrrbbkk......................", // Siren
      ".................kkkkkkkkkk.....................",
      "...............kkkkwwwwwwkkkk...................",
      "..............kkkkwwwwwwwwkkkk..................",
      ".............kkeweeeeeeeeeeewkk.................", // Windshield
      "............kkeweeeeeeeeeeewwkk.................",
      "...........kkkkkkkkkkkkkkkkkkkkkk...............",
      "..........kkwwwwwwwwwwwwwwwwwwwwkk..............",
      "........kkkwwwwwwwwwwwwwwwwwwwwwwkkk............",
      ".......kkwwwwwwwwkkkkkkkkkwwwwwwwwkkk...........",
      "......kkkwwwwwwwkkbbbbbbbbkkwwwwwwwkk...........", // Blue stripes
      "......kkwwwwwwwkkbbbbbbbbbbkkwwwwwwkk...........",
      "......kkwwwwwwwkkbbbbbbbbbbkkwwwwwwkk...........",
      "......kkwwwwwwwkkbbbbbbbbbbkkwwwwwwkk...........",
      "......kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk..........",
      "......kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk..........",
      "........kkkkkkkkkk........kkkkkkkkkk............", // Wheels
      ".......kkkkddddkkkk......kkkkddddkkkk...........",
      "......kkkkddkkddkkkk....kkkkddkkddkkkk..........",
      "......kkkkddkkddkkkk....kkkkddkkddkkkk..........",
      ".......kkkkddddkkkk......kkkkddddkkkk...........",
      "........kkkkkkkkkk........kkkkkkkkkk............"
    ];
    this.jaisCar = this.createCanvasFromGrid(jaisGrid, 48, 24);
  },

  generateCollectibles() {
    // 1. Coconut (Size: 16x16)
    const cocoGrid = [
      "......kkkk......",
      "....kkcccckk....",
      "...kkcccccckk...",
      "..kkcccccccckk..",
      "..kkckkckkckkk..", // 3 holes
      ".kkccccccccckk..",
      ".kkccccccccckk..",
      ".kkccccccccckk..",
      "..kkcccccccckk..",
      "..kkcccccccckk..",
      "...kkcccccckk...",
      "....kkcccckk....",
      "......kkkk......",
      "................",
      "................",
      "................"
    ];
    this.collectibles['coconut'] = this.createCanvasFromGrid(cocoGrid, 16, 16);

    // 2. Nasi Lemak (Size: 16x16)
    // A cute pixel pyramid: green banana leaf, red sambal peak, brown egg slice
    const nasiGrid = [
      "......kk........",
      ".....kkrkk......", // Sambal tip
      "....kkrrkkk.....",
      "....kkrrkkk.....",
      "...kkkkkkkkk....",
      "...kknnnnnnk....", // Green banana leaf wrap
      "..kknnnnnnnnk...",
      "..kknnnnnnnnk...",
      ".kknnnnnnnnnnk..",
      ".kknnnnynnnnnk..", // Yellow rubber band
      "kknnnnnynnnnnnk.",
      "kknnnnnnnnnnnnk.",
      "kkkkkkkkkkkkkkkk",
      "................",
      "................",
      "................"
    ];
    this.collectibles['nasilemak'] = this.createCanvasFromGrid(nasiGrid, 16, 16);

    // 3. Extra Tanjak Crown (Size: 16x16)
    const lifeGrid = [
      "....kk....kk....",
      "...kkkk..kkkk...",
      "..kkbbkkkkbbkk..",
      "..kkbbbbbbbbkk..",
      ".kkbbbbbbbbbbkk.",
      ".kkbbyyyyyybbkk.", // Golden details
      "kkbbyyyyyyyybbkk",
      "kkkkkkkkkkkkkkkk",
      "....kkkkkkkk....",
      ".....kkkkkk.....",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................"
    ];
    this.collectibles['life'] = this.createCanvasFromGrid(lifeGrid, 16, 16);
  },

  generateObstacles() {
    // 1. Traffic Cone (Size: 16x16)
    const coneGrid = [
      "......kk......",
      ".....kkookk....",
      "....kkooookk...",
      "....kkwwookk...",
      "...kkwwwookkk..",
      "...kkwwwookkk..",
      "...kkoooookkk..",
      "..kkooooookkk..",
      "..kkooooookkk..",
      "..kkwwwwwookkk.",
      ".kkwwwwwwookkk.",
      ".kkooooooookkk.",
      "kkooooooooookkk",
      "kkkkkkkkkkkkkkk",
      "................",
      "................"
    ];
    this.obstacles['cone'] = this.createCanvasFromGrid(coneGrid, 16, 16);

    // 2. Clipboard (Size: 16x16)
    const boardGrid = [
      "...kkkkkkkk...",
      "..kkkkddkkkk..", // Silver clip
      ".kkcccccccckk.",
      ".kkcwwwwwwckk.", // White paper on wood clipboard
      "kkcwwwwwwwwckk",
      "kkcwwkkkwwwckk", // Written lines
      "kkcwwwwwwwwckk",
      "kkcwwkkkkwwckk",
      "kkcwwwwwwwwckk",
      "kkcwwkkwwwwckk",
      "kkcwwwwwwwwckk",
      ".kkcccccccckk.",
      "..kkkkkkkkkk..",
      "................",
      "................",
      "................"
    ];
    this.obstacles['clipboard'] = this.createCanvasFromGrid(boardGrid, 16, 16);

    // 3. Cat (Size: 24x16)
    const catGrid = [
      "........................",
      "....kk....kk............",
      "....kkoo..kkoo..........", // Ears
      "...kkoooookkoo..........",
      "...kkoooooooook.........", // Head
      "...kkkkskkkskk..........", // Eyes
      "....kkooookooo..........",
      ".....kkkkkkkkkkkkk......", // Body
      "....kkooooooooookkk.....",
      "....kkoooooooooookkk....", // Tail
      "....kkooooooooookk......",
      "....kkkkkkkkkkkkk.......",
      "....kk..kk..kk..kk......", // Legs
      "....kk..kk..kk..kk......",
      "....kk..kk..kk..kk......",
      "........................"
    ];
    this.obstacles['cat'] = this.createCanvasFromGrid(catGrid, 24, 16);

    // 4. Drain Hole (Gap - size: 32x8)
    const drainGrid = [
      "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
      "kk............................kk",
      "kk..kk..kk..kk..kk..kk..kk..kk..",
      "kk..kk..kk..kk..kk..kk..kk..kk..",
      "kk..kk..kk..kk..kk..kk..kk..kk..",
      "kk..kk..kk..kk..kk..kk..kk..kk..",
      "kk............................kk",
      "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk"
    ];
    this.obstacles['drain'] = this.createCanvasFromGrid(drainGrid, 32, 8);

    // 5. White Myvi (Fast Boss Obstacle - size: 40x20)
    const myviGrid = [
      "........................................",
      "..............kkkkkkkkkk................",
      "............kkkkwwwwwwkkkk..............",
      "..........kkkeweeeeeeeewkkkk............", // Windshield
      ".........kkeweeeeeeeeeeewwkkk...........",
      "........kkkkkkkkkkkkkkkkkkkkkk..........",
      ".......kkwwwwwwwwwwwwwwwwwwkkkk.........",
      ".....kkkwwwwwwwwwwwwwwwwwwwwkkkk........",
      "....kkwwwwwwwwkkkkkkkkwwwwwwwkkkk.......",
      "....kkwwwwwwwkkkkkkkkkkwwwwwwkkkk.......",
      "....kkyywwwwwwwwwwwwwwwwwwwwykkkk.......", // Yellow headlights
      "....kkkkkkkkkkkkkkkkkkkkkkkkkkkk........",
      "......kkkkkkkkkkkkkkkkkkkkkkkk..........",
      ".......kkkkkkkkkk....kkkkkkkkkk.........", // Wheels
      "......kkkkddddkkkk..kkkkddddkkkk........",
      ".....kkkkddkkddkkkkkkkkddkkddkkkk.......",
      ".....kkkkddkkddkkkkkkkkddkkddkkkk.......",
      "......kkkkddddkkkk..kkkkddddkkkk........",
      ".......kkkkkkkkkk....kkkkkkkkkk.........",
      "........................................"
    ];
    this.obstacles['myvi'] = this.createCanvasFromGrid(myviGrid, 40, 20);

    // 6. Motorcycle (Kapcai - size: 24x20)
    const motoGrid = [
      "........................",
      ".........kkkk...........",
      "........kkk..k..........",
      "........kkkkkk..........",
      ".........kkkk...........", // Rider head
      "......kkkddddkkk........",
      ".....kkddrddrddkk.......", // Red shirt
      ".....kkddddddddkk.......",
      ".....kkkkkkkkkkkk.......",
      "......kkkkddkkk.........",
      ".....kkkkooookkk........", // Motorcycle body
      "....kkkkoooooookk.......",
      "....kkkkkkkkkkkkk.......",
      "....kkkk.....kkkk.......",
      "...kkkkkk...kkkkkk......", // Wheels
      "..kkkdddkkkkkkdddkkk....",
      "..kkddkkddkkddkkddkk....",
      "..kkkdddkkkkkkdddkkk....",
      "...kkkkkk...kkkkkk......",
      "........................"
    ];
    this.obstacles['motorcycle'] = this.createCanvasFromGrid(motoGrid, 24, 20);

    // 7. Pothole (Gap/Obstacle - size: 24x10)
    const potholeGrid = [
      "......kkkkkkkkkk........",
      "....kkkkggggggkkkk......",
      "..kkkkggggggggggkkkk....",
      "kkkkggggggggggggggkkkk..",
      "kkkkggggggggggggggkkkk..",
      "..kkkkggggggggggkkkk....",
      "....kkkkggggggkkkk......",
      "......kkkkkkkkkk........",
      "........................",
      "........................"
    ];
    this.obstacles['pothole'] = this.createCanvasFromGrid(potholeGrid, 24, 10);

    // 8. Kenduri Table (Size: 32x20)
    const tableGrid = [
      "................................",
      "....kkkkkkkkkkkkkkkkkkkkkkkk....",
      "...kkrrrrrrrrrrrrrrrrrrrrrrkk...", // Red table cloth
      "..kkrrrrrrrrrrrrrrrrrrrrrrrrkk..",
      ".kkrrrrrrrrrrrrrrrrrrrrrrrrrrkk.",
      "kkrrrrrrrrrrrrrrrrrrrrrrrrrrrrkk",
      "kkrrkkkkkkkkkkkkkkkkkkkkkkkkrrkk",
      "kkrkk......................kkrkk",
      "kkkk........................kkkk",
      "kk............................kk", // Table legs
      "kk............................kk",
      "kk............................kk",
      "kk............................kk",
      "kk............................kk",
      "kk............................kk",
      "kk............................kk",
      "kk............................kk",
      "................................",
      "................................",
      "................................"
    ];
    this.obstacles['kenduri'] = this.createCanvasFromGrid(tableGrid, 32, 20);

    // 9. Slippers pile (Size: 24x12)
    const slippersGrid = [
      "........................",
      ".........kkkk...........",
      ".......kkbbbbkk.........", // Blue slipper
      "......kkbbbbbbkk..kkkk..",
      "..kkk.kkbkkbbkkkkrrrrkk.", // Blue + red pair
      ".kkoookkkkkkkkrrrrrrrkk.", // Orange pair
      ".kkoooooookkrrrrrrrrrkk.",
      "kkooooooookkrrrrkkrrkk..",
      "kkookkooookkkkkkkkkkk...",
      "kkkkkkkkkk..............",
      "........................",
      "........................"
    ];
    this.obstacles['slippers'] = this.createCanvasFromGrid(slippersGrid, 24, 12);

    // 10. Durian (Falling - size: 16x16)
    const durianGrid = [
      "......kkkk......",
      "....kknnnnkk....",
      "...kknnnnnnkk...",
      "..kknynnnynynk..", // Thorny details (yellow)
      "..knynynynynynk.",
      ".kynynynynynynyk",
      ".knynynynynynynk",
      ".kynynynynynynyk",
      ".knynynynynynynk",
      "..knynynynynynk.",
      "..kknynnnynynk..",
      "...kknnnnnnkk...",
      "....kknnnnkk....",
      "......kkkk......",
      "................",
      "................"
    ];
    this.obstacles['durian'] = this.createCanvasFromGrid(durianGrid, 16, 16);
  },

  generateDecorations() {
    // 1. Nasi Lemak Stall (Victory state - size: 64x48)
    const stallGrid = [
      "................................................................",
      ".....................kkkkkkkkkkkkkkkkkk.........................",
      "...................kknyynyynyynyynyynynkk.......................", // Canopy (Green/Yellow)
      ".................kknyynyynyynyynyynyynyynkk.....................",
      "...............kknyynyynyynyynyynyynyynyynyynkk.................",
      ".............kknyynyynyynyynyynyynyynyynyynyynynkk..............",
      ".............kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk..............",
      ".............kk.................................kk..............",
      ".............kk...kkkkkkkkkkkkkkkkkkkkkkkkkkk...kk..............",
      ".............kk..kkwwwwwwwwwwwwwwwwwwwwwwwwwkk..kk..............", // Signboard
      ".............kk..kkwkkkwwwkkkwwkkkwwwkwwwkwwkk..kk..............", // "NASI LEMAK" text
      ".............kk..kkwwwwwwwwwwwwwwwwwwwwwwwwwkk..kk..............",
      ".............kk...kkkkkkkkkkkkkkkkkkkkkkkkkkk...kk..............",
      ".............kk.................................kk..............",
      ".............kk.................................kk..............",
      "......kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk......", // Counter starts
      "....kkcccccccccccccccccccccccccccccccccccccccccccccccccccckk....",
      "....kkcccccccccccccccccccccccccccccccccccccccccccccccccccckk....",
      "....kkcckkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkcckk....",
      "....kkcckk............................................kkcckk....",
      "....kkcckk....kknnnkkk......kkkrrkkk.....kkkkk........kkcckk....", // Food plates (banana leaf, sambal)
      "....kkcckk...kknnnnnnkk....kkrrrrrrkk...kkwwwkk.......kkcckk....",
      "....kkcckk...kkkkkkkkkk....kkkkkkkkkk...kkkkkkk.......kkcckk....",
      "....kkcckk............................................kkcckk....",
      "....kkcckkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkcckk....",
      "....kkcccccccccccccccccccccccccccccccccccccccccccccccccccckk....",
      "....kkcccccccccccccccccccccccccccccccccccccccccccccccccccckk....",
      "....kkcc................................................cckk....",
      "....kkcc................................................cckk....",
      "....kkcc................................................cckk....",
      "....kkcc................................................cckk....",
      "....kkcc................................................cckk....",
      "....kkcc................................................cckk....",
      "....kkkk................................................kkkk...."
    ];
    this.decorations['stall'] = this.createCanvasFromGrid(stallGrid, 64, 48);

    // 2. Mamak Table & Chairs (Victory State - size: 48x32)
    const mamakGrid = [
      "................................................",
      "..................kkkkkkkkkkkk..................",
      ".................kkyyyyyyyyyyyk.................", // Yellow table
      "................kkyyyyyyyyyyyyyk................",
      "...............kkyyyyyyyyyyyyyyyk...............",
      "...............kkkkkkkkkkkkkkkkkk...............",
      ".....................kkkk.......................", // Table leg
      ".....................kkkk.......................",
      ".....................kkkk.......................",
      ".....................kkkk.......................",
      ".....................kkkk.......................",
      "...................kkkkkkkk.....................",
      "..................kkkkkkkkkk....................",
      ".....kkkk..................................kkkk.", // Blue chairs (tilted)
      "....kkbbkk................................kkbbkk",
      "....kkbbkk................................kkbbkk",
      "....kkbbbbkk............................kkbbbbkk",
      "....kkbbbbkk............................kkbbbbkk",
      "....kkbbbbbbkk........................kkbbbbbbkk",
      "....kkkkkkkkkk........................kkkkkkkkkk",
      "......kk..kk............................kk..kk..",
      "......kk..kk............................kk..kk..",
      "......kk..kk............................kk..kk..",
      "......kk..kk............................kk..kk.."
    ];
    this.decorations['mamak_table'] = this.createCanvasFromGrid(mamakGrid, 48, 32);

    // 3. Mak Cik (Shield Powerup character - size: 24x32)
    const makCikGrid = [
      "........kkkkk...........",
      "......kknnnnnnkk........", // Hijab / Baju Kurung (Green)
      ".....kknnnnnnnnkk.......",
      "....kknnnnnnnnnnkk......",
      "....kknnnssssnnnkk......", // Face showing
      "....kknssssssssnkk......",
      "....kknsskksskksskk.....", // Eyes
      "....kknssssssssskk......",
      "....kknssssssssskk......",
      ".....kknnnssssnnkk......",
      "......kkkknnnnkkk.......",
      "......kknnnnnnnnkk......", // Body
      ".....kknnnnnnnnnnkk.....",
      "....kknnnnnnnnnnnnkk....",
      "....kknnnnnnnnnnnnkk....",
      "....kknnnnkkkknnnnkk....",
      "....kknnnkk..kknnnkk....",
      "....kknnnk....knnnk.....",
      ".....kkkkk....kkkkk.....",
      "........................"
    ];
    this.decorations['makcik'] = this.createCanvasFromGrid(makCikGrid, 24, 32);
  }
};
