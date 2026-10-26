/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Web Audio Synthesizer for the Romantic Aurora Underground Cinematic.
 * Procedurally generates:
 * - Subterranean stone elevator hum and deep resonance
 * - Celestial starry chimes during 360° dome formation
 * - Full Romantic Musical Score (evolving warm major-9th string pads + tender
 *   piano/celesta & harp melody with stereo echo tail) during the 360° Aurora reveal & proposal
 * - Smooth ascending glissando and emergence back into the surface world
 */
export class AuroraAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Descent / Ascent Rumble
  private rumbleGain: GainNode | null = null;
  private rumbleOsc: OscillatorNode | null = null;

  // Romantic Music Score Layers
  private padGain: GainNode | null = null;
  private padFilter: BiquadFilterNode | null = null;
  private padOscs: OscillatorNode[] = [];
  private musicIntervalId: number | null = null;
  private melodyTimeouts: number[] = [];
  private chordStep: number = 0;

  private isDisposed: boolean = false;

  private initContext() {
    if (this.ctx || this.isDisposed) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.82, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch {
      // AudioContext unavailable or blocked
    }
  }

  public ensureRunning() {
    this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Starts the deep, gentle stone elevator descent drone.
   */
  public startDescentRumble() {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;

    this.stopDescentRumble(0.2);

    const now = this.ctx.currentTime;
    this.rumbleGain = this.ctx.createGain();
    this.rumbleGain.gain.setValueAtTime(0.001, now);
    this.rumbleGain.gain.exponentialRampToValueAtTime(0.2, now + 1.8);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(88, now);
    filter.frequency.exponentialRampToValueAtTime(48, now + 9.0);

    this.rumbleOsc = this.ctx.createOscillator();
    this.rumbleOsc.type = 'triangle';
    this.rumbleOsc.frequency.setValueAtTime(50, now);
    this.rumbleOsc.frequency.exponentialRampToValueAtTime(34, now + 10.5);

    this.rumbleOsc.connect(filter);
    filter.connect(this.rumbleGain);
    this.rumbleGain.connect(this.masterGain);

    this.rumbleOsc.start(now);
  }

  public stopDescentRumble(fadeTime: number = 1.8) {
    if (!this.ctx || !this.rumbleGain) return;
    const now = this.ctx.currentTime;
    try {
      this.rumbleGain.gain.cancelScheduledValues(now);
      this.rumbleGain.gain.setValueAtTime(
        Math.max(0.0001, this.rumbleGain.gain.value),
        now,
      );
      this.rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + fadeTime);
      const osc = this.rumbleOsc;
      window.setTimeout(() => {
        try {
          osc?.stop();
          osc?.disconnect();
        } catch {
          // ignore
        }
      }, fadeTime * 1000 + 80);
    } catch {
      // ignore
    }
    this.rumbleOsc = null;
    this.rumbleGain = null;
  }

  /**
   * Plays a delicate celestial chime when 360° dome stars appear.
   */
  public playStarChime(frequency: number = 880, delaySec: number = 0) {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + delaySec;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, t);
    osc.frequency.exponentialRampToValueAtTime(frequency * 1.012, t + 0.7);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.075, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.1);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 2.2);
  }

  /**
   * Plays a warm, intimate felt-piano note with soft hammer transient and stereo echo tail.
   */
  private playFeltPianoNote(
    freq: number,
    delaySec: number,
    durationSec: number = 2.8,
    volume: number = 0.075,
  ) {
    if (!this.ctx || !this.masterGain || this.isDisposed) return;

    const timeoutId = window.setTimeout(() => {
      if (!this.ctx || !this.masterGain || this.isDisposed || !this.padGain) {
        return;
      }
      const startAt = this.ctx.currentTime;

      const mainOsc = this.ctx.createOscillator();
      const warmSubOsc = this.ctx.createOscillator();
      const bellOverOsc = this.ctx.createOscillator();
      const noteFilter = this.ctx.createBiquadFilter();
      const noteGain = this.ctx.createGain();

      mainOsc.type = 'triangle';
      mainOsc.frequency.setValueAtTime(freq, startAt);

      warmSubOsc.type = 'sine';
      warmSubOsc.frequency.setValueAtTime(freq, startAt);
      warmSubOsc.detune.setValueAtTime(-4.0, startAt);

      bellOverOsc.type = 'sine';
      bellOverOsc.frequency.setValueAtTime(freq * 2.0, startAt);

      noteFilter.type = 'lowpass';
      noteFilter.frequency.setValueAtTime(1280, startAt);
      noteFilter.frequency.exponentialRampToValueAtTime(
        360,
        startAt + durationSec,
      );

      noteGain.gain.setValueAtTime(0.0001, startAt);
      noteGain.gain.linearRampToValueAtTime(volume, startAt + 0.035);
      noteGain.gain.exponentialRampToValueAtTime(
        volume * 0.42,
        startAt + durationSec * 0.32,
      );
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);

      const overtoneGain = this.ctx.createGain();
      overtoneGain.gain.setValueAtTime(0.14, startAt);

      mainOsc.connect(noteFilter);
      warmSubOsc.connect(noteFilter);
      bellOverOsc.connect(overtoneGain);
      overtoneGain.connect(noteFilter);
      noteFilter.connect(noteGain);
      noteGain.connect(this.masterGain);

      mainOsc.start(startAt);
      warmSubOsc.start(startAt);
      bellOverOsc.start(startAt);
      mainOsc.stop(startAt + durationSec + 0.06);
      warmSubOsc.stop(startAt + durationSec + 0.06);
      bellOverOsc.stop(startAt + durationSec + 0.06);

      // Soft nocturnal shimmer echo (+0.44s)
      const echoStart = startAt + 0.44;
      const echoOsc = this.ctx.createOscillator();
      const echoGain = this.ctx.createGain();
      echoOsc.type = 'sine';
      echoOsc.frequency.setValueAtTime(freq, echoStart);
      echoGain.gain.setValueAtTime(0.0001, echoStart);
      echoGain.gain.linearRampToValueAtTime(volume * 0.24, echoStart + 0.05);
      echoGain.gain.exponentialRampToValueAtTime(
        0.0001,
        echoStart + durationSec * 0.8,
      );
      echoOsc.connect(echoGain);
      echoGain.connect(this.masterGain);
      echoOsc.start(echoStart);
      echoOsc.stop(echoStart + durationSec * 0.85);
    }, Math.max(0, delaySec * 1000));

    this.melodyTimeouts.push(timeoutId);
  }

  /**
   * Plays an expressive legato solo cello/violin note with warm vibrato and bow swell.
   */
  private playSoloStringNote(
    freq: number,
    delaySec: number,
    durationSec: number = 3.2,
    volume: number = 0.058,
  ) {
    if (!this.ctx || !this.masterGain || this.isDisposed) return;

    const timeoutId = window.setTimeout(() => {
      if (!this.ctx || !this.masterGain || this.isDisposed || !this.padGain) {
        return;
      }
      const startAt = this.ctx.currentTime;

      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const vibOsc = this.ctx.createOscillator();
      const vibGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, startAt);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq, startAt);
      osc2.detune.setValueAtTime(6.5, startAt);

      // Expressive 5.2 Hz romantic string vibrato
      vibOsc.type = 'sine';
      vibOsc.frequency.setValueAtTime(5.2, startAt);
      vibGain.gain.setValueAtTime(0.0, startAt);
      vibGain.gain.linearRampToValueAtTime(freq * 0.0065, startAt + 0.55);
      vibOsc.connect(vibGain);
      vibGain.connect(osc1.frequency);
      vibGain.connect(osc2.frequency);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(520, startAt);
      filter.frequency.exponentialRampToValueAtTime(
        1120,
        startAt + durationSec * 0.4,
      );
      filter.frequency.exponentialRampToValueAtTime(
        480,
        startAt + durationSec,
      );

      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.linearRampToValueAtTime(volume, startAt + durationSec * 0.28);
      gain.gain.linearRampToValueAtTime(
        volume * 0.78,
        startAt + durationSec * 0.68,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc1.start(startAt);
      osc2.start(startAt);
      vibOsc.start(startAt);
      osc1.stop(startAt + durationSec + 0.06);
      osc2.stop(startAt + durationSec + 0.06);
      vibOsc.stop(startAt + durationSec + 0.06);
    }, Math.max(0, delaySec * 1000));

    this.melodyTimeouts.push(timeoutId);
  }

  /**
   * Plays a soft natural water ripple note for pond and fish movement.
   */
  public playWaterRipple(pitchMult: number = 1.0) {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const baseFreq = 540 * pitchMult;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.72, now + 0.28);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  /**
   * Starts the new Romantic Musical Score ("Nocturne Under the Emerald Sky" in Ab Major):
   * - 8-bar evolving velvet string harmony (Abmaj9 -> Eb/G -> Fm11 -> Cm7 -> Dbmaj9 -> Ab/C -> Bbm9 -> Eb9sus4)
   * - Rolling 6/8 intimate felt-piano arpeggios
   * - Singing solo cello & violin legato serenade melody
   */
  public startRomanticAuroraPads() {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;

    this.stopRomanticAuroraPads(0.25);

    const now = this.ctx.currentTime;
    this.padGain = this.ctx.createGain();
    this.padGain.gain.setValueAtTime(0.001, now);
    this.padGain.gain.exponentialRampToValueAtTime(0.165, now + 3.5);

    this.padFilter = this.ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.setValueAtTime(340, now);
    this.padFilter.frequency.exponentialRampToValueAtTime(780, now + 8.0);

    // 8-Bar Romantic Nocturne Progression in Ab Major (4.5s per bar = 36s cycle):
    // Bar 0: Abmaj9   (Ab2, Eb3, G3, C4, Bb4)
    // Bar 1: Ebadd9/G (G2, Eb3, Bb3, F4, G4)
    // Bar 2: Fm11     (F2, C3, Ab3, C4, Eb4)
    // Bar 3: Cm7add11 (C3, G3, Bb3, Eb4, F4)
    // Bar 4: Dbmaj9   (Db3, Ab3, C4,Eb4, F4)
    // Bar 5: Abadd9/C (C3, Eb3, Ab3, Bb3, Eb4)
    // Bar 6: Bbm9     (Bb2, F3, Ab3, C4, Db4)
    // Bar 7: Eb9sus4  (Eb3, Bb3, Db4, F4, Ab4)
    const chords: number[][] = [
      [103.83, 155.56, 196.0, 261.63, 466.16],
      [98.0, 155.56, 233.08, 349.23, 392.0],
      [87.31, 130.81, 207.65, 261.63, 311.13],
      [130.81, 196.0, 233.08, 311.13, 349.23],
      [138.59, 207.65, 261.63, 311.13, 349.23],
      [130.81, 155.56, 207.65, 233.08, 311.13],
      [116.54, 174.61, 207.65, 261.63, 277.18],
      [155.56, 233.08, 277.18, 349.23, 415.3],
    ];

    // Gentle 6/8 felt-piano accompaniment & singing high melody for each 4.5s bar
    const pianoBars: Array<
      Array<{ freq: number; offset: number; dur: number; vol: number }>
    > = [
      // Bar 0 (Abmaj9): Tender opening arpeggio into C5 - Eb5 - G5
      [
        { freq: 207.65, offset: 0.05, dur: 2.6, vol: 0.055 }, // Ab3
        { freq: 311.13, offset: 0.65, dur: 2.5, vol: 0.062 }, // Eb4
        { freq: 466.16, offset: 1.25, dur: 2.6, vol: 0.068 }, // Bb4
        { freq: 523.25, offset: 1.95, dur: 2.8, vol: 0.082 }, // C5
        { freq: 622.25, offset: 2.85, dur: 2.9, vol: 0.088 }, // Eb5
        { freq: 783.99, offset: 3.65, dur: 2.7, vol: 0.076 }, // G5
      ],
      // Bar 1 (Ebadd9/G): Warm breathing descent F5 - Eb5 - Bb4
      [
        { freq: 196.0, offset: 0.05, dur: 2.5, vol: 0.052 }, // G3
        { freq: 311.13, offset: 0.7, dur: 2.4, vol: 0.058 }, // Eb4
        { freq: 698.46, offset: 1.4, dur: 2.8, vol: 0.084 }, // F5
        { freq: 622.25, offset: 2.45, dur: 2.7, vol: 0.08 }, // Eb5
        { freq: 466.16, offset: 3.45, dur: 2.6, vol: 0.07 }, // Bb4
      ],
      // Bar 2 (Fm11): Deep emotional heart theme Ab4 - C5 - F5 - Eb5
      [
        { freq: 174.61, offset: 0.05, dur: 2.6, vol: 0.054 }, // F3
        { freq: 261.63, offset: 0.65, dur: 2.5, vol: 0.06 }, // C4
        { freq: 415.3, offset: 1.3, dur: 2.6, vol: 0.072 }, // Ab4
        { freq: 523.25, offset: 2.0, dur: 2.7, vol: 0.082 }, // C5
        { freq: 698.46, offset: 2.8, dur: 3.0, vol: 0.09 }, // F5
        { freq: 622.25, offset: 3.7, dur: 2.6, vol: 0.078 }, // Eb5
      ],
      // Bar 3 (Cm7add11): Gentle wistful answer Eb5 - D5 - C5 - Bb4
      [
        { freq: 261.63, offset: 0.05, dur: 2.5, vol: 0.052 }, // C4
        { freq: 392.0, offset: 0.7, dur: 2.4, vol: 0.06 }, // G4
        { freq: 622.25, offset: 1.45, dur: 2.7, vol: 0.082 }, // Eb5
        { freq: 554.37, offset: 2.4, dur: 2.5, vol: 0.076 }, // Db5
        { freq: 523.25, offset: 3.3, dur: 2.7, vol: 0.074 }, // C5
      ],
      // Bar 4 (Dbmaj9): Soaring romantic lift Db4 - F4 - Ab4 - C5 - F5 - Ab5
      [
        { freq: 277.18, offset: 0.05, dur: 2.6, vol: 0.056 }, // Db4
        { freq: 349.23, offset: 0.6, dur: 2.5, vol: 0.062 }, // F4
        { freq: 415.3, offset: 1.15, dur: 2.6, vol: 0.07 }, // Ab4
        { freq: 523.25, offset: 1.75, dur: 2.8, vol: 0.082 }, // C5
        { freq: 698.46, offset: 2.55, dur: 3.0, vol: 0.092 }, // F5
        { freq: 830.61, offset: 3.45, dur: 3.1, vol: 0.086 }, // Ab5
      ],
      // Bar 5 (Abadd9/C): Tender embrace G5 - Eb5 - C5 - Bb4
      [
        { freq: 261.63, offset: 0.05, dur: 2.6, vol: 0.054 }, // C4
        { freq: 415.3, offset: 0.7, dur: 2.5, vol: 0.064 }, // Ab4
        { freq: 783.99, offset: 1.4, dur: 2.8, vol: 0.086 }, // G5
        { freq: 622.25, offset: 2.35, dur: 2.7, vol: 0.082 }, // Eb5
        { freq: 523.25, offset: 3.35, dur: 2.7, vol: 0.075 }, // C5
      ],
      // Bar 6 (Bbm9): Intimate confession Db5 - C5 - Bb4 - Ab4 - F5
      [
        { freq: 233.08, offset: 0.05, dur: 2.6, vol: 0.054 }, // Bb3
        { freq: 349.23, offset: 0.65, dur: 2.5, vol: 0.062 }, // F4
        { freq: 554.37, offset: 1.35, dur: 2.7, vol: 0.08 }, // Db5
        { freq: 523.25, offset: 2.2, dur: 2.6, vol: 0.078 }, // C5
        { freq: 466.16, offset: 3.0, dur: 2.5, vol: 0.074 }, // Bb4
        { freq: 698.46, offset: 3.7, dur: 2.8, vol: 0.084 }, // F5
      ],
      // Bar 7 (Eb9sus4): Peaceful starlit resolution Eb5 - F5 - G5 - Eb5
      [
        { freq: 311.13, offset: 0.05, dur: 2.6, vol: 0.056 }, // Eb4
        { freq: 466.16, offset: 0.7, dur: 2.5, vol: 0.065 }, // Bb4
        { freq: 622.25, offset: 1.45, dur: 2.7, vol: 0.082 }, // Eb5
        { freq: 698.46, offset: 2.35, dur: 2.7, vol: 0.084 }, // F5
        { freq: 622.25, offset: 3.3, dur: 3.1, vol: 0.08 }, // Eb5
      ],
    ];

    // Expressive solo cello / warm violin counter-melody phrases
    const soloStringBars: Array<
      Array<{ freq: number; offset: number; dur: number; vol: number }>
    > = [
      [{ freq: 261.63, offset: 0.4, dur: 3.8, vol: 0.048 }], // C4 warm cello sustain
      [{ freq: 233.08, offset: 0.3, dur: 3.9, vol: 0.046 }], // Bb3
      [
        { freq: 207.65, offset: 0.25, dur: 2.2, vol: 0.045 }, // Ab3
        { freq: 261.63, offset: 2.3, dur: 2.1, vol: 0.05 }, // C4
      ],
      [{ freq: 196.0, offset: 0.3, dur: 3.8, vol: 0.046 }], // G3
      [
        { freq: 277.18, offset: 0.2, dur: 2.2, vol: 0.05 }, // Db4
        { freq: 349.23, offset: 2.25, dur: 2.2, vol: 0.054 }, // F4
      ],
      [{ freq: 311.13, offset: 0.3, dur: 3.9, vol: 0.052 }], // Eb4
      [
        { freq: 277.18, offset: 0.25, dur: 2.1, vol: 0.048 }, // Db4
        { freq: 261.63, offset: 2.2, dur: 2.2, vol: 0.048 }, // C4
      ],
      [{ freq: 233.08, offset: 0.3, dur: 4.0, vol: 0.05 }], // Bb3 warm resolution
    ];

    this.chordStep = 0;
    const initialFreqs = chords[0];

    this.padOscs = initialFreqs.map((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.detune.setValueAtTime((idx - 2) * 4.5, now);
      osc.connect(this.padFilter!);
      osc.start(now);
      return osc;
    });

    this.padFilter.connect(this.padGain);
    this.padGain.connect(this.masterGain);

    const scheduleBar = (stepIndex: number) => {
      if (!this.ctx || !this.padGain || this.isDisposed) return;
      const barIdx = stepIndex % chords.length;
      const targetChord = chords[barIdx];
      const tNow = this.ctx.currentTime;

      // Glide warm velvet pad oscillators to the next chord
      this.padOscs.forEach((osc, i) => {
        try {
          osc.frequency.cancelScheduledValues(tNow);
          osc.frequency.setValueAtTime(
            Math.max(40, osc.frequency.value),
            tNow,
          );
          osc.frequency.exponentialRampToValueAtTime(
            targetChord[i],
            tNow + 1.35,
          );
        } catch {
          // ignore
        }
      });

      // Schedule felt piano arpeggio & melody notes for this bar
      const notes = pianoBars[barIdx];
      notes.forEach((n) => {
        this.playFeltPianoNote(n.freq, n.offset, n.dur, n.vol);
      });

      // Schedule legato solo cello/violin counter-melody
      const stringNotes = soloStringBars[barIdx];
      stringNotes.forEach((s) => {
        this.playSoloStringNote(s.freq, s.offset, s.dur, s.vol);
      });
    };

    // Start first bar immediately and advance every 4.5 seconds
    scheduleBar(0);
    this.musicIntervalId = window.setInterval(() => {
      this.chordStep += 1;
      scheduleBar(this.chordStep);
    }, 4500);
  }

  public stopRomanticAuroraPads(fadeTime: number = 3.2) {
    if (this.musicIntervalId !== null) {
      clearInterval(this.musicIntervalId);
      this.musicIntervalId = null;
    }
    this.melodyTimeouts.forEach((id) => clearTimeout(id));
    this.melodyTimeouts = [];

    if (!this.ctx || !this.padGain) return;
    const now = this.ctx.currentTime;
    try {
      this.padGain.gain.cancelScheduledValues(now);
      this.padGain.gain.setValueAtTime(
        Math.max(0.0001, this.padGain.gain.value),
        now,
      );
      this.padGain.gain.exponentialRampToValueAtTime(0.0001, now + fadeTime);
      const oscs = this.padOscs;
      window.setTimeout(() => {
        oscs.forEach((o) => {
          try {
            o.stop();
            o.disconnect();
          } catch {
            // ignore
          }
        });
      }, fadeTime * 1000 + 100);
    } catch {
      // ignore
    }
    this.padOscs = [];
    this.padGain = null;
    this.padFilter = null;
  }

  /**
   * Starts gentle rising stone elevator sound for the return journey.
   */
  public startAscentRumble() {
    this.ensureRunning();
    if (!this.ctx || !this.masterGain) return;

    this.stopDescentRumble(0.2);

    const now = this.ctx.currentTime;
    this.rumbleGain = this.ctx.createGain();
    this.rumbleGain.gain.setValueAtTime(0.001, now);
    this.rumbleGain.gain.exponentialRampToValueAtTime(0.18, now + 1.5);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(60, now);
    filter.frequency.exponentialRampToValueAtTime(110, now + 9.0);

    this.rumbleOsc = this.ctx.createOscillator();
    this.rumbleOsc.type = 'triangle';
    this.rumbleOsc.frequency.setValueAtTime(38, now);
    this.rumbleOsc.frequency.exponentialRampToValueAtTime(56, now + 9.0);

    this.rumbleOsc.connect(filter);
    filter.connect(this.rumbleGain);
    this.rumbleGain.connect(this.masterGain);

    this.rumbleOsc.start(now);
  }

  public dispose() {
    this.isDisposed = true;
    this.stopDescentRumble(0.15);
    this.stopRomanticAuroraPads(0.15);
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
