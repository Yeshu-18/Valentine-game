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

  public dispose(): void {
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
