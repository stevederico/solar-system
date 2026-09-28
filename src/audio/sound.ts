type AudioContextClass = typeof AudioContext;

const MASTER_VOLUME = 0.5;
const MUTE_KEY = 'solar-system-simulator-muted';

function loadMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Blocked storage only means the choice is not remembered.
  }
}

const DRONE_NOTES = [55, 82.41, 110.5];
const WIN_NOTES = [523.25, 659.25, 783.99, 1046.5];

/** All sound is made with oscillators and noise. There are no audio files. */
export class Sound {
  private context?: AudioContext;
  private master?: GainNode;
  private engine?: { gain: GainNode };
  private muted = loadMuted();

  get isMuted(): boolean {
    return this.muted;
  }

  /** Start audio. Browsers only allow this after a tap, click or key press. */
  unlock(): void {
    if (this.context) {
      void this.context.resume();
      return;
    }
    const Context: AudioContextClass | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextClass }).webkitAudioContext;
    if (!Context) return;
    try {
      this.context = new Context();
    } catch {
      return;
    }
    this.master = this.context.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
    this.master.connect(this.context.destination);
    this.startDrone();
    this.startEngine();
  }

  /** Mute or unmute, and remember the choice for the next visit. */
  setMuted(muted: boolean): void {
    this.muted = muted;
    saveMuted(muted);
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, this.context.currentTime, 0.05);
    }
  }

  private startDrone(): void {
    const { context, master } = this;
    if (!context || !master) return;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = context.createGain();
    gain.gain.value = 0.11;
    filter.connect(gain).connect(master);

    const sweep = context.createOscillator();
    sweep.frequency.value = 0.05;
    const depth = context.createGain();
    depth.gain.value = 180;
    sweep.connect(depth).connect(filter.frequency);
    sweep.start();

    for (const note of DRONE_NOTES) {
      for (const detune of [-6, 7]) {
        const oscillator = context.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = note;
        oscillator.detune.value = detune;
        oscillator.connect(filter);
        oscillator.start();
      }
    }
  }

  private createNoise(seconds: number): AudioBufferSourceNode | undefined {
    const { context } = this;
    if (!context) return undefined;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let n = 0; n < data.length; n++) data[n] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    source.buffer = buffer;
    return source;
  }

  private startEngine(): void {
    const { context, master } = this;
    const noise = this.createNoise(2);
    if (!context || !master || !noise) return;
    noise.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 260;
    filter.Q.value = 0.7;
    const gain = context.createGain();
    gain.gain.value = 0;
    noise.connect(filter).connect(gain).connect(master);
    noise.start();
    this.engine = { gain };
  }

  /** Fade the thruster rumble in or out. */
  setEngine(on: boolean): void {
    if (!this.engine || !this.context) return;
    this.engine.gain.gain.setTargetAtTime(on ? 0.35 : 0, this.context.currentTime, 0.06);
  }

  private tone(frequency: number, start: number, length: number, volume: number, type: OscillatorType = 'sine', slideTo?: number): void {
    const { context, master } = this;
    if (!context || !master) return;
    const at = context.currentTime + start;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, at + length);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    oscillator.connect(gain).connect(master);
    oscillator.start(at);
    oscillator.stop(at + length + 0.05);
  }

  /** Short tick for buttons. */
  click(): void {
    this.tone(880, 0, 0.08, 0.12, 'triangle');
  }

  /** Two note chime when a body is selected. */
  select(): void {
    this.tone(660, 0, 0.18, 0.12);
    this.tone(990, 0.07, 0.25, 0.1);
  }

  /** Rising rush for launch. */
  launch(): void {
    const { context, master } = this;
    const noise = this.createNoise(1.2);
    if (!context || !master || !noise) return;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(200, context.currentTime);
    filter.frequency.exponentialRampToValueAtTime(2400, context.currentTime + 1);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.5, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.2);
    noise.connect(filter).connect(gain).connect(master);
    noise.start();
    this.tone(110, 0, 0.9, 0.25, 'sawtooth', 440);
  }

  /** Swoop for a gravity assist. */
  assist(): void {
    this.tone(330, 0, 0.5, 0.2, 'sine', 1320);
    this.tone(495, 0.12, 0.5, 0.14, 'sine', 1980);
  }

  /** Rising arpeggio for a win. */
  win(): void {
    WIN_NOTES.forEach((note, n) => this.tone(note, n * 0.12, 0.6, 0.18, 'triangle'));
  }

  /** Falling tone for a lost mission. */
  lose(): void {
    this.tone(300, 0, 0.7, 0.22, 'sawtooth', 70);
  }
}
