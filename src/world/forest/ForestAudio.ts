/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

/**
 * Procedural Web Audio synthesizer for Ancient Forest (Phase F3) ambient sounds.
 * Synthesizes:
 * 1. Gentle flowing stream and waterfall rushing sounds (proximity modulated)
 * 2. Delicate mushroom grove chimes (pentatonic harmonic resonance)
 * 3. Ancient Rune Stone activation chime (ethereal harmonic swell)
 *
 * Runs 100% offline with zero external audio assets.
 */
export class ForestAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private streamGain: GainNode | null = null;
  private streamFilter: BiquadFilterNode | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private isStreamPlaying = false;
  private lastMushroomChimeTime = 0;
  private lastRuneChimeTime = 0;
  private lakeMemoryDuckFactor = 0;

  private getContext(): AudioContext | null {
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

  /**
   * Initializes the procedural ambient rushing-water loop for the forest stream & waterfall.
   */
  private initStreamNoise(ctx: AudioContext): void {
    if (this.isStreamPlaying) return;

    // Generate 4 seconds of smooth pink noise for natural water flow
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
      b6 = white * 0.115926;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // Filter to warm water rushing band (~350Hz - 900Hz)
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 520;
    filter.Q.value = 1.1;

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(0);

    this.noiseNode = noise;
    this.streamFilter = filter;
    this.streamGain = gain;
    this.isStreamPlaying = true;
  }

  /**
   * Updates ambient stream audio volume based on player distance to stream & waterfall.
   */
  updateStreamProximity(
    distToStream: number,
    distToWaterfall: number,
    elapsedTime: number,
  ): void {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return;

    if (!this.isStreamPlaying) {
      this.initStreamNoise(ctx);
    }
    if (!this.streamGain || !this.streamFilter) return;

    // Waterfall is audible within 18m, stream within 10m
    const waterfallFactor = THREE.MathUtils.clamp(
      1.0 - distToWaterfall / 18.0,
      0,
      1,
    );
    const streamFactor = THREE.MathUtils.clamp(1.0 - distToStream / 10.0, 0, 1);

    const totalAudibility = Math.max(
      waterfallFactor * 1.35,
      streamFactor * 0.85,
    );

    // Subtle natural turbulence modulation (calms into gentle lapping during Lake Memory)
    const duck = this.lakeMemoryDuckFactor;
    const ripple =
      1.0 +
      Math.sin(elapsedTime * (2.8 - duck * 1.3)) * (0.14 + duck * 0.08);
    const normalGain = totalAudibility * 0.042 * ripple;
    const lappingGain = 0.034 * ripple;
    const targetGain = THREE.MathUtils.lerp(normalGain, lappingGain, duck);

    // Higher frequency sparkle when close to the waterfall plunge; warm 340Hz lapping during Lake Memory
    const normalFreq = 420 + waterfallFactor * 380;
    const targetFreq = THREE.MathUtils.lerp(normalFreq, 340, duck);

    const t = ctx.currentTime;
    this.streamGain.gain.setTargetAtTime(targetGain, t, 0.18);
    this.streamFilter.frequency.setTargetAtTime(targetFreq, t, 0.2);
  }

  /**
   * Controls subtle ducking of distracting forest ambient noise during the 13.5s Lake Memory cinematic
   * (0 = normal forest ambience, 1 = quiet lapping water focus).
   */
  setLakeMemoryDucking(duckFactor: number): void {
    this.lakeMemoryDuckFactor = THREE.MathUtils.clamp(duckFactor, 0, 1);
  }

  /**
   * Plays soft magical pentatonic chimes when the player approaches the Mushroom Grove.
   */
  playMushroomChime(nowSec: number): void {
    if (nowSec - this.lastMushroomChimeTime < 4.5) return;
    this.lastMushroomChimeTime = nowSec;

    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return;

    // Ethereal pentatonic triad: D5 (587.3Hz), F#5 (739.9Hz), A5 (880Hz)
    const freqs = [587.33, 739.99, 880.0];
    const delays = [0.0, 0.18, 0.38];

    freqs.forEach((freq, idx) => {
      const t0 = ctx.currentTime + delays[idx];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.015, t0 + 0.9);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.018, t0 + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 1.3);
    });
  }

  /**
   * Plays a resonant ancient chime when the player activates the Rune Stone.
   */
  playRuneActivationChime(nowSec: number): void {
    if (nowSec - this.lastRuneChimeTime < 3.0) return;
    this.lastRuneChimeTime = nowSec;

    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return;

    const t0 = ctx.currentTime;

    // 1. Deep warm fundamental bell tone (220Hz / A3)
    const baseOsc = ctx.createOscillator();
    const baseGain = ctx.createGain();
    baseOsc.type = 'triangle';
    baseOsc.frequency.setValueAtTime(220, t0);
    baseOsc.frequency.exponentialRampToValueAtTime(218, t0 + 2.2);

    baseGain.gain.setValueAtTime(0.0001, t0);
    baseGain.gain.linearRampToValueAtTime(0.038, t0 + 0.09);
    baseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);

    baseOsc.connect(baseGain);
    baseGain.connect(ctx.destination);
    baseOsc.start(t0);
    baseOsc.stop(t0 + 2.5);

    // 2. High celestial overtone shimmer (880Hz -> 1320Hz / E6)
    const overtoneOsc = ctx.createOscillator();
    const overtoneGain = ctx.createGain();
    overtoneOsc.type = 'sine';
    overtoneOsc.frequency.setValueAtTime(880, t0 + 0.05);
    overtoneOsc.frequency.exponentialRampToValueAtTime(1320, t0 + 0.85);

    overtoneGain.gain.setValueAtTime(0.0001, t0 + 0.05);
    overtoneGain.gain.linearRampToValueAtTime(0.022, t0 + 0.2);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.9);

    overtoneOsc.connect(overtoneGain);
    overtoneGain.connect(ctx.destination);
    overtoneOsc.start(t0 + 0.05);
    overtoneOsc.stop(t0 + 2.0);
  }

  // ============================================================================
  // PHASE F4: AMBIENT WILDLIFE AUDIO SYNTHESIZERS
  // ============================================================================
  private lastBirdChirpTime = 0;
  private lastFrogCroakTime = 0;
  private lastWingFlutterTime = 0;
  private lastOwlHootTime = 0;

  /**
   * Plays a delicate woodland warble / chirp when small birds flutter or react.
   */
  playBirdChirp(nowSec: number, dist: number = 8.0): void {
    if (nowSec - this.lastBirdChirpTime < 3.2) return;
    this.lastBirdChirpTime = nowSec;

    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return;

    const atten =
      THREE.MathUtils.clamp(1.0 - dist / 22.0, 0.0, 1.0) *
      (1.0 - this.lakeMemoryDuckFactor * 0.88);
    if (atten <= 0.01) return;

    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Gentle rising trill: 2100Hz -> 2850Hz -> 2400Hz
    osc.frequency.setValueAtTime(2100, t0);
    osc.frequency.exponentialRampToValueAtTime(2850, t0 + 0.07);
    osc.frequency.exponentialRampToValueAtTime(2400, t0 + 0.16);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(0.018 * atten, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.2);
  }

  /**
   * Plays a low, charming frog croak near stream banks or the lake shoreline.
   */
  playFrogCroak(nowSec: number, dist: number = 5.0): void {
    if (nowSec - this.lastFrogCroakTime < 2.8) return;
    this.lastFrogCroakTime = nowSec;

    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return;

    const atten =
      THREE.MathUtils.clamp(1.0 - dist / 16.0, 0.0, 1.0) *
      (1.0 - this.lakeMemoryDuckFactor * 0.88);
    if (atten <= 0.01) return;

    const t0 = ctx.currentTime;
    // Dual pulse croak (reedy formant synthesis)
    [0.0, 0.08].forEach((offset) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(145, t0 + offset);
      osc.frequency.linearRampToValueAtTime(125, t0 + offset + 0.07);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(480, t0 + offset);
      filter.Q.setValueAtTime(3.5, t0 + offset);

      gain.gain.setValueAtTime(0.0001, t0 + offset);
      gain.gain.linearRampToValueAtTime(0.016 * atten, t0 + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.075);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t0 + offset);
      osc.stop(t0 + offset + 0.08);
    });
  }

  /**
   * Plays a soft wing flutter when woodland birds or creatures take flight.
   */
  playWingFlutter(nowSec: number): void {
    if (nowSec - this.lastWingFlutterTime < 2.0) return;
    this.lastWingFlutterTime = nowSec;

    if (this.lakeMemoryDuckFactor > 0.5) return;
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return;

    const t0 = ctx.currentTime;
    // 4 quick soft pink-noise bursts
    for (let p = 0; p < 4; p++) {
      const pt = t0 + p * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(110 + p * 20, pt);

      gain.gain.setValueAtTime(0.0001, pt);
      gain.gain.linearRampToValueAtTime(0.012, pt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, pt + 0.048);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(pt);
      osc.stop(pt + 0.05);
    }
  }

  /**
   * Plays a rare, distant two-tone owl hoot ("hoo... hoo-oo").
   */
  playOwlHoot(nowSec: number, dist: number = 10.0): void {
    if (nowSec - this.lastOwlHootTime < 24.0) return;
    this.lastOwlHootTime = nowSec;

    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return;

    const atten =
      THREE.MathUtils.clamp(1.0 - dist / 32.0, 0.0, 1.0) *
      (1.0 - this.lakeMemoryDuckFactor * 0.88);
    if (atten <= 0.01) return;

    const t0 = ctx.currentTime;

    // Note 1: "Hoo..." (480Hz with soft attack)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(460, t0);
    osc1.frequency.linearRampToValueAtTime(475, t0 + 0.15);
    osc1.frequency.exponentialRampToValueAtTime(440, t0 + 0.42);

    gain1.gain.setValueAtTime(0.0001, t0);
    gain1.gain.linearRampToValueAtTime(0.018 * atten, t0 + 0.12);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.44);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t0);
    osc1.stop(t0 + 0.45);

    // Note 2: "...Hoo-oo" (starts at t0 + 0.58s)
    const t1 = t0 + 0.58;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(435, t1);
    osc2.frequency.linearRampToValueAtTime(455, t1 + 0.2);
    osc2.frequency.exponentialRampToValueAtTime(400, t1 + 0.65);

    gain2.gain.setValueAtTime(0.0001, t1);
    gain2.gain.linearRampToValueAtTime(0.016 * atten, t1 + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.68);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t1);
    osc2.stop(t1 + 0.7);
  }

  // ============================================================================
  // PHASE F5/F6: LAKE REVEAL, HIDDEN SPRING & HEARTWOOD SANCTUARY AUDIO
  // ============================================================================
  private lastMoonFlowerChimeTime = 0;
  private lastSanctuaryPulseTime = 0;

  /**
   * Plays a delicate aquatic ripple & crystalline moon-flower bloom chord
   * when the player triggers the Magical Lake Response at the shoreline.
   */
  playLakeMoonFlowerChime(nowSec: number, dist: number = 4.0): void {
    if (nowSec - this.lastMoonFlowerChimeTime < 8.0) return;
    this.lastMoonFlowerChimeTime = nowSec;

    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return;

    const atten = THREE.MathUtils.clamp(1.0 - dist / 14.0, 0.0, 1.0);
    if (atten <= 0.01) return;

    // Luminous aquatic chord: E5 (659.25Hz), G#5 (830.61Hz), B5 (987.77Hz), E6 (1318.5Hz)
    const freqs = [659.25, 830.61, 987.77, 1318.51];
    const delays = [0.0, 0.22, 0.46, 0.74];

    freqs.forEach((freq, idx) => {
      const t0 = ctx.currentTime + delays[idx];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * 0.992, t0);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.008, t0 + 1.35);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.016 * atten, t0 + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.65);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 1.7);
    });
  }

  /**
   * Triggered at 1.8s in the Lake Memory timeline when a single drop of memory
   * touches the water surface and expands into a concentric ring ripple.
   */
  playLakeMemoryDrop(): void {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return;

    const t0 = ctx.currentTime;

    // 1. Delicate crystalline water droplet pitch inflection (520Hz -> 980Hz)
    const dropOsc = ctx.createOscillator();
    const dropGain = ctx.createGain();
    dropOsc.type = 'sine';
    dropOsc.frequency.setValueAtTime(520, t0);
    dropOsc.frequency.exponentialRampToValueAtTime(980, t0 + 0.095);

    dropGain.gain.setValueAtTime(0.0001, t0);
    dropGain.gain.linearRampToValueAtTime(0.022, t0 + 0.018);
    dropGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);

    dropOsc.connect(dropGain);
    dropGain.connect(ctx.destination);
    dropOsc.start(t0);
    dropOsc.stop(t0 + 0.35);

    // 2. Soft sub-surface memory warmth pad (D4 293.66Hz + A4 440Hz + F#5 739.99Hz)
    const padNotes = [
      { freq: 293.66, amp: 0.014, delay: 0.12, dur: 4.2 },
      { freq: 440.0, amp: 0.011, delay: 0.35, dur: 4.5 },
      { freq: 739.99, amp: 0.008, delay: 0.65, dur: 4.0 },
    ];
    padNotes.forEach((n) => {
      const ts = t0 + n.delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq * 0.996, ts);
      osc.frequency.exponentialRampToValueAtTime(n.freq * 1.003, ts + n.dur);

      gain.gain.setValueAtTime(0.0001, ts);
      gain.gain.linearRampToValueAtTime(n.amp, ts + 0.85);
      gain.gain.exponentialRampToValueAtTime(0.0001, ts + n.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ts);
      osc.stop(ts + n.dur + 0.05);
    });
  }

  /**
   * Triggered at 11.0s when the lake memory gently dissolves back into moving ripples.
   */
  playLakeMemoryDissolveRipple(): void {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return;

    const t0 = ctx.currentTime;
    const notes = [
      { freq: 659.25, delay: 0.0, amp: 0.011 },
      { freq: 493.88, delay: 0.28, amp: 0.012 },
      { freq: 369.99, delay: 0.58, amp: 0.013 },
    ];
    notes.forEach((n) => {
      const ts = t0 + n.delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, ts);
      osc.frequency.exponentialRampToValueAtTime(n.freq * 0.992, ts + 2.1);

      gain.gain.setValueAtTime(0.0001, ts);
      gain.gain.linearRampToValueAtTime(n.amp, ts + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.0001, ts + 2.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ts);
      osc.stop(ts + 2.25);
    });
  }

  /**
   * Triggered at 8.0s when the camera reaches the opposite shoreline and the
   * warm translucent mist silhouette forms behind the player in a gentle embrace.
   */
  playLakeMemoryFigureTone(): void {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return;

    const t0 = ctx.currentTime;
    // Warm, tender Dmaj7/9 shimmer (F#4 369.99Hz, A4 440Hz, C#5 554.37Hz, E5 659.25Hz)
    const notes = [
      { freq: 369.99, delay: 0.0, amp: 0.012, dur: 3.4 },
      { freq: 440.0, delay: 0.22, amp: 0.011, dur: 3.3 },
      { freq: 554.37, delay: 0.45, amp: 0.009, dur: 3.1 },
      { freq: 659.25, delay: 0.7, amp: 0.007, dur: 2.9 },
    ];
    notes.forEach((n) => {
      const ts = t0 + n.delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq * 0.997, ts);
      osc.frequency.exponentialRampToValueAtTime(n.freq * 1.002, ts + n.dur);

      gain.gain.setValueAtTime(0.0001, ts);
      gain.gain.linearRampToValueAtTime(n.amp, ts + 0.75);
      gain.gain.exponentialRampToValueAtTime(0.0001, ts + n.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ts);
      osc.stop(ts + n.dur + 0.05);
    });
  }

  /**
   * Plays a rare, serene, low-register harmonic breath when the player enters
   * or lingers near the Heartwood Tree in the Heartwood Sanctuary.
   */
  playSanctuaryHarmonicPulse(nowSec: number, dist: number = 8.0): void {
    if (nowSec - this.lastSanctuaryPulseTime < 14.0) return;
    this.lastSanctuaryPulseTime = nowSec;

    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return;

    const atten = THREE.MathUtils.clamp(1.0 - dist / 18.0, 0.0, 1.0);
    if (atten <= 0.01) return;

    // Warm, peaceful fifth & octave resonance: D4 (293.66Hz), A4 (440.0Hz), F#5 (739.99Hz)
    const notes = [
      { freq: 293.66, delay: 0.0, amp: 0.015 },
      { freq: 440.0, delay: 0.25, amp: 0.012 },
      { freq: 739.99, delay: 0.55, amp: 0.009 },
    ];

    notes.forEach((n) => {
      const t0 = ctx.currentTime + n.delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, t0);
      osc.frequency.exponentialRampToValueAtTime(n.freq * 1.004, t0 + 2.2);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(n.amp * atten, t0 + 0.45);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 2.6);
    });
  }

  dispose(): void {
    if (this.noiseNode) {
      try {
        this.noiseNode.stop();
        this.noiseNode.disconnect();
      } catch {}
      this.noiseNode = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
