// generate_audio_assets.js
// Generates realistic, high-fidelity 16-bit 44.1kHz WAV sound effects for the RVDP simulation.
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const AUDIO_DIR = path.join(__dirname, 'public', 'audio');

if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

function createWavBuffer(samples, numChannels = 2, sampleRate = SAMPLE_RATE) {
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const numSamples = Math.floor(samples[0].length);
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20);  // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28); // ByteRate
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let s = samples[ch][i];
      s = Math.max(-1, Math.min(1, s));
      const val = s < 0 ? s * 32768 : s * 32767;
      buffer.writeInt16LE(Math.floor(val), offset);
      offset += 2;
    }
  }

  return buffer;
}

// Helper noise generators and filters
function makeNoise(len) {
  const n = new Float32Array(len);
  for (let i = 0; i < len; i++) n[i] = Math.random() * 2 - 1;
  return n;
}

// 1. Bus Engine Idle: 4.0s seamless loop
function generateBusEngineIdle() {
  const duration = 4.0;
  const len = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(len);
  const right = new Float32Array(len);

  // 650 RPM 6-cyl diesel => firing rate ~ 32.5 Hz (cycle = 1/32.5 = 0.03077 s)
  const firingPeriod = SAMPLE_RATE / 32.5;

  let phaseRumble = 0;
  let phaseSub = 0;

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const cyclePos = i % firingPeriod;
    const cycleFrac = cyclePos / firingPeriod;

    // Sharp combustion pulse
    let pulse = Math.exp(-cycleFrac * 12.0) * Math.sin(cycleFrac * Math.PI * 4);

    // Diesel knock/clatter (mechanical high-pressure injection click)
    let knock = 0;
    if (cycleFrac < 0.25) {
      const kFrac = cycleFrac / 0.25;
      knock = Math.exp(-kFrac * 9.0) * (Math.sin(kFrac * Math.PI * 34) * 0.4 + (Math.random() - 0.5) * 0.5);
    }

    // Deep engine block rumble (sub-bass harmonics)
    phaseRumble += (2 * Math.PI * 32.5) / SAMPLE_RATE;
    phaseSub += (2 * Math.PI * 16.25) / SAMPLE_RATE;
    const rumble = Math.sin(phaseRumble) * 0.35 + Math.sin(phaseSub) * 0.25 + Math.sin(phaseRumble * 2) * 0.15;

    // Subtle cam/valve rattle
    const rattle = (Math.random() - 0.5) * 0.08 * (1 + 0.5 * Math.sin(phaseRumble * 3));

    let sample = (pulse * 0.45 + knock * 0.3 + rumble * 0.35 + rattle) * 0.8;
    // Soft saturation for analog warmth
    sample = Math.tanh(sample * 1.4) * 0.75;

    left[i] = sample;
    right[i] = sample * 0.96 + (Math.random() - 0.5) * 0.02;
  }

  // Crossfade ends for seamless loop (0.15s)
  const xfadeLen = Math.floor(0.15 * SAMPLE_RATE);
  for (let i = 0; i < xfadeLen; i++) {
    const p = i / xfadeLen;
    left[i] = left[i] * p + left[len - xfadeLen + i] * (1 - p);
    right[i] = right[i] * p + right[len - xfadeLen + i] * (1 - p);
  }

  return [left, right];
}

