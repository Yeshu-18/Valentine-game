/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Lightweight Web Audio synthesizer for the Romantic Midway / Carnival District.
 * Provides gentle, warm sound effects for booth games, prize reveals,
 * nostalgic carousel music-box notes, and Quiet Garden water ambience.
 */
export class CarnivalAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private carouselInterval: number | null = null;
  private carouselStep = 0;
  private isDisposed = false;

  private initContext() {
    if (this.ctx || this.isDisposed) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.65, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch {
      // Ignore if AudioContext is blocked
    }
  }

  public ensureRunning() {
    this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Plays a soft wooden dart/toss pop when the player fires or throws.
   */
  public playLaunchPop(baseFreq = 320) {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.65, now + 0.09);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /**
   * Plays a warm bell chime when a target is hit or a ring lands on a peg.
   */
  public playTargetHitChime(stepIndex = 0) {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
    const freq = notes[stepIndex % notes.length];
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.8);
  }

  /**
   * Plays a playful spring boing for the Frog Launch booth.
   */
  public playFrogBoing() {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.22);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  /**
   * Plays a gentle mechanical gear-turn click sequence for the Mystery Egg Machine.
   */
  public playMechanicalTurn() {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;
    const clicks = [0, 0.14, 0.28, 0.44, 0.62];
    clicks.forEach((delay, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240 + idx * 35, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.075, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.09);
    });
  }

  /**
   * Plays a warm, rewarding music-box arpeggio when a carnival game is won and a prize is revealed.
   */
  public playPrizeRevealArpeggio() {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;
    const chord = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C5 E5 G5 C6 E6
    chord.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime + idx * 0.11;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.085, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.45);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 1.5);
    });
  }

  /**
   * Plays a celebratory win chime sequence when any carnival game is won.
   */
  public playWinFanfare() {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;
    const notes = [587.33, 739.99, 880.0, 1174.66]; // D5, F#5, A5, D6
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.09, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 1.0);
    });
  }

  /**
   * Heartshot Prize: Metallic token roll and spring bounce chime.
   */
  public playTokenBounce() {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [1046.5, 1318.51, 1567.98].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.7);
    });
  }

  /**
   * Ring Toss Prize: Magnetic click as H + Y charms snap together.
   */
  public playMagneticClick() {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Sharp metallic impact click
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1420, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.04);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.14);

    // Warm resonant ring
    const ringOsc = this.ctx.createOscillator();
    const ringGain = this.ctx.createGain();
    ringOsc.type = 'sine';
    ringOsc.frequency.setValueAtTime(880, now + 0.01);
    ringGain.gain.setValueAtTime(0.001, now + 0.01);
    ringGain.gain.linearRampToValueAtTime(0.08, now + 0.03);
    ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
    ringOsc.connect(ringGain);
    ringGain.connect(this.masterGain);
    ringOsc.start(now + 0.01);
    ringOsc.stop(now + 0.9);
  }

  /**
   * Prize Knockdown: Soft paper card lift & gentle memory chime.
   */
  public playCardFlutter() {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [659.25, 880.0, 1174.66].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.07, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 1.15);
    });
  }

  /**
   * Frog Launch Prize: Cute frog hop, squash & cheerful squeak-croak.
   */
  public playFrogHopSquash() {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.24);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.34);

    // Cute high bell chime on landing
    const bellOsc = this.ctx.createOscillator();
    const bellGain = this.ctx.createGain();
    bellOsc.type = 'triangle';
    bellOsc.frequency.setValueAtTime(987.77, now + 0.18);
    bellGain.gain.setValueAtTime(0.001, now + 0.18);
    bellGain.gain.linearRampToValueAtTime(0.08, now + 0.21);
    bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
    bellOsc.connect(bellGain);
    bellGain.connect(this.masterGain);
    bellOsc.start(now + 0.18);
    bellOsc.stop(now + 0.8);
  }

  /**
   * Mystery Egg Prize: Egg crack wobble and celebratory pop.
   */
  public playEggPopConfetti() {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Soft pop
    const popOsc = this.ctx.createOscillator();
    const popGain = this.ctx.createGain();
    popOsc.type = 'triangle';
    popOsc.frequency.setValueAtTime(420, now);
    popOsc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
    popGain.gain.setValueAtTime(0.001, now);
    popGain.gain.linearRampToValueAtTime(0.14, now + 0.008);
    popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    popOsc.connect(popGain);
    popGain.connect(this.masterGain);
    popOsc.start(now);
    popOsc.stop(now + 0.16);

    // Crystalline shimmer
    [783.99, 1046.5, 1318.51, 1567.98].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + 0.04 + idx * 0.05;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.065, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.9);
    });
  }

  /**
   * Carousel Prize: Nostalgic carousel mini music box chime.
   */
  public playCarouselMusicBoxChime() {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const melody = [523.25, 659.25, 783.99, 1046.5, 880.0, 783.99];
    melody.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.13;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.065, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.82);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.85);
    });
  }

  /**
   * Ferris Wheel Prize: Crisp parchment fold & golden ticket shimmer.
   */
  public playTicketUnfold() {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [440.0, 554.37, 659.25, 880.0].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.11;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.075, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 1.3);
    });
  }

  /**
   * Quiet Garden Prize: Delicate blossoming flower chime with ethereal overtone.
   */
  public playFlowerBloomBell() {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [587.33, 739.99, 987.77, 1318.51].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.07, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 1.65);
    });
  }

  /**
   * Quiet personal message accent bell when the 3D world-space text plaque wipes in.
   */
  public playMessageRevealAccent() {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, now); // High C6
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 1.85);
  }

  /**
   * Starts a gentle, nostalgic waltz music-box melody while riding or activating the Carousel.
   */
  public startCarouselMusicBox() {
    this.ensureRunning();
    this.stopCarouselMusicBox();
    if (!this.ctx || !this.masterGain) return;

    // Gentle 3/4 waltz notes in F Major
    const waltzNotes = [
      349.23, 523.25, 440.0, // F4 C5 A4
      392.0, 587.33, 523.25, // G4 D5 C5
      440.0, 659.25, 587.33, // A4 E5 D5
      523.25, 440.0, 392.0, // C5 A4 G4
    ];
    this.carouselStep = 0;

    const playNextWaltzNote = () => {
      if (!this.ctx || !this.masterGain || this.isDisposed) return;
      const freq = waltzNotes[this.carouselStep % waltzNotes.length];
      const isDownbeat = this.carouselStep % 3 === 0;
      this.carouselStep += 1;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = isDownbeat ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(isDownbeat ? 0.065 : 0.045, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.75);
    };

    playNextWaltzNote();
    this.carouselInterval = window.setInterval(playNextWaltzNote, 480);
  }

  public stopCarouselMusicBox() {
    if (this.carouselInterval !== null) {
      window.clearInterval(this.carouselInterval);
      this.carouselInterval = null;
    }
  }

  public dispose() {
    this.isDisposed = true;
    this.stopCarouselMusicBox();
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {
        // ignore
      }
      this.ctx = null;
    }
  }
}
