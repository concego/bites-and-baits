/**
 * game.js — Bites & Baits
 * Máquina de estados principal
 *
 * Estados:
 *   IDLE       → aguardando lançamento (incline para frente)
 *   CASTING    → animação de lançamento em andamento
 *   WAITING    → isca na água, esperando peixe morder
 *   BITING     → peixe mordeu! aguardando shake para fisgar
 *   REELING    → fisgado, puxando (incline para trás)
 *   CAUGHT     → peixe capturado!
 *   SNAPPED    → linha arrebentou
 */

const Game = (() => {

  // ── Referências DOM (resolvidas no init, após DOMContentLoaded) ───────────
  const $ = id => document.getElementById(id);

  let screens = {};
  let ui = {};

  // ── Dados do jogo ─────────────────────────────────────────────────────────
  const FISH_TYPES = [
    { name: 'Peixinho',  sprite: 'fish-peixinho', size: 1,   weight: 0.3,  special: false },
    { name: 'Tilápia',   sprite: 'fish-tilapia',  size: 1.5, weight: 0.5,  special: false },
    { name: 'Truta',     sprite: 'fish-truta',    size: 2,   weight: 0.15, special: false },
    { name: 'Dourada',   sprite: 'fish-dourada',  size: 2.5, weight: 0.04, special: true  },
    { name: 'Tubarão',   sprite: 'fish-tubarao',  size: 4,   weight: 0.01, special: true  },
  ];

  let state            = 'IDLE';
  let score            = 0;
  let best             = parseInt(localStorage.getItem('bb_best') || '0');
  let currentFish      = null;
  let tension          = 0;     // 0..100
  let fishPull         = 0;     // força com que o peixe puxa de volta
  let fishTired        = false; // peixe cansou?
  let tiredTimer       = null;
  let tensionLoop      = null;
  let _lastTensionWarn = null;  // timestamp do último aviso de tensão por TTS
  let waitTimer   = null;
  let biteTimer   = null;
  let fishEls     = [];

  // ── Inicialização ─────────────────────────────────────────────────────────
  function init() {
    // Resolve referências DOM agora que o DOM está pronto
    screens = {
      start:  $('screen-start'),
      game:   $('screen-game'),
      result: $('screen-result'),
    };
    ui = {
      announcer:    $('announcer'),
      stateLabel:   $('state-label'),
      tensionCont:  $('tension-container'),
      tensionBar:   $('tension-bar'),
      tiltArrow:    $('tilt-arrow'),
      tiltText:     $('tilt-text'),
      score:        $('score'),
      best:         $('best'),
      rod:          $('rod'),
      line:         $('line'),
      lure:         $('lure'),
      fishContainer:$('fish-container'),
      scene:        $('scene'),
      resultIcon:   $('result-icon'),
      resultTitle:  $('result-title'),
      resultDesc:   $('result-desc'),
      resultScore:  $('result-score'),
      resultBest:   $('result-best'),
    };

    // Carrega recorde
    ui.best.textContent = best;

    // Botões
    $('btn-start').addEventListener('click', startGame);
    $('btn-menu').addEventListener('click',  () => goToMenu());
    $('btn-menu2').addEventListener('click', () => goToMenu());
    $('btn-continue').addEventListener('click', () => {
      showScreen('game');
      enterState('IDLE');
    });

    // Sensors
    Sensors.on('onTilt',  handleTilt);
    Sensors.on('onShake', handleShake);

    // Desktop fallback automático se não há acelerômetro
    if (!window.DeviceOrientationEvent) {
      Sensors.enableDesktopFallback();
    }
  }

  async function startGame() {
    // Inicializa TTS
    ttsInit();

    // Tenta obter permissão de sensores
    const ok = await Sensors.requestPermission();
    if (!ok) {
      speak('Permissão de sensores negada. Usando teclado para teste.', true);
      Sensors.enableDesktopFallback();
    }

    // Inicializa áudio (precisa de gesto do usuário)
    await Audio.init();

    showScreen('game');
    score = 0;
    updateScore();
    spawnBackgroundFish();
    Sensors.start();
    Audio.startAmbient();
    enterState('IDLE');
  }

  // ── Máquina de estados ────────────────────────────────────────────────────
  // ── Silencia / restaura o TalkBack via aria-hidden no screen-game ────────────
  // O #announcer fica FORA do #app, portanto nunca é silenciado.
  function setTalkbackSilent(silent) {
    const gameScreen = document.getElementById('screen-game');
    if (!gameScreen) return;
    if (silent) {
      gameScreen.setAttribute('aria-hidden', 'true');
    } else {
      gameScreen.removeAttribute('aria-hidden');
    }
  }

  function enterState(newState) {
    clearTimers();
    state = newState;

    switch (state) {

      case 'IDLE':
        tension = 0;
        currentFish = null;
        fishTired = false;
        updateTensionBar();
        ui.tensionCont.classList.add('hidden');
        ui.lure.style.display = 'none';
        ui.line.style.height  = '0px';
        ui.rod.style.transform = 'translateX(-50%) rotate(-30deg)';
        setTalkbackSilent(false);   // TalkBack volta — isca fora da água
        setLabel('🎣 Pronto para lançar');
        setTiltHint('↕', 'Incline para frente para lançar');
        speak('Pronto. Incline para frente.');
        break;

      case 'CASTING':
        setTalkbackSilent(true);    // TalkBack mudo — isca entrando na água
        setLabel('🌊 Lançando...');
        setTiltHint('↑', 'Lançando a isca...');
        ui.rod.style.transform = 'translateX(-50%) rotate(10deg)';
        Audio.play('splash') || Audio.play('bloop');
        Audio.play('bloop');
        setTimeout(() => {
          ui.lure.style.display = 'block';
          ui.lure.style.top     = '10px';
          ui.lure.style.left    = '50%';
          ui.line.style.height  = '80px';
          speak('Isca na água. Aguarde.');
          enterState('WAITING');
        }, 600);
        break;

      case 'WAITING':
        // TalkBack já está mudo desde CASTING
        setLabel('🌊 Aguardando...');
        setTiltHint('→', 'Segure o celular neutro');
        ui.rod.style.transform = 'translateX(-50%) rotate(-10deg)';
        scheduleNextBite();
        break;

      case 'BITING':
        // TalkBack ainda mudo — TTS assume os avisos
        currentFish = pickFish();
        fishPull = currentFish.size * 8;
        fishTired = false;

        Audio.chomp();
        Audio.vibrate([80, 40, 80]);
        ui.scene.classList.add('bite-pulse');
        setTimeout(() => ui.scene.classList.remove('bite-pulse'), 1500);

        setLabel(`⚡ ${currentFish.name} na isca! Dê um shake!`);
        setTiltHint('📳', 'Sacuda o celular para fisgar!');
        ui.tiltArrow.classList.add('shake-hint');
        speak('Peixe! Sacuda!', true);

        biteTimer = setTimeout(() => {
          ui.tiltArrow.classList.remove('shake-hint');
          speak('Fugiu.', true);
          setLabel('😔 O peixe fugiu...');
          setTimeout(() => enterState('WAITING'), 1500);
        }, 3500);
        break;

      case 'REELING':
        // TalkBack ainda mudo — TTS guia o jogador
        tension = 10;
        ui.tensionCont.classList.remove('hidden');
        ui.rod.style.transform = 'translateX(-50%) rotate(-50deg)';
        setLabel(`🎣 Puxando ${currentFish.name}...`);
        setTiltHint('↓', 'Incline para trás para puxar!');
        _lastTensionWarn = null;
        speak('Fisgou! Incline para trás!', true);
        Audio.startReel('neutral');
        startTensionLoop();
        scheduleFishTired();
        break;

      case 'CAUGHT':
        Audio.stopReel();
        Audio.play(currentFish.special ? 'point_special' : 'point_normal');
        Audio.vibrate([100, 50, 100, 50, 200]);
        score++;
        if (score > best) { best = score; localStorage.setItem('bb_best', best); }
        updateScore();
        ui.tensionCont.classList.add('hidden');
        setLabel(`🏆 ${currentFish.name} capturado!`);

        // TTS fala o resultado — TalkBack ainda mudo
        {
          const sizeDesc = currentFish.size <= 1 ? 'pequeno' :
                           currentFish.size <= 2 ? 'médio' :
                           currentFish.size <= 3 ? 'grande' : 'enorme';
          const msg = currentFish.special
            ? `${currentFish.name}! Especial! ${score} peixes.`
            : `${currentFish.name}! ${sizeDesc}. ${score} peixes.`;
          speak(msg, true);
        }

        // Volta ao IDLE (TalkBack restaurado lá)
        setTimeout(() => {
          if (state === 'CAUGHT') enterState('IDLE');
        }, 3500);
        break;

      case 'SNAPPED':
        Audio.stopReel();
        Audio.snap();
        Audio.vibrate([200, 100, 400]);
        ui.tensionCont.classList.add('hidden');
        tension = 0;
        ui.lure.style.display = 'none';
        ui.line.style.height  = '0px';
        setLabel('💥 A linha arrebentou!');
        speak('Linha arrebentou!', true);
        setTimeout(() => {
          if (state === 'SNAPPED') {
            setTalkbackSilent(false);  // TalkBack volta para a tela de resultado
            showResultScreen(false);
          }
        }, 2000);
        break;
    }
  }

  // ── Tilt handler ──────────────────────────────────────────────────────────
  function handleTilt(dir, beta, norm) {
    // Atualiza visual do indicador
    updateTiltIndicator(dir, norm);

    switch (state) {
      case 'IDLE':
        if (dir === 'forward') enterState('CASTING');
        break;

      case 'REELING':
        if (dir === 'back') {
          // Puxando: aumenta progresso, tensão sobe
          pullFish(0.8);
        } else if (dir === 'forward') {
          // Alivia tensão
          releaseLine(1.2);
        } else {
          // Neutro: carretel em tom médio
          Audio.setReelMode('neutral');
        }
        break;

      case 'WAITING':
        // Qualquer inclinação forte pra trás tira a isca da água
        if (dir === 'back') {
          speak('Relance. Incline para frente.');
          setLabel('Isca fora da água — incline para frente');
          enterState('IDLE');
        }
        break;
    }
  }

  // ── Shake handler ─────────────────────────────────────────────────────────
  function handleShake() {
    if (state === 'BITING') {
      clearTimeout(biteTimer);
      ui.tiltArrow.classList.remove('shake-hint');
      Audio.vibrate([50, 30, 50]);
      speak('Fisgou!', true);
      enterState('REELING');
    }
  }

  // ── Tensão ────────────────────────────────────────────────────────────────
  let _pullProgress = 0;  // 0..100, progresso de puxada até capturar

  function startTensionLoop() {
    _pullProgress = 0;
    let _prevTension = 0;
    let _resistCooldown = 0;

    tensionLoop = setInterval(() => {
      if (state !== 'REELING') { clearInterval(tensionLoop); return; }

      // Peixe puxa de volta a cada tick (menos se cansado)
      const fishForce = fishTired ? fishPull * 0.3 : fishPull;
      const delta = fishForce * 0.05;
      tension = Math.min(100, tension + delta);

      // Peixe resistindo: tensão subindo rápido → som grave + carretel neutro
      if (delta > 0.6 && _resistCooldown <= 0 && !fishTired) {
        Audio.fishResist();
        Audio.setReelMode('neutral');
        _resistCooldown = 8; // espera ~1s antes de repetir
      }
      if (_resistCooldown > 0) _resistCooldown--;

      // Tensão crítica → vibração progressiva + TTS
      if (tension > 85) {
        Audio.vibrate(30);
        setTensionClass('tension-danger');
        if (!_lastTensionWarn || Date.now() - _lastTensionWarn > 3000) {
          _lastTensionWarn = Date.now();
          speak('Perigo! Solte!', true);
        }
      } else if (tension > 65) {
        setTensionClass('tension-high');
        if (!_lastTensionWarn || Date.now() - _lastTensionWarn > 5000) {
          _lastTensionWarn = Date.now();
          speak('Tensão alta!');
        }
      } else if (tension > 40) {
        setTensionClass('tension-medium');
      } else {
        setTensionClass('tension-low');
      }

      // Tensão 100 → arrebenta
      if (tension >= 100) {
        clearInterval(tensionLoop);
        enterState('SNAPPED');
        return;
      }

      _prevTension = tension;
      updateTensionBar();
    }, 120);
  }

  function pullFish(amount) {
    if (state !== 'REELING') return;

    // Carretel agudo — jogador puxando
    Audio.setReelMode('pulling');

    _pullProgress += amount;
    tension = Math.min(100, tension + amount * 0.4);
    updateTensionBar();

    // Capturado quando progresso >= 100
    if (_pullProgress >= 100) {
      clearInterval(tensionLoop);
      enterState('CAUGHT');
    }
  }

  function releaseLine(amount) {
    if (state !== 'REELING') return;

    // Carretel grave — jogador soltando
    Audio.setReelMode('releasing');

    tension = Math.max(0, tension - amount * 1.5);
    _pullProgress = Math.max(0, _pullProgress - amount * 0.3);
    updateTensionBar();
  }

  // ── Cansaço do peixe ──────────────────────────────────────────────────────
  function scheduleFishTired() {
    // Peixes maiores demoram mais para cansar
    const ms = 5000 + currentFish.size * 3000;
    tiredTimer = setTimeout(() => {
      if (state === 'REELING') {
        fishTired = true;
        speak('Cansado! Puxe!', true);
        setLabel(`😮‍💨 ${currentFish.name} está cansando — puxe!`);
      }
    }, ms);
  }

  // ── Spawn de peixes decorativos ───────────────────────────────────────────
  function spawnBackgroundFish() {
    // Só os 3 comuns como decoração de fundo
    const bgTypes = ['fish-peixinho', 'fish-tilapia', 'fish-truta'];
    // Largura base de cada sprite (viewBox width proporcional ao tamanho exibido)
    const spriteW = { 'fish-peixinho': 52, 'fish-tilapia': 60, 'fish-truta': 68 };
    const spriteH = { 'fish-peixinho': 26, 'fish-tilapia': 30, 'fish-truta': 28 };

    for (let i = 0; i < 4; i++) {
      const id  = bgTypes[Math.floor(Math.random() * bgTypes.length)];
      const w   = spriteW[id];
      const h   = spriteH[id];

      const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      el.setAttribute('width', w);
      el.setAttribute('height', h);
      el.setAttribute('aria-hidden', 'true');
      el.classList.add('fish');

      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', `#${id}`);
      el.appendChild(use);

      el.style.top              = `${20 + Math.random() * 60}%`;
      el.style.left             = `${Math.random() * 80}%`;
      el.style.animationDelay   = `${Math.random() * 2}s`;
      el.style.opacity          = '0.75';

      ui.fishContainer.appendChild(el);
      fishEls.push(el);

      // Move os peixes lentamente, espelhando direção
      let curLeft = parseFloat(el.style.left);
      setInterval(() => {
        if (state !== 'IDLE' && state !== 'WAITING') return;
        const newLeft = Math.random() * 80;
        el.style.left      = `${newLeft}%`;
        el.style.transform = newLeft < curLeft ? 'scaleX(-1)' : 'scaleX(1)';
        curLeft = newLeft;
      }, 3000 + Math.random() * 4000);
    }
  }

  // ── Lógica de mordida ─────────────────────────────────────────────────────
  function scheduleNextBite() {
    // Entre 3 e 10 segundos até o peixe morder
    const ms = 3000 + Math.random() * 7000;
    waitTimer = setTimeout(() => {
      if (state === 'WAITING') enterState('BITING');
    }, ms);
  }

  function pickFish() {
    const roll = Math.random();
    let acc = 0;
    for (const f of FISH_TYPES) {
      acc += f.weight;
      if (roll < acc) return f;
    }
    return FISH_TYPES[0];
  }

  // ── Tela de resultado ─────────────────────────────────────────────────────
  function showResultScreen(caught) {
    Sensors.stop();
    Audio.stopAmbient();
    Audio.stopReel();
    setTalkbackSilent(false);   // garante que TalkBack está ativo na tela de resultado
    ui.resultScore.textContent = score;
    ui.resultBest.textContent  = best;
    if (caught && currentFish) {
      // Mostra sprite do peixe capturado
      const useEl = document.getElementById('result-fish-use');
      if (useEl) useEl.setAttribute('href', `#${currentFish.sprite}`);
      document.getElementById('result-fish-svg').style.display = '';
      ui.resultTitle.textContent = 'Peixe capturado!';
      ui.resultDesc.textContent  = `Você pescou um(a) ${currentFish.name}.`;
    } else {
      // Linha arrebentou: esconde o SVG, mostra emoji de coração partido
      document.getElementById('result-fish-svg').style.display = 'none';
      ui.resultIcon.innerHTML    = '<span style="font-size:80px">💔</span>';
      ui.resultTitle.textContent = 'A linha arrebentou!';
      ui.resultDesc.textContent  = 'O peixe era forte demais desta vez.';
    }
    showScreen('result');
  }

  function goToMenu() {
    clearTimers();
    Sensors.stop();
    Audio.stopAmbient();
    Audio.stopReel();
    setTalkbackSilent(false);   // TalkBack volta ao menu
    state = 'IDLE';
    showScreen('start');
  }

  // ── Utilitários UI ────────────────────────────────────────────────────────
  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  function setLabel(text) {
    ui.stateLabel.textContent = text;
  }

  // ── TTS (Web Speech API) ──────────────────────────────────────────────────
  let _ttsEnabled = false;
  let _currentUtterance = null;

  function ttsInit() {
    _ttsEnabled = 'speechSynthesis' in window;
  }

  function speak(text, priority = false) {
    // Dois rAF encadeados: garante que o TalkBack percebe a mudança
    // e interrompe o que estava lendo antes de anunciar o novo texto.
    ui.announcer.textContent = '';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ui.announcer.textContent = text;
      });
    });

    if (!_ttsEnabled) return;
    if (priority) window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    u.rate = 1.1;
    u.pitch = 1.0;
    u.volume = 1.0;
    _currentUtterance = u;
    window.speechSynthesis.speak(u);
  }

  function announce(text) {
    speak(text);
  }

  function setTiltHint(arrow, text) {
    ui.tiltArrow.textContent = arrow;
    ui.tiltText.textContent  = text;
    ui.tiltArrow.classList.remove('shake-hint');
  }

  function updateScore() {
    ui.score.textContent = score;
    ui.best.textContent  = best;
  }

  function updateTensionBar() {
    ui.tensionBar.style.width = `${tension}%`;
  }

  function setTensionClass(cls) {
    ui.tensionBar.className = cls;
  }

  function updateTiltIndicator(dir, norm) {
    if (dir === 'forward') {
      ui.tiltArrow.textContent = '↑';
    } else if (dir === 'back') {
      ui.tiltArrow.textContent = '↓';
    } else {
      ui.tiltArrow.textContent = '↕';
    }
  }

  function clearTimers() {
    clearTimeout(waitTimer);
    clearTimeout(biteTimer);
    clearTimeout(tiredTimer);
    clearInterval(tensionLoop);
    // Para o carretel em qualquer transição de estado
    // (só tem efeito se estiver tocando — seguro chamar sempre)
    Audio.stopReel();
  }

  // ── Inicializa ao carregar ────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

  return { state: () => state };
})();