// 2. Bus Engine Drive: 4.0s seamless loop
function generateBusEngineDrive() {
  const duration = 4.0;
  const len = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(len);
  const right = new Float32Array(len);

  // ~1700 RPM 6-cyl diesel => firing rate ~ 85 Hz
  const firingPeriod = SAMPLE_RATE / 85.0;
  let phaseRumble = 0;
  let phaseTurbo = 0;
  let phaseExhaust = 0;

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const cyclePos = i % firingPeriod;
    const cycleFrac = cyclePos / firingPeriod;

    // Strong power stroke
    const pulse = Math.exp(-cycleFrac * 6.0) * Math.sin(cycleFrac * Math.PI * 3.5);

    // Combustion clatter under load
    const knock = Math.exp(-cycleFrac * 7.0) * (Math.sin(cycleFrac * Math.PI * 28) * 0.3 + (Math.random() - 0.5) * 0.3);

    phaseRumble += (2 * Math.PI * 85.0) / SAMPLE_RATE;
    phaseExhaust += (2 * Math.PI * 170.0) / SAMPLE_RATE;
    const exhaust = Math.sin(phaseRumble) * 0.35 + Math.sin(phaseExhaust) * 0.3 + Math.sin(phaseRumble * 3) * 0.15;

    // Turbocharger spool whine (~2200 Hz with slight load flutter)
    const turboFreq = 2200 + Math.sin(t * 8) * 40;
    phaseTurbo += (2 * Math.PI * turboFreq) / SAMPLE_RATE;
    const turboWhine = Math.sin(phaseTurbo) * 0.12;
    const airHiss = (Math.random() - 0.5) * 0.08;

    let sample = pulse * 0.4 + knock * 0.25 + exhaust * 0.35 + turboWhine + airHiss;
    sample = Math.tanh(sample * 1.5) * 0.85;

    left[i] = sample;
    right[i] = sample * 0.95 + turboWhine * 0.1;
  }

  // Crossfade ends for seamless loop (0.15s)
  const xfadeLen = Math.floor(0.15 * SAMPLE_RATE);
  for (let i = 0; i < xfadeLen; i++) {
    const p = i / xfadeLen;
    left[i] = left[i] * p + left[len - xfadeLen + i] * (1 - p);
    right[i] = right[i] * p + right[len - xfadeLen + i] * (1 - p);
  }

  return [left, right];
}

// 3. Road Tire Movement: 4.0s seamless loop
function generateRoadTire() {
  const duration = 4.0;
  const len = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(len);
  const right = new Float32Array(len);

  // Lowpass filtered noise + tread rhythm
  let lpL = 0, lpR = 0;
  let lpBassL = 0, lpBassR = 0;

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const whiteL = Math.random() * 2 - 1;
    const whiteR = Math.random() * 2 - 1;

    // Lowpass filter ~ 400 Hz
    lpL += (whiteL - lpL) * 0.06;
    lpR += (whiteR - lpR) * 0.06;

    // Sub-bass road surface bumpiness ~ 60 Hz
    lpBassL += (whiteL - lpBassL) * 0.015;
    lpBassR += (whiteR - lpBassR) * 0.015;

    // Tire tread modulation ~ 38 Hz
    const tread = 1.0 + 0.15 * Math.sin(2 * Math.PI * 38 * t);

    // Subtle high frequency hiss for asphalt texture
    const hissL = whiteL * 0.035;
    const hissR = whiteR * 0.035;

    const sL = (lpL * 0.65 * tread + lpBassL * 0.45 + hissL) * 0.9;
    const sR = (lpR * 0.65 * tread + lpBassR * 0.45 + hissR) * 0.9;

    left[i] = Math.tanh(sL);
    right[i] = Math.tanh(sR);
  }

  // Crossfade ends for seamless loop
  const xfadeLen = Math.floor(0.15 * SAMPLE_RATE);
  for (let i = 0; i < xfadeLen; i++) {
    const p = i / xfadeLen;
    left[i] = left[i] * p + left[len - xfadeLen + i] * (1 - p);
    right[i] = right[i] * p + right[len - xfadeLen + i] * (1 - p);
  }

  return [left, right];
}

