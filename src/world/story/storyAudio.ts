/**
 * Procedural Web Audio synthesizer for the Prequel ("Cell 04: The Awakening")
 * and Sequel ("The Private Romantic World" behind the Special Gate).
 * Zero external audio asset dependencies; respects browser autoplay rules.
 */

export class StoryAudioSynthesizer {
  private ctx: AudioContext | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
        } catch {
          return null;
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    duration: number,
    delay: number,
    type: OscillatorType,
    peakGain: number,
    endFreq?: number,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, endFreq),
        now + duration,
      );
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + Math.min(0.04, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /**
   * Subtle late-night phone vibration + SMS chime ("Are you home yet?", "Almost there.")
   */
  public playPhoneMessageCue(): void {
    this.playTone(135, 0.14, 0.0, 'sawtooth', 0.035);
    this.playTone(135, 0.14, 0.18, 'sawtooth', 0.035);
    this.playTone(587.33, 0.28, 0.36, 'sine', 0.06);
    this.playTone(880.0, 0.42, 0.48, 'sine', 0.07);
  }

  /**
   * Low suspenseful pulse when the dark car approaches in Scene 2.
   */
  public playSuspensePulse(): void {
    this.playTone(65.41, 1.4, 0.0, 'triangle', 0.08, 48.99);
    this.playTone(98.0, 1.2, 0.15, 'sine', 0.05, 73.42);
  }

  /**
   * Vintage rotary telephone dual-bell mechanical ring inside Cell 04.
   */
  public playRotaryPhoneRing(): void {
    for (let i = 0; i < 6; i++) {
      const offset = i * 0.065;
      this.playTone(1180, 0.045, offset, 'triangle', 0.055);
      this.playTone(1480, 0.045, offset + 0.03, 'sine', 0.045);
    }
  }

  /**
   * Mechanical receiver lift + overhead tungsten lamp flicker relay click.
   */
  public playPhonePickupAndFlicker(): void {
    this.playTone(220, 0.06, 0.0, 'square', 0.04, 140);
    this.playTone(92, 0.55, 0.12, 'sawtooth', 0.045, 60);
    this.playTone(440, 0.18, 0.08, 'sine', 0.04);
  }

  /**
   * Tactile clue / photograph inspection sound.
   */
  public playClueInspectCue(): void {
    this.playTone(392.0, 0.32, 0.0, 'sine', 0.055);
    this.playTone(587.33, 0.48, 0.12, 'triangle', 0.045);
  }

  /**
   * Warm, nostalgic felt-piano chord when entering one of the 3 relationship memories.
   */
  public playMemoryChord(memoryIndex: 1 | 2 | 3): void {
    const chords: Record<1 | 2 | 3, number[]> = {
      1: [261.63, 329.63, 392.0, 493.88], // Cmaj7 — Project Hail Mary
      2: [293.66, 369.99, 440.0, 587.33], // Dadd9 — The Pinky Moment
      3: [349.23, 440.0, 523.25, 659.25], // Fmaj7 — The Confession
    };
    const notes = chords[memoryIndex];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 1.6, idx * 0.14, 'sine', 0.065);
      this.playTone(freq * 0.5, 1.8, idx * 0.14, 'triangle', 0.03);
    });
  }

  /**
   * Heavy steel door bolt unlatching in Cell 04 (Scene 10).
   */
  public playSteelDoorUnlock(): void {
    this.playTone(145, 0.12, 0.0, 'square', 0.06, 95);
    this.playTone(110, 0.25, 0.16, 'sawtooth', 0.055, 72);
    this.playTone(293.66, 0.7, 0.42, 'sine', 0.06);
  }

  /**
   * Shimmering romantic harp arpeggio when the blindfold is removed in Scene 12 ("I built you a world").
   */
  public playDreamWorldRevealSwell(): void {
    const harpNotes = [
      261.63, 329.63, 392.0, 493.88, 523.25, 659.25, 783.99, 1046.5,
    ];
    harpNotes.forEach((freq, idx) => {
      this.playTone(freq, 1.8, idx * 0.11, 'sine', 0.075);
      this.playTone(freq * 0.5, 2.1, idx * 0.11, 'triangle', 0.035);
    });
  }

  /**
   * Ethereal chime when crossing the Special Gate into the Private Romantic World.
   */
  public playSpecialGatePortalChime(): void {
    const portalNotes = [440.0, 554.37, 659.25, 880.0, 1108.73];
    portalNotes.forEach((freq, idx) => {
      this.playTone(freq, 1.5, idx * 0.14, 'sine', 0.07);
    });
  }

  /**
   * Intimate warm chord progression for moments inside the Private Romantic World.
   */
  public playIntimateMomentChord(stepIndex: number): void {
    const progressions = [
      [261.63, 329.63, 493.88, 587.33],
      [220.0, 329.63, 440.0, 523.25],
      [349.23, 440.0, 523.25, 659.25],
      [392.0, 493.88, 587.33, 783.99],
    ];
    const chord = progressions[stepIndex % progressions.length];
    chord.forEach((freq, idx) => {
      this.playTone(freq, 1.75, idx * 0.15, 'sine', 0.06);
    });
  }

  /**
   * Soft, crystalline water-touch ripple sound when Harsha touches the Reflective Pond water.
   */
  public playWaterTouchCue(): void {
    this.playTone(523.25, 0.24, 0.0, 'sine', 0.048, 659.25);
    this.playTone(783.99, 0.36, 0.08, 'sine', 0.042, 987.77);
    this.playTone(1046.5, 0.48, 0.16, 'triangle', 0.03, 1318.51);
  }

  /**
   * Quiet, resonant stone-contact & water-lap chime when stepping onto a pond stepping stone.
   */
  public playSteppingStoneCue(stoneIndex: number): void {
    const pentatonicScale = [
      392.0, 440.0, 493.88, 587.33, 659.25, 783.99, 880.0,
    ];
    const freq =
      pentatonicScale[Math.abs(stoneIndex) % pentatonicScale.length];
    this.playTone(165.0, 0.11, 0.0, 'triangle', 0.036, 118.0);
    this.playTone(freq, 0.42, 0.03, 'sine', 0.038, freq * 1.015);
  }

  /**
   * Subtle brass & crystalline starlight chime when entering or exiting telescope mode.
   */
  public playTelescopeToggleCue(entering: boolean): void {
    if (entering) {
      this.playTone(440.0, 0.22, 0.0, 'sine', 0.042);
      this.playTone(659.25, 0.38, 0.09, 'sine', 0.048);
      this.playTone(880.0, 0.65, 0.18, 'triangle', 0.036);
    } else {
      this.playTone(659.25, 0.24, 0.0, 'sine', 0.038);
      this.playTone(440.0, 0.35, 0.08, 'sine', 0.035);
    }
  }

  /**
   * Gentle warm timber/cloth settle sound when sitting on the loveseat or pond bench.
   */
  public playSeatToggleCue(sitting: boolean): void {
    if (sitting) {
      this.playTone(293.66, 0.28, 0.0, 'triangle', 0.038, 246.94);
      this.playTone(440.0, 0.55, 0.1, 'sine', 0.042);
    } else {
      this.playTone(329.63, 0.24, 0.0, 'sine', 0.035);
    }
  }

  private grottoStarted = false;
  private waterfallSource: AudioBufferSourceNode | null = null;
  private waterfallFilter: BiquadFilterNode | null = null;
  private waterfallGain: GainNode | null = null;
  private cavernOsc1: OscillatorNode | null = null;
  private cavernOsc2: OscillatorNode | null = null;
  private cavernDroneGain: GainNode | null = null;
  private lastDropletTime = 0;

  private ensureGrottoNodes(ctx: AudioContext): void {
    if (this.grottoStarted) return;
    this.grottoStarted = true;

    // 1. Looping brown/pink filtered noise buffer for the subterranean waterfall cascade
    const bufferSize = ctx.sampleRate * 3;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.045 * white) / 1.045;
      lastOut = output[i];
      output[i] *= 2.4;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;

    const wGain = ctx.createGain();
    wGain.gain.value = 0.0001;

    noiseSource.connect(filter);
    filter.connect(wGain);
    wGain.connect(ctx.destination);
    noiseSource.start();

    this.waterfallSource = noiseSource;
    this.waterfallFilter = filter;
    this.waterfallGain = wGain;

    // 2. Warm subterranean acoustic resonance (82.41 Hz E2 + 123.47 Hz B2)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const droneGain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.value = 82.41;
    osc2.type = 'triangle';
    osc2.frequency.value = 123.47;
    droneGain.gain.value = 0.0001;

    osc1.connect(droneGain);
    osc2.connect(droneGain);
    droneGain.connect(ctx.destination);

    osc1.start();
    osc2.start();

    this.cavernOsc1 = osc1;
    this.cavernOsc2 = osc2;
    this.cavernDroneGain = droneGain;
  }

  /**
   * Updates positional environmental audio for the Hidden Grotto:
   * - Scales waterfall sound volume & high-frequency presence with proximity to (-16.5, 3.15, 150.5)
   * - Fades in warm subterranean acoustic resonance when inside the tunnel or cavern
   * - Plays gentle stochastic water-droplet chimes inside the cavern
   */
  public updateGrottoAmbience(
    playerX: number,
    playerY: number,
    playerZ: number,
    isMuted: boolean,
  ): void {
    const isUnderground = playerY < 11.8 && playerZ > 55.2;
    if (!isUnderground && !this.grottoStarted) return;

    const ctx = this.ensureContext();
    if (!ctx) return;

    this.ensureGrottoNodes(ctx);
    const now = ctx.currentTime;

    if (isMuted || !isUnderground) {
      this.waterfallGain?.gain.setTargetAtTime(0.0001, now, 0.25);
      this.cavernDroneGain?.gain.setTargetAtTime(0.0001, now, 0.25);
      return;
    }

    // Depth factor from tunnel threshold (Z = 55.5) into the main cavern (Z >= 66)
    const tunnelDepthFactor = Math.min(
      1.0,
      Math.max(0.0, (playerZ - 55.5) / 10.5),
    );

    // 1. Subterranean cavern resonance
    const targetDroneGain = 0.004 + tunnelDepthFactor * 0.014;
    this.cavernDroneGain?.gain.setTargetAtTime(targetDroneGain, now, 0.35);

    // 2. Proximity to Waterfall Chamber at (-11.5, 3.15, 82.5)
    const distWaterfall = Math.hypot(
      playerX - -11.5,
      playerY - 4.0,
      playerZ - 82.5,
    );
    const waterfallProx = Math.max(
      0.0,
      1.0 - Math.min(1.0, (distWaterfall - 4.0) / 32.0),
    );
    const targetWaterfallGain =
      (0.004 + waterfallProx * waterfallProx * 0.068) * tunnelDepthFactor;
    const targetCutoff = 320 + waterfallProx * 1350;

    this.waterfallGain?.gain.setTargetAtTime(targetWaterfallGain, now, 0.18);
    this.waterfallFilter?.frequency.setTargetAtTime(targetCutoff, now, 0.18);

    // 3. Occasional gentle crystalline water droplets echoing inside the cavern
    if (tunnelDepthFactor > 0.55 && now - this.lastDropletTime > 3.6) {
      this.lastDropletTime = now + Math.random() * 2.4;
      const dropletNotes = [783.99, 880.0, 1046.5, 1174.66, 1318.51];
      const baseFreq =
        dropletNotes[Math.floor(Math.random() * dropletNotes.length)];
      this.playTone(
        baseFreq * 0.85,
        0.16,
        0.0,
        'sine',
        0.018 * tunnelDepthFactor,
        baseFreq * 1.18,
      );
    }
  }

  public dispose(): void {
    try {
      this.waterfallSource?.stop();
      this.cavernOsc1?.stop();
      this.cavernOsc2?.stop();
    } catch {
      // Ignore already stopped nodes
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
