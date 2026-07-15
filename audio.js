/**
 * audio.js — Bites & Baits
 * Gerencia sons via Web Audio API + arquivos .wav
 */

const Audio = (() => {
  let ctx = null;
  const buffers = {};
  let ambientNode = null;
  let ambientGain = null;

  const FILES = {
    splash:       'assets/sounds/splash.wav',
    bloop:        'assets/sounds/bloop.wav',
    reel:         'assets/sounds/reel.wav',
    point_normal: 'assets/sounds/point_normal.wav',
    point_special:'assets/sounds/point_special.wav',
    uhoh:         'assets/sounds/uhoh.wav',
  };

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    return Promise.all(
      Object.entries(FILES).map(([key, url]) =>
        fetch(url)
          .then(r => r.arrayBuffer())
          .then(buf => ctx.decodeAudioData(buf))
          .then(decoded => { buffers[key] = decoded; })
          .catch(() => { console.warn(`Som não encontrado: ${url}`); })
      )
    );
  }

  function play(name, { volume = 1, loop = false } = {}) {
    if (!ctx || !buffers[name]) {
      // Fallback sintético se o arquivo não carregou
      _synthetic(name);
      return null;
    }
    if (ctx.state === 'suspended') ctx.resume();
    const src  = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer     = buffers[name];
    src.loop       = loop;
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    return { src, gain };
  }

  function stop(node) {
    if (!node) return;
    try { node.src.stop(); } catch(e) {}
  }

  // ── Sons sintéticos (fallback ou gerados) ──────────────────────────────────

  function _synthetic(name) {
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    switch(name) {
      case 'chomp':      _chomp(); break;
      case 'tension':    _tensionClick(); break;
      case 'snap':       _snap(); break;
      case 'splash':     _splashSynth(); break;
    }
  }

  // Chomp — peixe mordendo (click grave + envelope curto)
  function _chomp() {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  // Click de tensão crescente
  function _tensionClick() {
    const buf  = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src  = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    gain.gain.value = 0.3;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  // Snap — linha arrebentando
  function _snap() {
    const buf  = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 20);
    }
    const src  = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    gain.gain.value = 0.8;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  // Splash sintético (ruído filtrado)
  function _splashSynth() {
    const buf  = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 8);
    }
    const src    = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain   = ctx.createGain();
    src.buffer      = buf;
    filter.type     = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value  = 0.5;
    gain.gain.value = 0.5;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  // ── Ambiente ───────────────────────────────────────────────────────────────

  function startAmbient() {
    if (!ctx || ambientNode) return;
    if (ctx.state === 'suspended') ctx.resume();

    // Ruído rosa filtrado → som de água
    const bufSize = ctx.sampleRate * 4;
    const buf     = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data    = buf.getChannelData(0);

    // Ruído de Voss (pink noise aproximado)
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0;
    for (let i = 0; i < bufSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886*b0 + white*0.0555179;
      b1 = 0.99332*b1 + white*0.0750759;
      b2 = 0.96900*b2 + white*0.1538520;
      b3 = 0.86650*b3 + white*0.3104856;
      b4 = 0.55000*b4 + white*0.5329522;
      b5 = -0.7616*b5 - white*0.0168980;
      data[i] = (b0+b1+b2+b3+b4+b5+white*0.5362) * 0.11;
    }

    const src    = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    ambientGain  = ctx.createGain();

    src.buffer        = buf;
    src.loop          = true;
    filter.type       = 'lowpass';
    filter.frequency.value = 600;
    ambientGain.gain.value = 0.18;

    src.connect(filter);
    filter.connect(ambientGain);
    ambientGain.connect(ctx.destination);
    src.start();
    ambientNode = src;
  }

  function stopAmbient() {
    if (!ambientNode) return;
    try { ambientNode.stop(); } catch(e) {}
    ambientNode = null;
  }

  // Vibração do dispositivo
  function vibrate(pattern) {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  }

  // Chomp é sempre sintético (não tem no pack)
  function chomp() { _chomp(); }
  function snap()  { _snap(); }

  return { init, play, stop, startAmbient, stopAmbient, vibrate, chomp, snap };
})();