// 4. Vehicle Collision Impact: 2.8s one-shot
function generateCollisionImpact() {
  const duration = 2.8;
  const len = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(len);
  const right = new Float32Array(len);

  // Multiple metallic resonant modes
  const metalFreqs = [185, 290, 430, 680, 1150, 1620];
  const metalAmps = [0.4, 0.35, 0.28, 0.22, 0.15, 0.1];
  const phases = new Float32Array(metalFreqs.length);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;

    // Sub-bass impact thud (80 Hz sweeping down to 24 Hz in 0.3s)
    let sub = 0;
    if (t < 0.8) {
      const sweepFreq = Math.max(24, 85 - t * 140);
      const subEnv = Math.exp(-t * 7.0);
      sub = Math.sin(2 * Math.PI * sweepFreq * t) * subEnv * 1.5;
    }

    // Heavy chassis crunch (broadband noise burst decaying in 0.35s)
    let crunch = 0;
    if (t < 0.6) {
      const crunchEnv = Math.exp(-t * 9.0);
      crunch = (Math.random() * 2 - 1) * crunchEnv * 1.4;
    }

    // Metallic body deformation ringing
    let metal = 0;
    for (let m = 0; m < metalFreqs.length; m++) {
      phases[m] += (2 * Math.PI * metalFreqs[m]) / SAMPLE_RATE;
      const decay = Math.exp(-t * (3.5 + m * 1.8));
      metal += Math.sin(phases[m]) * metalAmps[m] * decay;
    }

    // Metal scrape & shear between 0.05s and 0.45s
    let scrape = 0;
    if (t > 0.04 && t < 0.45) {
      const scEnv = Math.sin((t - 0.04) / 0.41 * Math.PI);
      scrape = (Math.random() - 0.5) * scEnv * Math.sin(2 * Math.PI * 820 * t) * 0.5;
    }

    // Low-end reverb boom tail decaying over 2.5s
    const tail = (Math.random() * 2 - 1) * 0.15 * Math.exp(-t * 2.0);

    let sample = sub * 0.7 + crunch * 0.5 + metal * 0.45 + scrape * 0.3 + tail;
    // Hard limiter / saturation
    sample = Math.tanh(sample * 1.8) * 0.95;

    left[i] = sample;
    right[i] = sample * 0.94 + metal * 0.08;
  }

  return [left, right];
}

// 5. Metal / Glass Crash: 2.2s one-shot
function generateMetalCrash() {
  const duration = 2.2;
  const len = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(len);
  const right = new Float32Array(len);

  // Generate safety glass shatter (thousands of tempered glass granules bouncing)
  const glassClicks = [];
  const numPebbles = 120;
  for (let k = 0; k < numPebbles; k++) {
    glassClicks.push({
      t: 0.02 + Math.pow(Math.random(), 1.7) * 1.4,
      freq: 2800 + Math.random() * 6500,
      amp: (0.15 + Math.random() * 0.35) * (1 - k / numPebbles * 0.6),
      decay: 25 + Math.random() * 60
    });
  }

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;

    // Initial glass rupture burst (0.0 to 0.12s)
    let shatter = 0;
    if (t < 0.25) {
      const shEnv = Math.exp(-t * 16.0);
      shatter = (Math.random() * 2 - 1) * shEnv * 1.2;
    }

    // Sheet metal buckle ping (720 Hz + 1450 Hz)
    const buckle = (Math.sin(2 * Math.PI * 720 * t) + 0.6 * Math.sin(2 * Math.PI * 1450 * t)) * Math.exp(-t * 6.5) * 0.4;

    // Clattering glass granules
    let pebblesL = 0;
    let pebblesR = 0;
    for (let k = 0; k < glassClicks.length; k++) {
      const g = glassClicks[k];
      const dt = t - g.t;
      if (dt >= 0 && dt < 0.08) {
        const pVal = Math.sin(2 * Math.PI * g.freq * dt) * Math.exp(-dt * g.decay) * g.amp;
        if (k % 2 === 0) pebblesL += pVal;
        else pebblesR += pVal;
      }
    }

    let sL = shatter * 0.6 + buckle * 0.5 + pebblesL * 0.8;
    let sR = shatter * 0.6 + buckle * 0.5 + pebblesR * 0.8;

    left[i] = Math.tanh(sL) * 0.85;
    right[i] = Math.tanh(sR) * 0.85;
  }

  return [left, right];
}

