/**
 * Procedural Web Audio API sound synthesis for Cell 04: The Awakening.
 * Zero external audio files — generates phone ringing, receiver pickup,
 * suspenseful bass sting, electrical flicker buzz, locked door rattle, and footsteps.
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
   * Subtle low thud for footsteps on concrete.
   */
  public playFootstep() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(85 + Math.random() * 15, now);
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
