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

  // ── i18n — aplica strings em todos os elementos data-i18n ─────────────────
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = I18n.t(key);
      if (typeof val === 'string') el.textContent = val;
    });
    // Nome dos peixes no array (depende do idioma ativo)
    FISH_TYPES.forEach(f => { f.name = I18n.t(f.nameKey); });
  }
  // ── Dados do jogo ─────────────────────────────────────────────────────────
  //
  // weight    → probabilidade de aparecer (soma = 1.0)
  // pull      → força com que o peixe resiste ao puxar (0..10)
  // pullNeeded→ progresso necessário para capturar (pontos de puxada)
  // biteWindow→ janela de tempo para dar o shake no BITING (ms)
  // tiredBase → tempo base para o peixe cansar no REELING (ms)
  //
  const FISH_TYPES = [
    {
      nameKey: 'fish_lambari', name: 'Lambari', sprite: 'fish-lambari', size: 1, special: false,
      weight: 0.40,
      pull: 1.5,
      pullNeeded: 40,
      biteWindow: 4500,
      tiredBase: 3000,
    },
    {
      nameKey: 'fish_tilapia', name: 'Tilápia', sprite: 'fish-tilapia', size: 1.5, special: false,
      weight: 0.35,
      pull: 3,
      pullNeeded: 60,
      biteWindow: 3500,
      tiredBase: 4500,
    },
    {
      nameKey: 'fish_truta', name: 'Truta', sprite: 'fish-truta', size: 2, special: false,
      weight: 0.14,
      pull: 5,
      pullNeeded: 80,
      biteWindow: 3000,
      tiredBase: 6000,
    },
    {
      nameKey: 'fish_dourado', name: 'Dourado', sprite: 'fish-dourado', size: 2.5, special: true,
      weight: 0.08,
      pull: 7,
      pullNeeded: 110,
      biteWindow: 2500,
      tiredBase: 9000,
    },
    {
      nameKey: 'fish_pirarucu', name: 'Pirarucu', sprite: 'fish-pirarucu', size: 4, special: true,
      weight: 0.03,
      pull: 10,
      pullNeeded: 150,
      biteWindow: 2000,
      tiredBase: 14000,
    },
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
    screens = {
      lang:         $('screen-lang'),
      start:        $('screen-start'),
      game:         $('screen-game'),
      result:       $('screen-result'),
      instructions: $('screen-instructions'),
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

    // ── Seleção de idioma ──────────────────────────────────────────────────
    // Se já escolheu antes, pula direto pro menu
    if (I18n.getLang()) {
      applyI18n();
      showScreen('start');
    }

    $('btn-lang-pt').addEventListener('click', () => selectLang('pt'));
    $('btn-lang-en').addEventListener('click', () => selectLang('en'));

    // ── Botões ─────────────────────────────────────────────────────────────
    $('btn-start').addEventListener('click', startGame);
    $('btn-instructions').addEventListener('click', () => showScreen('instructions'));
    $('btn-back').addEventListener('click',  () => showScreen('start'));
    $('btn-menu').addEventListener('click',  () => goToMenu());
    $('btn-menu2').addEventListener('click', () => goToMenu());
    $('btn-continue').addEventListener('click', () => {
      showScreen('game');
      enterState('IDLE');
    });

    // Sensors
    Sensors.on('onTilt',  handleTilt);
    Sensors.on('onShake', handleShake);

  }

  function selectLang(code) {
    I18n.setLang(code);
    applyI18n();
    showScreen('start');
  }

  async function startGame() {
    // Inicializa TTS

    // Tenta obter permissão de sensores
    const ok = await Sensors.requestPermission();
    if (!ok) {
      speak(I18n.t('speak_no_sensor'));
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
        setLabel(I18n.t('state_idle'));
        setTiltHint('↕', I18n.t('tilt_idle'));
        speak(I18n.t('speak_ready'));
        break;

      case 'CASTING':
        setTalkbackSilent(true);    // TalkBack mudo — isca entrando na água
        setLabel(I18n.t('state_casting'));
        setTiltHint('↑', I18n.t('tilt_casting'));
        ui.rod.style.transform = 'translateX(-50%) rotate(10deg)';
        Audio.play('splash') || Audio.play('bloop');
        Audio.play('bloop');
        setTimeout(() => {
          ui.lure.style.display = 'block';
          ui.lure.style.top     = '10px';
          ui.lure.style.left    = '50%';
          ui.line.style.height  = '80px';
          speak(I18n.t('speak_waiting'));
          enterState('WAITING');
        }, 600);
        break;

      case 'WAITING':
        // TalkBack já está mudo desde CASTING
        setLabel(I18n.t('state_waiting'));
        setTiltHint('→', I18n.t('tilt_waiting'));
        ui.rod.style.transform = 'translateX(-50%) rotate(-10deg)';
        scheduleNextBite();
        break;

      case 'BITING':
        // TalkBack ainda mudo — TTS assume os avisos
        currentFish = pickFish();
        fishPull = currentFish.pull;   // ← força real do perfil do peixe
        fishTired = false;

        Audio.chomp();
        Audio.vibrate([80, 40, 80]);
        ui.scene.classList.add('bite-pulse');
        setTimeout(() => ui.scene.classList.remove('bite-pulse'), 1500);

        setLabel(I18n.t('state_biting', currentFish.name));
        setTiltHint('📳', I18n.t('tilt_biting'));
        ui.tiltArrow.classList.add('shake-hint');
        speak(I18n.t('speak_fish'));

        biteTimer = setTimeout(() => {
          ui.tiltArrow.classList.remove('shake-hint');
          speak(I18n.t('speak_escaped'));
          setLabel(I18n.t('state_escaped'));
          setTimeout(() => enterState('WAITING'), 1500);
        }, currentFish.biteWindow);   // ← janela por espécie
        break;

      case 'REELING':
        // TalkBack ainda mudo — TTS guia o jogador
        tension = 10;
        ui.tensionCont.classList.remove('hidden');
        ui.rod.style.transform = 'translateX(-50%) rotate(-50deg)';
        setLabel(I18n.t('state_reeling', currentFish.name));
        setTiltHint('↓', I18n.t('tilt_reeling'));
        _lastTensionWarn = null;
        speak(I18n.t('speak_hooked'));
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
        setLabel(I18n.t('state_caught', currentFish.name));

        // TTS fala o resultado — TalkBack ainda mudo
        {
          const sizeDesc = currentFish.size <= 1 ? I18n.t('size_tiny') :
                           currentFish.size <= 2 ? I18n.t('size_small') :
                           currentFish.size <= 3 ? I18n.t('size_medium') : I18n.t('size_large');
          const msg = currentFish.special
            ? I18n.t('speak_caught_special', currentFish.name, score)
            : I18n.t('speak_caught', currentFish.name, sizeDesc, score);
          speak(msg);
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
        setLabel(I18n.t('state_snapped'));
        speak(I18n.t('speak_snapped'));
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
          speak(I18n.t('speak_pulled_out'));
          setLabel(I18n.t('state_pulled_out'));
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
      navigator.vibrate && navigator.vibrate(0);        // cancela vibração anterior
      setTimeout(() => Audio.vibrate([300, 100, 400]), 30); // pequeno gap garante o reset
      speak(I18n.t('speak_rehooked'));
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

      // Peixe resistindo: pull >= 5 (Truta, Dourado, Pirarucu) → som grave
      if (fishPull >= 5 && delta > 0.2 && _resistCooldown <= 0 && !fishTired) {
        Audio.fishResist();
        Audio.setReelMode('neutral');
        _resistCooldown = 8;
      }
      if (_resistCooldown > 0) _resistCooldown--;

      // Tensão crítica → vibração progressiva + TTS
      if (tension > 85) {
        Audio.vibrate(30);
        setTensionClass('tension-danger');
        if (!_lastTensionWarn || Date.now() - _lastTensionWarn > 3000) {
          _lastTensionWarn = Date.now();
          speak(I18n.t('speak_danger'));
        }
      } else if (tension > 65) {
        setTensionClass('tension-high');
        if (!_lastTensionWarn || Date.now() - _lastTensionWarn > 5000) {
          _lastTensionWarn = Date.now();
          speak(I18n.t('speak_tension'));
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

    // Capturado quando progresso >= pullNeeded do perfil do peixe
    if (_pullProgress >= currentFish.pullNeeded) {
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
    // Cada espécie tem seu próprio tiredBase — pirarucu aguenta muito mais que lambari
    const jitter = (Math.random() * 0.3 - 0.15); // ±15% de variação
    const ms = currentFish.tiredBase * (1 + jitter);
    tiredTimer = setTimeout(() => {
      if (state === 'REELING') {
        fishTired = true;
        speak(I18n.t('speak_tired'));
        setLabel(I18n.t('state_tired', currentFish.name));
      }
    }, ms);
  }

  // ── Spawn de peixes decorativos ───────────────────────────────────────────
  function spawnBackgroundFish() {
    // Só os 3 comuns como decoração de fundo
    const bgTypes = ['fish-lambari', 'fish-tilapia', 'fish-truta'];
    // Largura base de cada sprite (viewBox width proporcional ao tamanho exibido)
    const spriteW = { 'fish-lambari': 52, 'fish-tilapia': 60, 'fish-truta': 68 };
    const spriteH = { 'fish-lambari': 26, 'fish-tilapia': 30, 'fish-truta': 28 };

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
      ui.resultTitle.textContent = I18n.t('result_caught');
      ui.resultDesc.textContent  = I18n.t('result_caught_desc', currentFish.name);
    } else {
      // Linha arrebentou: esconde o SVG, mostra emoji de coração partido
      document.getElementById('result-fish-svg').style.display = 'none';
      ui.resultIcon.innerHTML    = '<span style="font-size:80px">💔</span>';
      ui.resultTitle.textContent = I18n.t('result_snapped');
      ui.resultDesc.textContent  = I18n.t('result_snapped_desc');
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

  // ── Announcer — aria-live pro TalkBack ───────────────────────────────────
  // Dois rAF encadeados: força o TalkBack a perceber a troca de texto
  // e interromper a leitura anterior antes de anunciar o novo aviso.
  function speak(text) {
    ui.announcer.textContent = '';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ui.announcer.textContent = text;
      });
    });
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
