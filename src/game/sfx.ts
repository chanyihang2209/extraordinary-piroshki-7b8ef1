// Tiny synthesized sound effects via WebAudio, so the game ships without audio files.

export class Sfx {
  private ctx: AudioContext | null = null
  private noise: AudioBuffer | null = null
  private master: GainNode | null = null

  private ensure() {
    if (this.ctx) return this.ctx
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    const ctx = new Ctor()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0.5
    this.master.connect(ctx.destination)
    const len = ctx.sampleRate * 1.5
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    this.noise = buf
    return ctx
  }

  resume() {
    const ctx = this.ensure()
    if (ctx && ctx.state === 'suspended') void ctx.resume()
  }

  private burst(opts: { volume: number; duration: number; freq: number; q?: number; type?: BiquadFilterType; pitchDrop?: number; delay?: number }) {
    const ctx = this.ensure()
    if (!ctx || !this.noise || !this.master || opts.volume <= 0.001) return
    const t = ctx.currentTime + (opts.delay ?? 0)
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const filter = ctx.createBiquadFilter()
    filter.type = opts.type ?? 'lowpass'
    filter.frequency.setValueAtTime(opts.freq, t)
    if (opts.pitchDrop) filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.freq * opts.pitchDrop), t + opts.duration)
    filter.Q.value = opts.q ?? 0.7
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(opts.volume, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + opts.duration)
    src.connect(filter).connect(gain).connect(this.master)
    src.start(t, Math.random() * 0.5)
    src.stop(t + opts.duration + 0.05)
  }

  private tone(opts: { volume: number; duration: number; freq: number; endFreq?: number; type?: OscillatorType; delay?: number }) {
    const ctx = this.ensure()
    if (!ctx || !this.master || opts.volume <= 0.001) return
    const t = ctx.currentTime + (opts.delay ?? 0)
    const osc = ctx.createOscillator()
    osc.type = opts.type ?? 'sine'
    osc.frequency.setValueAtTime(opts.freq, t)
    if (opts.endFreq) osc.frequency.exponentialRampToValueAtTime(opts.endFreq, t + opts.duration)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(opts.volume, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + opts.duration)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + opts.duration + 0.05)
  }

  shot(kind: string, volume = 1) {
    switch (kind) {
      case 'shotgun':
        this.burst({ volume: 0.9 * volume, duration: 0.35, freq: 2400, pitchDrop: 0.15 })
        this.tone({ volume: 0.4 * volume, duration: 0.2, freq: 120, endFreq: 40 })
        break
      case 'sniper':
      case 'revolver':
        this.burst({ volume: 0.9 * volume, duration: 0.5, freq: 3500, pitchDrop: 0.1 })
        this.tone({ volume: 0.5 * volume, duration: 0.3, freq: 90, endFreq: 30 })
        break
      case 'lmg':
      case 'rifle':
      case 'dmr':
        this.burst({ volume: 0.6 * volume, duration: 0.16, freq: 3000, pitchDrop: 0.25 })
        this.tone({ volume: 0.25 * volume, duration: 0.1, freq: 140, endFreq: 50 })
        break
      case 'katana':
        this.burst({ volume: 0.35 * volume, duration: 0.18, freq: 5000, type: 'bandpass', q: 3, pitchDrop: 0.4 })
        break
      case 'star':
        this.burst({ volume: 0.25 * volume, duration: 0.12, freq: 6000, type: 'highpass' })
        break
      default:
        this.burst({ volume: 0.5 * volume, duration: 0.12, freq: 3800, pitchDrop: 0.3 })
        this.tone({ volume: 0.15 * volume, duration: 0.08, freq: 180, endFreq: 70 })
    }
  }

  explosion(volume = 1) {
    this.burst({ volume: 1.0 * volume, duration: 1.1, freq: 900, pitchDrop: 0.08 })
    this.tone({ volume: 0.7 * volume, duration: 0.8, freq: 70, endFreq: 25 })
  }

  hit() {
    this.tone({ volume: 0.18, duration: 0.06, freq: 1400, type: 'square' })
  }

  headshot() {
    this.tone({ volume: 0.25, duration: 0.12, freq: 1900, type: 'triangle' })
    this.tone({ volume: 0.2, duration: 0.2, freq: 2600, type: 'triangle', delay: 0.05 })
  }

  kill() {
    this.tone({ volume: 0.2, duration: 0.15, freq: 900, endFreq: 1500, type: 'triangle' })
  }

  hurt() {
    this.burst({ volume: 0.35, duration: 0.18, freq: 600, pitchDrop: 0.5 })
  }

  reload() {
    this.burst({ volume: 0.25, duration: 0.05, freq: 4000, type: 'bandpass', q: 4 })
    this.burst({ volume: 0.3, duration: 0.06, freq: 2500, type: 'bandpass', q: 4, delay: 0.25 })
  }

  click() {
    this.tone({ volume: 0.12, duration: 0.03, freq: 2200, type: 'square' })
  }

  pickup() {
    this.tone({ volume: 0.2, duration: 0.1, freq: 600, endFreq: 1200, type: 'triangle' })
  }

  skill() {
    this.tone({ volume: 0.2, duration: 0.3, freq: 300, endFreq: 900, type: 'sawtooth' })
  }

  grapple() {
    this.burst({ volume: 0.3, duration: 0.3, freq: 3000, type: 'bandpass', q: 2, pitchDrop: 0.3 })
  }

  dispose() {
    void this.ctx?.close()
    this.ctx = null
  }
}