// 6. Ambulance Emergency Siren: 4.0s seamless loop
function generateAmbulanceSiren() {
  const duration = 4.0;
  const len = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(len);
  const right = new Float32Array(len);

  // Standard dual-sweep emergency siren: 2 full wails in exactly 4.0 seconds (period = 2.0s)
  // Frequency swings smoothly between 660 Hz and 980 Hz
  let phase = 0;

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;

    // Periodic sweep function: 2.0 second cycle
    const cycleFrac = (t % 2.0) / 2.0; // 0 to 1
    // Smooth cosine wave oscillation
    const mod = 0.5 * (1 - Math.cos(2 * Math.PI * cycleFrac));
    const instFreq = 660 + mod * 320; // 660 to 980 Hz

    phase += (2 * Math.PI * instFreq) / SAMPLE_RATE;

    // Authentic emergency horn speaker harmonics (1st, 2nd, 3rd, 4th, 5th)
    const h1 = Math.sin(phase);
    const h2 = Math.sin(phase * 2) * 0.42;
    const h3 = Math.sin(phase * 3) * 0.32;
    const h4 = Math.sin(phase * 4) * 0.16;
    const h5 = Math.sin(phase * 5) * 0.09;

    let siren = (h1 + h2 + h3 + h4 + h5) * 0.6;
    // Horn flare saturation
    siren = Math.tanh(siren * 1.5) * 0.8;

    // Slight stereo spread and ambient reflection
    left[i] = siren;
    right[i] = siren * 0.94 + Math.sin(phase * 1.002) * 0.06;
  }

  // Exact period boundary match (2 full cycles in 4s => zero phase jump!)
  return [left, right];
}

// 7. Ambulance Door Open: 1.2s one-shot
function generateAmbulanceDoorOpen() {
  const duration = 1.2;
  const len = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(len);
  const right = new Float32Array(len);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;

    // Handle latch pull click (t = 0.02s)
    let latch = 0;
    if (t >= 0.02 && t < 0.12) {
      const dt = t - 0.02;
      latch = (Math.sin(2 * Math.PI * 1850 * dt) * 0.4 + Math.sin(2 * Math.PI * 850 * dt) * 0.5) * Math.exp(-dt * 45);
    }

    // Heavy van door swing glide / air whoosh (t = 0.08 to 0.7s)
    let glide = 0;
    if (t >= 0.08 && t < 0.75) {
      const dt = (t - 0.08) / 0.67;
      const env = Math.sin(dt * Math.PI);
      const creak = Math.sin(2 * Math.PI * (420 - dt * 80) * (t - 0.08)) * 0.18;
      const noise = (Math.random() * 2 - 1) * 0.12;
      glide = (creak + noise) * env;
    }

    // Detent stop thump (t = 0.75s)
    let stopThump = 0;
    if (t >= 0.75 && t < 0.95) {
      const dt = t - 0.75;
      stopThump = Math.sin(2 * Math.PI * 110 * dt) * Math.exp(-dt * 25) * 0.5;
    }

    const s = Math.tanh((latch * 0.9 + glide * 0.7 + stopThump * 0.8) * 1.4);
    left[i] = s;
    right[i] = s;
  }

  return [left, right];
}

// 8. Ambulance Door Close: 1.0s one-shot
function generateAmbulanceDoorClose() {
  const duration = 1.0;
  const len = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(len);
  const right = new Float32Array(len);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;

    // Door swing whoosh (t = 0.0 to 0.28s)
    let whoosh = 0;
    if (t < 0.28) {
      const dt = t / 0.28;
      whoosh = (Math.random() * 2 - 1) * Math.sin(dt * Math.PI) * 0.18;
    }

    // Solid automotive door slam at t = 0.28s
    let slam = 0;
    let latchSnap = 0;
    if (t >= 0.28) {
      const dt = t - 0.28;
      // Heavy rubber gasket & cabin air displacement thump (65 Hz)
      slam = Math.sin(2 * Math.PI * 72 * dt) * Math.exp(-dt * 18) * 1.3;
      // Sharp mechanical striker catch
      latchSnap = (Math.sin(2 * Math.PI * 1450 * dt) * 0.5 + Math.sin(2 * Math.PI * 2600 * dt) * 0.3) * Math.exp(-dt * 65);
    }

    const s = Math.tanh((whoosh + slam * 0.8 + latchSnap * 0.7) * 1.5) * 0.95;
    left[i] = s;
    right[i] = s;
  }

  return [left, right];
}

