/**
 * Prologue · Chapter 1: The Ordinary Night — Procedural Audio Controller
 * Implements:
 * - Quiet nighttime residential ambience (distant traffic hum, insects, occasional distant dog bark)
 * - Synchronized asphalt footsteps
 * - Short phone vibration + subtle screen interaction sound
 * - Distant car engine -> louder approach -> slowing brake/tire sound
 * - Mechanical car door unlock click + low cinematic chapter-end tone
 * Zero horror stingers or jump scares.
 */

export class Chapter1AudioController {
  private ctx: AudioContext | null = null;
  private muted = false;

  // Continuous ambient nodes
  private ambientGain: GainNode | null = null;
  private trafficGain: GainNode | null = null;
  private ambientOscs: OscillatorNode[] = [];
  private noiseSource: AudioBufferSourceNode | null = null;

  // Continuous car engine nodes
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  private cricketIntervalId: number | null = null;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
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

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx) {
      const now = this.ctx.currentTime;
      if (this.ambientGain) {
        this.ambientGain.gain.setTargetAtTime(muted ? 0.0001 : 0.045, now, 0.15);
      }
      if (this.engineGain && muted) {
        this.engineGain.gain.setTargetAtTime(0.0001, now, 0.1);
      }
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /**
   * Starts the subtle nighttime residential street ambience:
   * - Soft night breeze & distant urban hum
   * - Subtle high-frequency cricket chirps
   */
  public startNightAmbience(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.ambientGain) return;

    const now = ctx.currentTime;
    const masterAmb = ctx.createGain();
    masterAmb.gain.setValueAtTime(0.001, now);
    masterAmb.gain.linearRampToValueAtTime(this.muted ? 0.0001 : 0.045, now + 1.5);
    masterAmb.connect(ctx.destination);
    this.ambientGain = masterAmb;

    //Filtered noise for quiet night air
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 0.35;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.frequency.setValueAtTime(340, now);
    airFilter.Q.setValueAtTime(0.7, now);

    noise.connect(airFilter);
    airFilter.connect(masterAmb);
    noise.start(now);
    this.noiseSource = noise;

    // Distant traffic hum (lowers during Beat 03 when the street gets quieter)
    const trafficGain = ctx.createGain();
    trafficGain.gain.setValueAtTime(0.45, now);
    trafficGain.connect(masterAmb);
    this.trafficGain = trafficGain;

    const trafficOsc = ctx.createOscillator();
    trafficOsc.type = 'triangle';
    trafficOsc.frequency.setValueAtTime(58, now);
    trafficOsc.connect(trafficGain);
    trafficOsc.start(now);
    this.ambientOscs.push(trafficOsc);

    // Subtle periodic night cricket & occasional very distant dog bark in Beat 01
    this.cricketIntervalId = window.setInterval(() => {
      if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
      if (Math.random() < 0.65) {
        this.playCricketChirp();
      }
    }, 2600);
  }

  /**
   * Adjusts distant traffic level: quieter in Beat 03 ("Something feels different")
   * and fades out at Chapter End.
   */
  public setTrafficPresence(level: 'normal' | 'quiet' | 'silent'): void {
    if (!this.ctx || !this.trafficGain) return;
    const now = this.ctx.currentTime;
    const target =
      level === 'normal' ? 0.45 : level === 'quiet' ? 0.12 : 0.0001;
    this.trafficGain.gain.setTargetAtTime(target, now, 0.8);

    if (level === 'silent' && this.ambientGain) {
      this.ambientGain.gain.setTargetAtTime(0.004, now, 0.9);
    } else if (this.ambientGain && !this.muted) {
      this.ambientGain.gain.setTargetAtTime(0.045, now, 0.8);
    }
  }

  private playCricketChirp(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(4150 + (i % 2) * 120, now + i * 0.055);
      gain.gain.setValueAtTime(0.0001, now + i * 0.055);
      gain.gain.linearRampToValueAtTime(0.006, now + i * 0.055 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.055 + 0.042);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.055);
      osc.stop(now + i * 0.055 + 0.048);
    }
  }

  /**
   * Synchronized footstep on asphalt road/footpath.
   */
  public playFootstep(isLeftFoot: boolean, speedRatio = 1.0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Soft heel-toe thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    const baseFreq = isLeftFoot ? 118 : 126;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.075);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(380, now);

    const peak = Math.min(0.048, 0.032 * speedRatio);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Beat 02: Tactile dual-pulse phone vibration in pocket.
   */
  public playPhoneVibration(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    for (const offset of [0.0, 0.24]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(132, now + offset);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(240, now + offset);

      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.linearRampToValueAtTime(0.045, now + offset + 0.02);
      gain.gain.setValueAtTime(0.042, now + offset + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + offset);
      osc.stop(now + offset + 0.19);
    }
  }

  /**
   * Beat 02: Very subtle phone screen wake / message interaction sound.
   */
  public playPhoneScreenWake(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.18);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.028, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  /**
   * Beat 03 & 04: Continuous car engine audio that scales with proximity and speed.
   */
  public updateCarEngineAudio(
    active: boolean,
    distanceMeters: number,
    speedNormalized: number,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (!active || this.muted) {
      if (this.engineGain) {
        this.engineGain.gain.setTargetAtTime(0.0001, now, 0.2);
      }
      return;
    }

    if (!this.engineGain) {
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, now);

      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(52, now);

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(104, now);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);

      this.engineOsc1 = osc1;
      this.engineOsc2 = osc2;
      this.engineFilter = filter;
      this.engineGain = gain;
    }

    const proximity = Math.max(0, Math.min(1, 1 - distanceMeters / 85));
    const targetGain = 0.004 + proximity * proximity * 0.058;
    const baseRpmFreq = 46 + speedNormalized * 26;

    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.12);
    this.engineOsc1?.frequency.setTargetAtTime(baseRpmFreq, now, 0.12);
    this.engineOsc2?.frequency.setTargetAtTime(baseRpmFreq * 2, now, 0.12);
    this.engineFilter?.frequency.setTargetAtTime(
      140 + proximity * 210,
      now,
      0.12,
    );
  }

  /**
   * Beat 04: Subtle brake & tire friction sound when the dark sedan slows and stops.
   */
  public playCarBrakeStop(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.85);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.032, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.92);
  }

  /**
   * Beat 05: Crisp mechanical car door unlock click right before cutting to black.
   */
  public playCarDoorUnlockAndEndTone(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Mechanical relay + latch click-clack
    const click1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    click1.type = 'square';
    click1.frequency.setValueAtTime(340, now);
    click1.frequency.exponentialRampToValueAtTime(120, now + 0.045);
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.linearRampToValueAtTime(0.065, now + 0.005);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    click1.connect(gain1);
    gain1.connect(ctx.destination);
    click1.start(now);
    click1.stop(now + 0.055);

    const click2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    click2.type = 'triangle';
    click2.frequency.setValueAtTime(210, now + 0.07);
    click2.frequency.exponentialRampToValueAtTime(88, now + 0.14);
    gain2.gain.setValueAtTime(0.0001, now + 0.07);
    gain2.gain.linearRampToValueAtTime(0.07, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    click2.connect(gain2);
    gain2.connect(ctx.destination);
    click2.start(now + 0.07);
    click2.stop(now + 0.16);

    // 2. Low restrained cinematic tone as the screen cuts to black
    const lowTone = ctx.createOscillator();
    const lowGain = ctx.createGain();
    lowTone.type = 'sine';
    lowTone.frequency.setValueAtTime(65.41, now + 0.25); // C2
    lowTone.frequency.exponentialRampToValueAtTime(55.0, now + 2.6);

    lowGain.gain.setValueAtTime(0.0001, now + 0.25);
    lowGain.gain.linearRampToValueAtTime(0.065, now + 0.65);
    lowGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);

    lowTone.connect(lowGain);
    lowGain.connect(ctx.destination);
    lowTone.start(now + 0.25);
    lowTone.stop(now + 2.85);
  }

  public dispose(): void {
    if (this.cricketIntervalId !== null) {
      clearInterval(this.cricketIntervalId);
      this.cricketIntervalId = null;
    }
    for (const osc of this.ambientOscs) {
      try {
        osc.stop();
      } catch {}
    }
    this.ambientOscs = [];
    try {
      this.noiseSource?.stop();
      this.engineOsc1?.stop();
      this.engineOsc2?.stop();
    } catch {}
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
