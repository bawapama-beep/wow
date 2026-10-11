let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let muted = false;

export function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    masterGain.gain.value = 0.3;
  } catch {
    audioCtx = null;
  }
}

export function setMuted(m: boolean) {
  muted = m;
  if (masterGain) masterGain.gain.value = m ? 0 : 0.3;
}

export function isMuted() { return muted; }

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.3, detune = 0) {
  if (!audioCtx || !masterGain || muted) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playNoise(duration: number, volume = 0.1) {
  if (!audioCtx || !masterGain || muted) return;
  const bufferSize = audioCtx.sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 2000;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  source.start();
}

export const Audio = {
  uiClick() { playTone(800, 0.08, 'square', 0.15); },
  nearMiss() {
    playTone(600, 0.15, 'sine', 0.2);
    playTone(900, 0.1, 'sine', 0.15);
    playNoise(0.08, 0.05);
  },
  gapSkip() {
    playTone(400, 0.2, 'sine', 0.25);
    playTone(800, 0.15, 'sine', 0.2);
    playTone(1200, 0.1, 'sine', 0.15);
  },
  graze() { playNoise(0.04, 0.08); playTone(200, 0.05, 'sawtooth', 0.05); },
  pickup() { playTone(1000, 0.1, 'sine', 0.2); playTone(1500, 0.08, 'sine', 0.15); },
  shieldHit() {
    playNoise(0.2, 0.2);
    playTone(150, 0.3, 'square', 0.2);
  },
  crash() {
    playNoise(0.5, 0.3);
    playTone(80, 0.5, 'sawtooth', 0.25);
    playTone(60, 0.6, 'square', 0.15);
  },
  boost() {
    playTone(200, 0.3, 'sawtooth', 0.15);
    playTone(400, 0.2, 'sawtooth', 0.1);
    playNoise(0.15, 0.08);
  },
  missionComplete() {
    playTone(523, 0.15, 'sine', 0.2);
    setTimeout(() => playTone(659, 0.15, 'sine', 0.2), 100);
    setTimeout(() => playTone(784, 0.2, 'sine', 0.25), 200);
  },
  newRecord() {
    playTone(523, 0.12, 'sine', 0.2);
    setTimeout(() => playTone(659, 0.12, 'sine', 0.2), 80);
    setTimeout(() => playTone(784, 0.12, 'sine', 0.2), 160);
    setTimeout(() => playTone(1047, 0.3, 'sine', 0.25), 240);
  },
};