// 9. Stretcher Movement / Roll: 3.0s seamless loop
function generateStretcherRoll() {
  const duration = 3.0;
  const len = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(len);
  const right = new Float32Array(len);

  let lpL = 0, lpR = 0;

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;

    // Medical gurney polyurethane caster rolling sound (bandpassed chatter 300-800 Hz)
    const whiteL = Math.random() * 2 - 1;
    const whiteR = Math.random() * 2 - 1;
    lpL += (whiteL - lpL) * 0.08;
    lpR += (whiteR - lpR) * 0.08;

    // Subtle metallic frame jingle / clink pulses
    const pulse1 = Math.sin(2 * Math.PI * 12 * t);
    const clink = (pulse1 > 0.94 ? 1 : 0) * Math.sin(2 * Math.PI * 1350 * t) * 0.15;

    const sL = (lpL * 0.65 + clink) * 0.8;
    const sR = (lpR * 0.65 + clink * 0.7) * 0.8;

    left[i] = Math.tanh(sL);
    right[i] = Math.tanh(sR);
  }

  // Crossfade ends for seamless loop
  const xfadeLen = Math.floor(0.12 * SAMPLE_RATE);
  for (let i = 0; i < xfadeLen; i++) {
    const p = i / xfadeLen;
    left[i] = left[i] * p + left[len - xfadeLen + i] * (1 - p);
    right[i] = right[i] * p + right[len - xfadeLen + i] * (1 - p);
  }

  return [left, right];
}

// 10. Medical Heartbeat Monitor: 2.0s seamless loop
function generateMedicalHeartbeat() {
  const duration = 2.0;
  const len = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(len);
  const right = new Float32Array(len);

  // Hospital ECG monitor beep every 1.0 second
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const cycleT = t % 1.0;

    let beep = 0;
    if (cycleT < 0.085) {
      // 980 Hz pure medical tone with smooth envelope
      const env = Math.sin((cycleT / 0.085) * Math.PI);
      beep = Math.sin(2 * Math.PI * 980 * cycleT) * env * 0.45;
    }

    left[i] = beep;
    right[i] = beep;
  }

  return [left, right];
}

// Generate all sound assets
const assets = [
  { name: 'bus_engine_idle.wav', fn: generateBusEngineIdle },
  { name: 'bus_engine_drive.wav', fn: generateBusEngineDrive },
  { name: 'road_tire.wav', fn: generateRoadTire },
  { name: 'collision_impact.wav', fn: generateCollisionImpact },
  { name: 'metal_crash.wav', fn: generateMetalCrash },
  { name: 'ambulance_siren.wav', fn: generateAmbulanceSiren },
  { name: 'ambulance_door_open.wav', fn: generateAmbulanceDoorOpen },
  { name: 'ambulance_door_close.wav', fn: generateAmbulanceDoorClose },
  { name: 'stretcher_roll.wav', fn: generateStretcherRoll },
  { name: 'medical_heartbeat.wav', fn: generateMedicalHeartbeat }
];

console.log('Generating audio assets into ' + AUDIO_DIR + ' ...');
for (const a of assets) {
  const samples = a.fn();
  const buffer = createWavBuffer(samples);
  const filePath = path.join(AUDIO_DIR, a.name);
  fs.writeFileSync(filePath, buffer);
  console.log(`✓ ${a.name} (${(buffer.length / 1024).toFixed(1)} KB)`);
}
console.log('All audio assets generated successfully.');

