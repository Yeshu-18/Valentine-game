/**
 * Procedural Web Audio API sound synthesis for Cell 04: The Awakening.
 * Zero external audio files — generates phone ringing, receiver pickup,
 * suspenseful bass sting, electrical flicker buzz, locked door rattle,
 * mechanical deadbolt unlock, door swing, paper/object inspection foley,
 * memory discovery chords, blindfold cloth rustle, and guided transition footsteps.
 */
export class Cell04SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted = false;
  private lastRingTime = 0;

  private ensureContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Subtle mechanical bell ring bursts for the desk telephone before it is answered.
   */
  public playPhoneRingPulse() {
    const nowMs = performance.now();
    if (nowMs - this.lastRingTime < 2800) return;
    this.lastRingTime = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const masterGain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(840, now);
    osc2.frequency.setValueAtTime(1120, now);

    // 18Hz mechanical striker modulation
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(18, now);
    lfoGain.gain.setValueAtTime(0.035, now);

    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.linearRampToValueAtTime(0.05, now + 0.02);
    masterGain.gain.setValueAtTime(0.05, now + 0.45);
    masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.5);
    // Second burst of dual ring
    masterGain.gain.linearRampToValueAtTime(0.05, now + 0.65);
    masterGain.gain.setValueAtTime(0.05, now + 1.1);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.18);

    lfo.connect(lfoGain);
    lfoGain.connect(masterGain.gain);
    osc1.connect(masterGain);
    osc2.connect(masterGain);
    masterGain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    lfo.start(now);
    osc1.stop(now + 1.2);
    osc2.stop(now + 1.2);
    lfo.stop(now + 1.2);
  }

  /**
   * Plays when the player answers the phone:
   * 1. Mechanical receiver clack
   * 2. Electrical static crackle & fluorescent bulb hum drop
   * 3. Deep ominous sub-bass drone + dissonant metallic suspense chord
   */
  public playSuspenseMoment() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Receiver pickup click
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(320, now);
    clickOsc.frequency.exponentialRampToValueAtTime(90, now + 0.07);
    clickGain.gain.setValueAtTime(0.18, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.09);

    // 2. Deep sub-bass ominous impact & slow downward pitch bend
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(68, now + 0.12);
    subOsc.frequency.exponentialRampToValueAtTime(39, now + 4.2);

    const subFilter = ctx.createBiquadFilter();
    subFilter.type = 'lowpass';
    subFilter.frequency.setValueAtTime(160, now + 0.12);
    subFilter.frequency.exponentialRampToValueAtTime(75, now + 4.2);

    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.24, now + 0.25);
    subGain.gain.setValueAtTime(0.22, now + 2.4);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 4.5);

    subOsc.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now + 0.1);
    subOsc.stop(now + 4.6);

    // 3. Eerie dissonant tritone / minor second suspense pad
    const freqs = [220, 233.08, 311.13];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, now + 0.2);
      osc.frequency.linearRampToValueAtTime(f * 0.985, now + 4.0);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(520, now + 0.2);
      filter.Q.setValueAtTime(3.0, now + 0.2);

      gain.gain.setValueAtTime(0.0001, now + 0.2);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.8 + idx * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.3);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + 0.2);
      osc.stop(now + 4.4);
    });
  }

  /**
   * Metallic clunk when trying to open the locked steel door.
   */
  public playLockedDoorRattle() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const offsets = [0, 0.14];
    offsets.forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(i === 0 ? 145 : 118, now + offset);
      osc.frequency.exponentialRampToValueAtTime(48, now + offset + 0.09);

      gain.gain.setValueAtTime(0.14, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.11);
    });
  }

  /**
   * Subtle mechanical deadbolt retraction sound when all discoveries are completed.
   */
  public playDoorUnlock() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Solenoid release click
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(520, now);
    clickOsc.frequency.exponentialRampToValueAtTime(180, now + 0.08);
    clickGain.gain.setValueAtTime(0.14, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.1);

    // 2. Heavy steel bolt sliding back
    const boltOsc = ctx.createOscillator();
    const boltGain = ctx.createGain();
    boltOsc.type = 'sine';
    boltOsc.frequency.setValueAtTime(110, now + 0.12);
    boltOsc.frequency.linearRampToValueAtTime(165, now + 0.32);
    boltGain.gain.setValueAtTime(0.001, now + 0.12);
    boltGain.gain.linearRampToValueAtTime(0.18, now + 0.18);
    boltGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    boltOsc.connect(boltGain);
    boltGain.connect(ctx.destination);
    boltOsc.start(now + 0.12);
    boltOsc.stop(now + 0.4);

    // 3. Subtle resonant confirmation chime
    const chimeOsc = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    chimeOsc.type = 'sine';
    chimeOsc.frequency.setValueAtTime(587.33, now + 0.34); // D5
    chimeGain.gain.setValueAtTime(0.001, now + 0.34);
    chimeGain.gain.linearRampToValueAtTime(0.045, now + 0.38);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    chimeOsc.connect(chimeGain);
    chimeGain.connect(ctx.destination);
    chimeOsc.start(now + 0.34);
    chimeOsc.stop(now + 1.15);
  }

  /**
   * Heavy steel door unlatching and swinging open on its hinges.
   */
  public playDoorOpen() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Latch release clank
    const latchOsc = ctx.createOscillator();
    const latchGain = ctx.createGain();
    latchOsc.type = 'triangle';
    latchOsc.frequency.setValueAtTime(160, now);
    latchOsc.frequency.exponentialRampToValueAtTime(55, now + 0.14);
    latchGain.gain.setValueAtTime(0.18, now);
    latchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    latchOsc.connect(latchGain);
    latchGain.connect(ctx.destination);
    latchOsc.start(now);
    latchOsc.stop(now + 0.17);

    // Slow metallic hinge sweep
    const hingeOsc = ctx.createOscillator();
    const hingeFilter = ctx.createBiquadFilter();
    const hingeGain = ctx.createGain();
    hingeOsc.type = 'sawtooth';
    hingeOsc.frequency.setValueAtTime(92, now + 0.18);
    hingeOsc.frequency.linearRampToValueAtTime(76, now + 1.4);

    hingeFilter.type = 'bandpass';
    hingeFilter.frequency.setValueAtTime(240, now + 0.18);
    hingeFilter.Q.setValueAtTime(4.5, now + 0.18);

    hingeGain.gain.setValueAtTime(0.0001, now + 0.18);
    hingeGain.gain.linearRampToValueAtTime(0.055, now + 0.45);
    hingeGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.55);

    hingeOsc.connect(hingeFilter);
    hingeFilter.connect(hingeGain);
    hingeGain.connect(ctx.destination);
    hingeOsc.start(now + 0.18);
    hingeOsc.stop(now + 1.6);
  }

  /**
   * Soft paper / object handling foley when picking up or turning the photograph.
   */
  public playItemInspect() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.06);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * Warm harmonic chord swell when a relationship memory is discovered.
   */
  public playMemoryChord(memoryIndex: 1 | 2 | 3) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const chordMap: Record<1 | 2 | 3, number[]> = {
      1: [261.63, 329.63, 392.0, 493.88], // Cmaj7 — Project Hail Mary
      2: [293.66, 369.99, 440.0, 554.37], // Dmaj7 — The Pinky Moment
      3: [349.23, 440.0, 523.25, 659.25], // Fmaj7 — The Confession
    };

    const notes = chordMap[memoryIndex];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0.0001, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.04, now + i * 0.08 + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + 2.9);
    });
  }

  /**
   * Soft silk cloth foley when the blindfold gently covers Harsha's eyes.
   */
  public playBlindfoldCloth() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.55);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, now);
    filter.Q.setValueAtTime(1.8, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.07, now + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.54);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  /**
   * Plays when the second door opens during the blindfold sequence and transitions into the Dream World.
   */
  public playSecondDoorWarmReveal() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Warm wooden latch & door opening + radiant major 9th chord
    const notes = [261.63, 329.63, 392.0, 493.88, 587.33];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.09);
      gain.gain.linearRampToValueAtTime(0.045, now + idx * 0.09 + 0.45);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + 3.3);
    });
  }

  /**
   * Subtle low thud for footsteps on concrete.
   */
  public playFootstep(pitchOffset = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(
      85 + pitchOffset + Math.random() * 12,
      now,
    );
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.08);

    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public dispose() {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const cell04SoundEngine = new Cell04SoundEngine();
