import { RoadSurfaceType } from './Chapter2Config';

/**
 * Chapter 2: The Unknown Journey — Procedural Web Audio Foley & Spatial Soundscape
 * Implements Section 3 & Section 5 Sound Design Blueprint:
 * - Engine: continuous and spatially positioned low-frequency cabin hum
 * - Tyres: changes timbre according to road surface (Residential Asphalt -> Main Highway -> Isolated Rough -> Concrete)
 * - Suspension: subtle low-end thumps on road joints
 * - Indicators: authentic turn-signal relay click-clack during turns
 * - Passing vehicles: Doppler whoosh briefly audible through the windows
 * - Air conditioning: very subtle interior cabin ventilation whisper
 * - Controlled Blackout Foley: car door closing, footsteps, distant mechanical latch, heavy door opening, fading steps
 * - Cell 04 Awakening: faint warm room tone & overhead tungsten lamp hum
 */
export class Chapter2AudioController {
  private ctx: AudioContext | null = null;
  private isMuted = false;
  private running = false;

  private masterGain: GainNode | null = null;
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;

  private tyreFilter: BiquadFilterNode | null = null;
  private tyreGain: GainNode | null = null;

  private acGain: GainNode | null = null;
  private cellRoomGain: GainNode | null = null;

  private indicatorTimer = 0;
  private indicatorToggle = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
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

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        muted ? 0 : 1,
        this.ctx.currentTime,
        0.06,
      );
    }
  }

  public startCabinSoundscape(): void {
    if (this.running) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.running = true;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.isMuted ? 0 : 1;
    this.masterGain.connect(ctx.destination);

    // 1. Spatially Positioned Cabin Engine Hum (Dual detuned low oscillators through muffled cabin lowpass)
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 135;

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.01;

    this.engineOsc1 = ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.value = 44;

    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.value = 88;

    this.engineOsc1.connect(engineFilter);
    this.engineOsc2.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc1.start();
    this.engineOsc2.start();

    // 2. Continuous Tyre Rolling Noise & Subtle AC Ventilation Whisper
    const bufferSize = ctx.sampleRate * 3;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const tyreSource = ctx.createBufferSource();
    tyreSource.buffer = noiseBuffer;
    tyreSource.loop = true;

    this.tyreFilter = ctx.createBiquadFilter();
    this.tyreFilter.type = 'bandpass';
    this.tyreFilter.frequency.value = 260;
    this.tyreFilter.Q.value = 1.4;

    this.tyreGain = ctx.createGain();
    this.tyreGain.gain.value = 0.0;

    tyreSource.connect(this.tyreFilter);
    this.tyreFilter.connect(this.tyreGain);
    this.tyreGain.connect(this.masterGain);
    tyreSource.start();

    // Subtle interior air-conditioning whisper
    const acSource = ctx.createBufferSource();
    acSource.buffer = noiseBuffer;
    acSource.loop = true;

    const acFilter = ctx.createBiquadFilter();
    acFilter.type = 'bandpass';
    acFilter.frequency.value = 950;
    acFilter.Q.value = 2.5;

    this.acGain = ctx.createGain();
    this.acGain.gain.value = 0.012;

    acSource.connect(acFilter);
    acFilter.connect(this.acGain);
    this.acGain.connect(this.masterGain);
    acSource.start();

    // 3. Cell 04 Room Tone Drone (starts silent until Scene 5 Awakening)
    const roomOsc = ctx.createOscillator();
    roomOsc.type = 'sine';
    roomOsc.frequency.value = 60;
    this.cellRoomGain = ctx.createGain();
    this.cellRoomGain.gain.value = 0.0;
    roomOsc.connect(this.cellRoomGain);
    this.cellRoomGain.connect(this.masterGain);
    roomOsc.start();
  }

  public updateVehicleFoley(
    dt: number,
    speedMs: number,
    surface: RoadSurfaceType,
    engineRunning: boolean,
    indicatorActive: boolean,
    inCell04: boolean,
  ): void {
    if (!this.running || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (inCell04) {
      this.engineGain?.gain.setTargetAtTime(0, now, 0.2);
      this.tyreGain?.gain.setTargetAtTime(0, now, 0.2);
      this.acGain?.gain.setTargetAtTime(0, now, 0.2);
      this.cellRoomGain?.gain.setTargetAtTime(0.035, now, 0.5);
      return;
    }

    this.cellRoomGain?.gain.setTargetAtTime(0, now, 0.2);

    // Engine pitch & gain
    const speedRatio = Math.min(1.5, speedMs / 12.0);
    const targetEngineGain = engineRunning ? 0.055 + speedRatio * 0.045 : 0.0;
    this.engineGain?.gain.setTargetAtTime(targetEngineGain, now, 0.12);
    this.acGain?.gain.setTargetAtTime(engineRunning ? 0.012 : 0.0, now, 0.25);

    if (this.engineOsc1 && this.engineOsc2 && engineRunning) {
      const baseFreq = 42 + speedRatio * 34;
      this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.1);
      this.engineOsc2.frequency.setTargetAtTime(baseFreq * 2.01, now, 0.1);
    }

    // Tyre rolling surface timbre
    let surfaceFreq = 260;
    let surfaceMult = 1.0;
    if (surface === 'MAIN_HIGHWAY') {
      surfaceFreq = 390;
      surfaceMult = 1.25;
    } else if (surface === 'ISOLATED_ROUGH') {
      surfaceFreq = 195;
      surfaceMult = 1.35;
    } else if (surface === 'CONCRETE_COURTYARD') {
      surfaceFreq = 310;
      surfaceMult = 0.75;
    }

    this.tyreFilter?.frequency.setTargetAtTime(surfaceFreq, now, 0.15);
    const targetTyreGain =
      speedMs > 0.2 ? Math.min(0.09, (speedMs / 14.0) * 0.065 * surfaceMult) : 0;
    this.tyreGain?.gain.setTargetAtTime(targetTyreGain, now, 0.12);

    // Turn indicator relay clicking
    if (indicatorActive) {
      this.indicatorTimer += dt;
      if (this.indicatorTimer >= 0.42) {
        this.indicatorTimer = 0;
        this.indicatorToggle = !this.indicatorToggle;
        this.playIndicatorClick(this.indicatorToggle);
      }
    } else {
      this.indicatorTimer = 0;
    }
  }

  private playIndicatorClick(highTick: boolean): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(highTick ? 1180 : 860, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.032, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.03);
  }

  public playSuspensionBump(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(68, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.14);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.075, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playPassingVehicleWhoosh(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    const len = Math.floor(ctx.sampleRate * 1.4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = Math.random() * 2 - 1;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.8;
    filter.frequency.setValueAtTime(180, now);
    filter.frequency.exponentialRampToValueAtTime(620, now + 0.55);
    filter.frequency.exponentialRampToValueAtTime(140, now + 1.35);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.095, now + 0.55);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.38);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(now);
  }

  public playCarDoorThud(isOpening = false): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isOpening ? 140 : 95, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.22);

    const g = ctx.createGain();
    g.gain.setValueAtTime(isOpening ? 0.1 : 0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Scene 5 Controlled Blackout Audio Sequence:
   * Car door closing -> footsteps -> distant mechanical latch -> heavy door opening -> footsteps becoming quieter
   */
  public playBlackoutTransitionSequence(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    // 1. Heavy car door closing (t = 0.2s)
    const doorOsc = ctx.createOscillator();
    doorOsc.type = 'sine';
    doorOsc.frequency.setValueAtTime(92, now + 0.2);
    doorOsc.frequency.exponentialRampToValueAtTime(28, now + 0.45);
    const doorGain = ctx.createGain();
    doorGain.gain.setValueAtTime(0.001, now);
    doorGain.gain.setValueAtTime(0.18, now + 0.2);
    doorGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    doorOsc.connect(doorGain);
    doorGain.connect(this.masterGain);
    doorOsc.start(now + 0.2);
    doorOsc.stop(now + 0.5);

    // 2. Footsteps + Distant Mechanical Door Latch (t = 1.0s .. 5.2s)
    const stepTimes = [1.0, 1.55, 2.1, 2.65, 3.8, 4.4, 5.0];
    stepTimes.forEach((t, idx) => {
      const fadeVol = idx < 4 ? 0.08 : Math.max(0.015, 0.07 - (idx - 3) * 0.018);
      const sOsc = ctx.createOscillator();
      sOsc.type = 'triangle';
      sOsc.frequency.setValueAtTime(110, now + t);
      sOsc.frequency.exponentialRampToValueAtTime(42, now + t + 0.09);
      const sGain = ctx.createGain();
      sGain.gain.setValueAtTime(fadeVol, now + t);
      sGain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.1);
      sOsc.connect(sGain);
      sGain.connect(this.masterGain!);
      sOsc.start(now + t);
      sOsc.stop(now + t + 0.11);
    });

    // 3. Heavy metallic Cell 04 door latch at t = 3.1s
    const latchOsc = ctx.createOscillator();
    latchOsc.type = 'sawtooth';
    latchOsc.frequency.setValueAtTime(240, now + 3.1);
    latchOsc.frequency.setValueAtTime(165, now + 3.22);
    const latchGain = ctx.createGain();
    latchGain.gain.setValueAtTime(0.075, now + 3.1);
    latchGain.gain.exponentialRampToValueAtTime(0.001, now + 3.55);
    latchOsc.connect(latchGain);
    latchGain.connect(this.masterGain);
    latchOsc.start(now + 3.1);
    latchOsc.stop(now + 3.58);
  }

  public dispose(): void {
    this.running = false;
    try {
      this.engineOsc1?.stop();
      this.engineOsc2?.stop();
      this.ctx?.close();
    } catch {
      // ignore
    }
    this.ctx = null;
  }
}
