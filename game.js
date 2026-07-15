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
    { name: 'Peixinho',  emoji: '🐟', size: 1,   weight: 0.3, special: false },
    { name: 'Tilápia',   emoji: '🐠', size: 1.5, weight: 0.5, special: false },
    { name: 'Truta',     emoji: '🎣', size: 2,   weight: 0.15, special: false },
    { name: 'Dourada',   emoji: '🐡', size: 2.5, weight: 0.04, special: true  },
    { name: 'Tubarão',   emoji: '🦈', size: 4,   weight: 0.01, special: true  },
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
        setLabel('🎣 Pronto para lançar');
        setTiltHint('↕', 'Incline para frente para lançar');
        speak('Pronto para lançar. Incline o celular para frente.');
        break;

      case 'CASTING':
        setLabel('🌊 Lançando...');
        setTiltHint('↑', 'Lançando a isca...');
        ui.rod.style.transform = 'translateX(-50%) rotate(10deg)';
        Audio.play('splash') || Audio.play('bloop');
        Audio.play('bloop');
        setTimeout(() => {
          // Isca cai na água
          ui.lure.style.display = 'block';
          ui.lure.style.top     = '10px';
          ui.lure.style.left    = '50%';
          ui.line.style.height  = '80px';
          speak('Isca na água! Aguarde o peixe morder.');
          enterState('WAITING');
        }, 600);
        break;

      case 'WAITING':
        setLabel('🌊 Aguardando...');
        setTiltHint('→', 'Segure o celular neutro');
        ui.rod.style.transform = 'translateX(-50%) rotate(-10deg)';
        scheduleNextBite();
        break;

      case 'BITING':
        // Escolhe peixe
        currentFish = pickFish();
        fishPull = currentFish.size * 8;  // força de arrancada
        fishTired = false;

        Audio.chomp();
        Audio.vibrate([80, 40, 80]);
        ui.scene.classList.add('bite-pulse');
        setTimeout(() => ui.scene.classList.remove('bite-pulse'), 1500);

        setLabel(`⚡ ${currentFish.emoji} Peixe na isca! Dê um shake!`);
        setTiltHint('📳', 'Sacuda o celular para fisgar!');
        ui.tiltArrow.classList.add('shake-hint');
        speak('Peixe na isca! Sacuda o celular agora para fisgar!', true);

        // Janela de tempo para fisgar
        biteTimer = setTimeout(() => {
          ui.tiltArrow.classList.remove('shake-hint');
          speak('O peixe fugiu. Aguardando novo peixe.', true);
          setLabel('😔 O peixe fugiu...');
          setTimeout(() => enterState('WAITING'), 1500);
        }, 3500);
        break;

      case 'REELING':
        tension = 10;
        ui.tensionCont.classList.remove('hidden');
        ui.rod.style.transform = 'translateX(-50%) rotate(-50deg)';
        setLabel(`🎣 Puxando ${currentFish.emoji}...`);
        setTiltHint('↓', 'Incline para trás para puxar!');
        _lastTensionWarn = null;
        speak(`Fisgou! Incline para trás para puxar. Cuidado com a tensão da linha!`, true);
        startTensionLoop();

        // Inicia contador de cansaço do peixe
        scheduleFishTired();
        break;

      case 'CAUGHT':
        Audio.play(currentFish.special ? 'point_special' : 'point_normal');
        Audio.vibrate([100, 50, 100, 50, 200]);
        score++;
        if (score > best) { best = score; localStorage.setItem('bb_best', best); }
        updateScore();
        ui.tensionCont.classList.add('hidden');
        setLabel(`🏆 ${currentFish.emoji} ${currentFish.name} capturado!`);

        // TTS com estatísticas completas
        {
          const sizeDesc = currentFish.size <= 1 ? 'pequeno' :
                           currentFish.size <= 2 ? 'médio' :
                           currentFish.size <= 3 ? 'grande' : 'enorme';
          const msg = currentFish.special
            ? `Incrível! Você pescou um ${currentFish.name}! É um peixe ${sizeDesc} e especial! Total de peixes: ${score}.`
            : `Você pescou um ${currentFish.name}! Peixe ${sizeDesc}. Total de peixes: ${score}.`;
          speak(msg, true);
        }

        // Volta ao IDLE após celebração breve
        setTimeout(() => {
          if (state === 'CAUGHT') enterState('IDLE');
        }, 3500);
        break;

      case 'SNAPPED':
        Audio.snap();
        Audio.vibrate([200, 100, 400]);
        ui.tensionCont.classList.add('hidden');
        tension = 0;
        ui.lure.style.display = 'none';
        ui.line.style.height  = '0px';
        setLabel('💥 A linha arrebentou!');
        speak('A linha arrebentou! O peixe escapou. Precisa relançar.', true);
        setTimeout(() => {
          if (state === 'SNAPPED') showResultScreen(false);
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
          // Neutro: tensão cai devagar, peixe pode cansar
        }
        break;

      case 'WAITING':
        // Qualquer inclinação forte pra trás tira a isca da água
        if (dir === 'back') {
          speak('Isca fora da água. Incline para frente para relançar.');
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
    tensionLoop = setInterval(() => {
      if (state !== 'REELING') { clearInterval(tensionLoop); return; }

      // Peixe puxa de volta a cada tick (menos se cansado)
      const fishForce = fishTired ? fishPull * 0.3 : fishPull;
      tension = Math.min(100, tension + fishForce * 0.05);

      // Tensão crítica → vibração progressiva + TTS
      if (tension > 85) {
        Audio.vibrate(30);
        setTensionClass('tension-danger');
        // Avisa sobre tensão crítica uma vez a cada ~3s
        if (!_lastTensionWarn || Date.now() - _lastTensionWarn > 3000) {
          _lastTensionWarn = Date.now();
          speak('Cuidado! Linha quase arrebentando! Solte um pouco!', true);
        }
      } else if (tension > 65) {
        setTensionClass('tension-high');
        if (!_lastTensionWarn || Date.now() - _lastTensionWarn > 5000) {
          _lastTensionWarn = Date.now();
          speak('Tensão alta! Cuidado.');
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

      updateTensionBar();
    }, 120);
  }

  function pullFish(amount) {
    if (state !== 'REELING') return;
    _pullProgress += amount;
    tension = Math.min(100, tension + amount * 0.4);
    updateTensionBar();

    // Capturado quando progresso >= 100
    if (_pullProgress >= 100) {
      clearInterval(tensionLoop);
      enterState('CAUGHT');
    }

    // Som de carretel pulsado durante a puxada
    if (Math.random() < 0.1) Audio.play('reel', { volume: 0.4 });
  }

  function releaseLine(amount) {
    if (state !== 'REELING') return;
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
        speak('O peixe está cansando! Puxe agora!', true);
        setLabel(`😮‍💨 ${currentFish.emoji} Está cansando — puxe!`);
      }
    }, ms);
  }

  // ── Spawn de peixes decorativos ───────────────────────────────────────────
  function spawnBackgroundFish() {
    const types = ['🐟', '🐠', '🐡'];
    for (let i = 0; i < 4; i++) {
      const el = document.createElement('div');
      el.className = 'fish';
      el.textContent = types[Math.floor(Math.random() * types.length)];
      el.style.top  = `${20 + Math.random() * 60}%`;
      el.style.left = `${Math.random() * 80}%`;
      el.style.animationDelay = `${Math.random() * 2}s`;
      ui.fishContainer.appendChild(el);
      fishEls.push(el);

      // Move os peixes lentamente
      setInterval(() => {
        if (state !== 'IDLE' && state !== 'WAITING') return;
        const newLeft = `${Math.random() * 80}%`;
        el.style.left = newLeft;
        el.style.transform = newLeft > el.style.left ? 'scaleX(1)' : 'scaleX(-1)';
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
    ui.resultScore.textContent = score;
    ui.resultBest.textContent  = best;
    if (caught) {
      ui.resultIcon.textContent  = currentFish?.emoji ?? '🐟';
      ui.resultTitle.textContent = 'Peixe capturado!';
      ui.resultDesc.textContent  = `Você pescou um(a) ${currentFish?.name ?? 'peixe'}.`;
    } else {
      ui.resultIcon.textContent  = '💔';
      ui.resultTitle.textContent = 'A linha arrebentou!';
      ui.resultDesc.textContent  = 'O peixe era forte demais desta vez.';
    }
    showScreen('result');
  }

  function goToMenu() {
    clearTimers();
    Sensors.stop();
    Audio.stopAmbient();
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
    // Atualiza aria-live de qualquer forma
    ui.announcer.textContent = '';
    requestAnimationFrame(() => { ui.announcer.textContent = text; });

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
  }

  // ── Inicializa ao carregar ────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

  return { state: () => state };
})();
