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

  // ── Referências DOM ───────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  const screens = {
    start:  $('screen-start'),
    game:   $('screen-game'),
    result: $('screen-result'),
  };

  const ui = {
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

  // ── Dados do jogo ─────────────────────────────────────────────────────────
  const FISH_TYPES = [
    { name: 'Peixinho',  emoji: '🐟', size: 1,   weight: 0.3, special: false },
    { name: 'Tilápia',   emoji: '🐠', size: 1.5, weight: 0.5, special: false },
    { name: 'Truta',     emoji: '🎣', size: 2,   weight: 0.15, special: false },
    { name: 'Dourada',   emoji: '🐡', size: 2.5, weight: 0.04, special: true  },
    { name: 'Tubarão',   emoji: '🦈', size: 4,   weight: 0.01, special: true  },
  ];

  let state       = 'IDLE';
  let score       = 0;
  let best        = parseInt(localStorage.getItem('bb_best') || '0');
  let currentFish = null;
  let tension     = 0;     // 0..100
  let fishPull    = 0;     // força com que o peixe puxa de volta
  let fishTired   = false; // peixe cansou?
  let tiredTimer  = null;
  let tensionLoop = null;
  let waitTimer   = null;
  let biteTimer   = null;
  let fishEls     = [];

  // ── Inicialização ─────────────────────────────────────────────────────────
  function init() {
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
    // Tenta obter permissão de sensores
    const ok = await Sensors.requestPermission();
    if (!ok) {
      announce('Permissão de sensores negada. Use as setas do teclado para testar.');
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
        announce('Pronto para lançar. Incline o celular para frente.');
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
          announce('Isca lançada! Aguardando peixe...');
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
        announce(`Peixe na isca! Sacuda o celular para fisgar!`);

        // Janela de tempo para fisgar
        biteTimer = setTimeout(() => {
          ui.tiltArrow.classList.remove('shake-hint');
          announce('O peixe fugiu...');
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
        announce(`Fisgou! Incline para trás para puxar o peixe.`);
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
        announce(`${currentFish.name} capturado! Parabéns!`);

        // Volta ao IDLE após celebração breve
        setTimeout(() => {
          if (state === 'CAUGHT') enterState('IDLE');
        }, 2000);
        break;

      case 'SNAPPED':
        Audio.snap();
        Audio.vibrate([200, 100, 400]);
        ui.tensionCont.classList.add('hidden');
        tension = 0;
        ui.lure.style.display = 'none';
        ui.line.style.height  = '0px';
        setLabel('💥 A linha arrebentou!');
        announce('A linha arrebentou! O peixe escapou.');
        setTimeout(() => {
          if (state === 'SNAPPED') showResultScreen(false);
        }, 1500);
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
          announce('Isca fora da água. Incline para frente para relançar.');
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
      announce('Fisgou!');
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

      // Tensão crítica → vibração progressiva
      if (tension > 85) {
        Audio.vibrate(30);
        setTensionClass('tension-danger');
      } else if (tension > 65) {
        setTensionClass('tension-high');
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
        announce('O peixe está cansando! Puxe agora!');
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

  function announce(text) {
    ui.announcer.textContent = '';
    requestAnimationFrame(() => { ui.announcer.textContent = text; });
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
