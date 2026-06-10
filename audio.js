/**
 * JAIS Escape! - 8-Bit Web Audio Synthesizer
 * 
 * Synthesizes retro sounds and loops background chiptunes dynamically in real-time.
 * No external audio files are needed.
 */

const GameAudio = {
  ctx: null,
  bgmInterval: null,
  musicTempo: 120, // BPM
  isPlayingMusic: false,
  isMuted: false,
  masterVolume: 0.25,

  // Node references
  masterGain: null,
  bgmGain: null,

  // Step sequencer variables for BGM
  currentStep: 0,
  nextNoteTime: 0,
  scheduleAheadTime: 0.15, // seconds (slightly increased for better stability)
  lookahead: 25.0, // ms
  seqInterval: null,

  // Melody and bass sequences (Am - G - F - E progression, standard minor climb)
  // 16 steps per bar
  seqBass: [
    'A2', 'A2', 'A2', 'A2', 'G2', 'G2', 'G2', 'G2',
    'F2', 'F2', 'F2', 'F2', 'E2', 'E2', 'E2', 'E2'
  ],
  seqMelody: [
    'A4', 'C5', 'E5', 'A5', 'G4', 'B4', 'D5', 'G5',
    'F4', 'A4', 'C5', 'F5', 'E4', 'G#4', 'B4', 'E5'
  ],

  // Note frequency map
  noteFreqs: {
    'A2': 110.00, 'G2': 98.00, 'F2': 87.31, 'E2': 82.41,
    'A3': 220.00, 'G3': 196.00, 'F3': 174.61, 'E3': 164.81, 'G#3': 207.65,
    'A4': 440.00, 'B4': 493.88, 'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F4': 349.23, 'G4': 392.00,
    'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77, 'C6': 1046.50, 'G#4': 415.30
  },

  init() {
    // AudioContext is initialized on user interaction to comply with browser autoplay policies
    window.addEventListener('click', () => this.initContext(), { once: true });
    window.addEventListener('keydown', () => this.initContext(), { once: true });
    window.addEventListener('touchstart', () => this.initContext(), { once: true });
  },

  initContext() {
    if (this.ctx) return;
    
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
      
      // Setup gain nodes
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(0.5, this.ctx.currentTime); // Half volume for background music
      this.bgmGain.connect(this.masterGain);

      console.log("Web Audio Context Initialized.");
    } catch (e) {
      console.warn("Web Audio API not supported in this browser:", e);
    }
  },

  resumeContext() {
    if (this.ctx && this.ctx.state === 'suspended') {
      return this.ctx.resume();
    }
    return Promise.resolve();
  },

  setMute(mute) {
    this.isMuted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(mute ? 0 : this.masterVolume, this.ctx.currentTime);
    }
  },

  // 1. Jump Sound: "Hoi!" (Quick upward pulse sweep)
  playJump() {
    this.initContext();
    this.resumeContext();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle'; // Retro, slightly hollow sound
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // "Hoi!" upward sweep

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.16);
  },

  // 2. Collect Sound: "Sedap!" (Double rising chime arpeggio)
  playCollect() {
    this.initContext();
    this.resumeContext();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    
    // Note 1 (E5)
    this.playTone(659.25, 'square', 0.06, 0.3, now);
    // Note 2 (A5)
    this.playTone(880.00, 'square', 0.06, 0.3, now + 0.06);
    // Note 3 (C6)
    this.playTone(1046.50, 'square', 0.15, 0.4, now + 0.12);
  },

  // Helper to play a single synth note
  playTone(freq, type, duration, volume, time) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration - 0.01);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + duration);
  },

  // 3. Hit Obstacle Sound: "Aduh!" (Aggressive crash noise & pitch drop)
  playHit() {
    this.initContext();
    this.resumeContext();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    
    // Sub-oscillator for bass thump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.linearRampToValueAtTime(40, now + 0.25);

    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.26);

    // Simulated explosion noise using white noise buffer
    try {
      const bufferSize = this.ctx.sampleRate * 0.25; // 0.25s duration
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      // Filter for crunchiness
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 400;

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.5, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      noise.start(now);
      noise.stop(now + 0.25);
    } catch(e) {
      // Fallback if buffer creation fails
    }
  },

  // 4. Game Over: Sad Kompang (Two kompang drums followed by descending minor scale)
  playGameOver() {
    this.stopMusic();
    this.initContext();
    this.resumeContext();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;

    // Kompang hit emulator (Short high pitch slap + resonance)
    const playKompangHit = (time, accent) => {
      // Slap sound (high-passed noise)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(accent ? 130 : 95, time);
      osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);

      gain.gain.setValueAtTime(accent ? 0.7 : 0.45, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(time);
      osc.stop(time + 0.13);
    };

    // Sequence the sad kompang roll
    playKompangHit(now, true);      // "Pak!"
    playKompangHit(now + 0.18, false); // "Dung!"
    playKompangHit(now + 0.36, true);  // "Pak!"
    playKompangHit(now + 0.54, false); // "Dung!"

    // Descending sad minor notes (failing theme)
    // A3 -> G3 -> F3 -> E3
    const startNoteTime = now + 0.8;
    this.playTone(this.noteFreqs['A3'], 'triangle', 0.25, 0.4, startNoteTime);
    this.playTone(this.noteFreqs['G3'], 'triangle', 0.25, 0.4, startNoteTime + 0.3);
    this.playTone(this.noteFreqs['F3'], 'triangle', 0.25, 0.4, startNoteTime + 0.6);
    this.playTone(this.noteFreqs['E3'], 'sawtooth', 0.6, 0.3, startNoteTime + 0.9);
  },

  // 5. Victory Sound: Happy Folk tune (Digital "Rasa Sayang" hook)
  playVictory() {
    this.stopMusic();
    this.initContext();
    this.resumeContext();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    
    // Notes: C5, D5, E5, C5, E5, D5, C5, G4, C5, D5, E5, C5, D5, G5, G5... (Happy folk vibe)
    const melody = [
      { f: 'C5', d: 0.15 }, { f: 'D5', d: 0.15 }, { f: 'E5', d: 0.3 }, 
      { f: 'C5', d: 0.15 }, { f: 'E5', d: 0.15 }, { f: 'D5', d: 0.3 },
      { f: 'C5', d: 0.15 }, { f: 'G4', d: 0.15 }, { f: 'C5', d: 0.3 },
      { f: 'D5', d: 0.15 }, { f: 'E5', d: 0.15 }, { f: 'C5', d: 0.15 },
      { f: 'D5', d: 0.15 }, { f: 'G5', d: 0.4 }
    ];

    let accumTime = now;
    melody.forEach(note => {
      this.playTone(this.noteFreqs[note.f], 'square', note.d, 0.35, accumTime);
      accumTime += note.d + 0.02;
    });
  },

  // 7. UI Sounds: Hover and Select
  playHover() {
    this.initContext();
    this.resumeContext();
    if (this.isMuted || !this.ctx) return;
    this.playTone(880, 'sine', 0.05, 0.1, this.ctx.currentTime);
  },

  playSelect() {
    this.initContext();
    this.resumeContext();
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.playTone(660, 'square', 0.05, 0.2, now);
    this.playTone(1320, 'square', 0.05, 0.2, now + 0.05);
  },

  // 6. Background Music Loop scheduler (16-step sequencer)
  startMusic() {
    this.initContext();
    this.resumeContext().then(() => {
      if (this.isPlayingMusic || !this.ctx) return;

      this.isPlayingMusic = true;
      this.currentStep = 0;
      this.nextNoteTime = this.ctx.currentTime + 0.1; // Small buffer to ensure first note plays
      this.musicTempo = 130; // standard speed

      if (this.bgmGain) {
        this.bgmGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      }

      // Start the clock ticker
      if (this.seqInterval) clearInterval(this.seqInterval);
      this.seqInterval = setInterval(() => {
        this.scheduler();
      }, this.lookahead);
    });
  },

  stopMusic() {
    this.isPlayingMusic = false;
    if (this.seqInterval) {
      clearInterval(this.seqInterval);
      this.seqInterval = null;
    }
  },

  // Speed up music tempo during Teh Tarik Boost
  setMusicSpeed(fast) {
    this.musicTempo = fast ? 180 : 130;
  },

  scheduler() {
    if (!this.ctx || !this.isPlayingMusic) return;

    // Safety: If sequencer falls behind (e.g. tab suspended), catch up
    if (this.nextNoteTime < this.ctx.currentTime) {
      this.nextNoteTime = this.ctx.currentTime;
    }

    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNextNote(this.currentStep, this.nextNoteTime);
      
      // Advance step time
      const secondsPerBeat = 60.0 / this.musicTempo;
      const stepDuration = 0.25 * secondsPerBeat; // 16th note steps
      this.nextNoteTime += stepDuration;

      // Advance sequence counter (16 steps total)
      this.currentStep = (this.currentStep + 1) % 16;
    }
  },

  scheduleNextNote(step, time) {
    if (this.isMuted) return;

    // Bass note trigger (Every step)
    const bassNote = this.seqBass[step];
    if (bassNote && this.noteFreqs[bassNote]) {
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();

      bassOsc.type = 'triangle'; // Clean round bass
      bassOsc.frequency.setValueAtTime(this.noteFreqs[bassNote], time);

      // Add a slight envelope
      bassGain.gain.setValueAtTime(0.4, time);
      bassGain.gain.exponentialRampToValueAtTime(0.01, time + 0.18);

      bassOsc.connect(bassGain);
      bassGain.connect(this.bgmGain);

      bassOsc.start(time);
      bassOsc.stop(time + 0.2);
    }

    // Melody note trigger (Trigger on steps 0, 2, 4, 6, 8, 10, 12, 14 - eighth notes)
    if (step % 2 === 0) {
      const melNote = this.seqMelody[step];
      if (melNote && this.noteFreqs[melNote]) {
        const melOsc = this.ctx.createOscillator();
        const melGain = this.ctx.createGain();

        melOsc.type = 'square'; // Classic chiptune sound
        melOsc.frequency.setValueAtTime(this.noteFreqs[melNote], time);

        melGain.gain.setValueAtTime(0.18, time);
        melGain.gain.exponentialRampToValueAtTime(0.01, time + 0.22);

        melOsc.connect(melGain);
        melGain.connect(this.bgmGain);

        melOsc.start(time);
        melOsc.stop(time + 0.25);
      }
    }

    // Retro percussion: Simulated high-hat clicking (Steps 4, 12, etc.)
    if (step % 4 === 2) {
      const clickOsc = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();

      clickOsc.type = 'sawtooth';
      clickOsc.frequency.setValueAtTime(10000, time); // High pitched noise burst

      clickGain.gain.setValueAtTime(0.03, time);
      clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

      clickOsc.connect(clickGain);
      clickGain.connect(this.bgmGain);

      clickOsc.start(time);
      clickOsc.stop(time + 0.05);
    }
  }
};

// Start listener
GameAudio.init();
