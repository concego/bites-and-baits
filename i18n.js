/**
 * i18n.js — Bites & Baits
 * Strings de interface e voz organizadas por idioma.
 * Uso: I18n.t('chave') → string no idioma ativo
 */

const I18n = (() => {

  // ── Strings por idioma ───────────────────────────────────────────────────
  const STRINGS = {

    pt: {
      // Tela de seleção de idioma
      lang_title:       'Escolha o idioma',
      lang_subtitle:    'Choose your language',

      // Menu
      subtitle:         'Um jogo de pesca pelo acelerômetro',
      btn_start:        'Começar a pescar',
      btn_instructions: 'Como jogar',
      hint:             'Segure o celular na vertical para jogar',
      credits_by:       'Por',
      credits_brand:    'Eu Concego Jogar',

      // Tela de instruções
      how_to_play:      'Como jogar',
      instr_sensor_title:  '📱 Celular com acelerômetro',
      instr_cast:       'Lançar',
      instr_cast_desc:  'incline o celular para frente',
      instr_reel:       'Puxar',
      instr_reel_desc:  'incline o celular para trás',
      instr_hook:       'Fisgar',
      instr_hook_desc:  'sacuda o celular quando ouvir o aviso',
      instr_kb_title:   '⌨️ PC / teclado',
      instr_kb_cast:    'Lançar',
      instr_kb_cast_desc: 'seta para cima ↑',
      instr_kb_reel:    'Puxar',
      instr_kb_reel_desc: 'seta para baixo ↓',
      instr_kb_hook:    'Fisgar',
      instr_kb_hook_desc: 'barra de espaço',
      instr_a11y_title: 'Acessibilidade',
      instr_a11y_1:     'Compatível com TalkBack ativado',
      instr_a11y_2:     'Todos os avisos são lidos em tempo real',
      instr_a11y_3:     'Haptic feedback (vibração) nos eventos principais',
      btn_back:         'Voltar ao menu',

      // HUD do jogo
      hud_fish:         'Peixes',
      hud_best:         'Melhor',
      tension_label:    'Tensão da linha',

      // Tela de resultado
      result_caught:    'Peixe capturado!',
      result_caught_desc: fish => `Você pescou um(a) ${fish}.`,
      result_snapped:   'A linha arrebentou!',
      result_snapped_desc: 'O peixe era forte demais desta vez.',
      stat_today:       'Peixes hoje',
      stat_best:        'Melhor sessão',
      stat_unit:        'peixes',
      btn_again:        'Pescar de novo',
      btn_menu:         'Menu',

      // Estados — label visual
      state_idle:       '🎣 Pronto para lançar',
      state_casting:    '🌊 Lançando...',
      state_waiting:    '🌊 Aguardando...',
      state_biting:     fish => `⚡ ${fish} na isca! Dê um shake!`,
      state_reeling:    fish => `🎣 Puxando ${fish}...`,
      state_caught:     fish => `🏆 ${fish} capturado!`,
      state_snapped:    '💥 A linha arrebentou!',
      state_escaped:    '😔 O peixe fugiu...',
      state_tired:      fish => `😮‍💨 ${fish} está cansando — puxe!`,
      state_pulled_out: 'Isca fora da água — incline para frente',

      // Dicas de inclinação
      tilt_idle:        'Incline para lançar',
      tilt_casting:     'Lançando a isca...',
      tilt_waiting:     'Segure o celular neutro',
      tilt_biting:      'Sacuda o celular para fisgar!',
      tilt_reeling:     'Incline para trás para puxar!',

      // Voz (aria-live / TTS)
      speak_ready:      'Pronto. Incline para frente.',
      speak_waiting:    'Isca na água. Aguarde.',
      speak_fish:       'Peixe! Sacuda!',
      speak_hooked:     'Fisgou! Incline para trás!',
      speak_rehooked:   'Fisgou!',
      speak_escaped:    'Fugiu.',
      speak_pulled_out: 'Relance. Incline para frente.',
      speak_tired:      'Cansado! Puxe!',
      speak_snapped:    'Linha arrebentou!',
      speak_caught:     (fish, size, score) => `${fish}! ${size}. ${score} peixes.`,
      speak_caught_special: (fish, score) => `${fish}! Especial! ${score} peixes.`,
      speak_danger:     'Perigo! Solte!',
      speak_tension:    'Tensão alta!',
      speak_no_sensor:  'Permissão de sensores negada. Usando teclado para teste.',

      // Tamanhos (para voz)
      size_tiny:   'pequeno',
      size_small:  'médio',
      size_medium: 'grande',
      size_large:  'enorme',

      // Nomes dos peixes
      fish_lambari:  'Lambari',
      fish_tilapia:  'Tilápia',
      fish_truta:    'Truta',
      fish_dourado:  'Dourado',
      fish_pirarucu: 'Pirarucu',
    },

    en: {
      // Language selection screen
      lang_title:       'Choose your language',
      lang_subtitle:    'Escolha o idioma',

      // Menu
      subtitle:         'A fishing game using the accelerometer',
      btn_start:        'Start fishing',
      btn_instructions: 'How to play',
      hint:             'Hold your phone upright to play',
      credits_by:       'By',
      credits_brand:    'Eu Concego Jogar',

      // Instructions screen
      how_to_play:      'How to play',
      instr_sensor_title:  '📱 Phone with accelerometer',
      instr_cast:       'Cast',
      instr_cast_desc:  'tilt the phone forward',
      instr_reel:       'Reel in',
      instr_reel_desc:  'tilt the phone backward',
      instr_hook:       'Hook',
      instr_hook_desc:  'shake the phone when you hear the alert',
      instr_kb_title:   '⌨️ PC / keyboard',
      instr_kb_cast:    'Cast',
      instr_kb_cast_desc: 'arrow up ↑',
      instr_kb_reel:    'Reel in',
      instr_kb_reel_desc: 'arrow down ↓',
      instr_kb_hook:    'Hook',
      instr_kb_hook_desc: 'spacebar',
      instr_a11y_title: 'Accessibility',
      instr_a11y_1:     'Compatible with TalkBack enabled',
      instr_a11y_2:     'All alerts are read in real time',
      instr_a11y_3:     'Haptic feedback on key events',
      btn_back:         'Back to menu',

      // Game HUD
      hud_fish:         'Fish',
      hud_best:         'Best',
      tension_label:    'Line tension',

      // Result screen
      result_caught:    'Fish caught!',
      result_caught_desc: fish => `You caught a ${fish}!`,
      result_snapped:   'The line snapped!',
      result_snapped_desc: 'That fish was too strong this time.',
      stat_today:       'Fish today',
      stat_best:        'Best session',
      stat_unit:        'fish',
      btn_again:        'Fish again',
      btn_menu:         'Menu',

      // State labels
      state_idle:       '🎣 Ready to cast',
      state_casting:    '🌊 Casting...',
      state_waiting:    '🌊 Waiting...',
      state_biting:     fish => `⚡ ${fish} on the hook! Shake!`,
      state_reeling:    fish => `🎣 Reeling in ${fish}...`,
      state_caught:     fish => `🏆 ${fish} caught!`,
      state_snapped:    '💥 The line snapped!',
      state_escaped:    '😔 The fish got away...',
      state_tired:      fish => `😮‍💨 ${fish} is tiring — reel in!`,
      state_pulled_out: 'Lure out of water — tilt forward',

      // Tilt hints
      tilt_idle:        'Tilt to cast',
      tilt_casting:     'Casting lure...',
      tilt_waiting:     'Hold phone steady',
      tilt_biting:      'Shake to hook the fish!',
      tilt_reeling:     'Tilt back to reel in!',

      // Voice
      speak_ready:      'Ready. Tilt forward.',
      speak_waiting:    'Lure in water. Wait.',
      speak_fish:       'Fish! Shake!',
      speak_hooked:     'Hooked! Tilt back!',
      speak_rehooked:   'Hooked!',
      speak_escaped:    'Got away.',
      speak_pulled_out: 'Recast. Tilt forward.',
      speak_tired:      'Tired! Reel in!',
      speak_snapped:    'Line snapped!',
      speak_caught:     (fish, size, score) => `${fish}! ${size}. ${score} fish.`,
      speak_caught_special: (fish, score) => `${fish}! Special! ${score} fish.`,
      speak_danger:     'Danger! Release!',
      speak_tension:    'High tension!',
      speak_no_sensor:  'Sensor permission denied. Using keyboard fallback.',

      // Size descriptions
      size_tiny:   'small',
      size_small:  'medium',
      size_medium: 'large',
      size_large:  'enormous',

      // Fish names
      fish_lambari:  'Lambari',
      fish_tilapia:  'Tilapia',
      fish_truta:    'Trout',
      fish_dourado:  'Dourado',
      fish_pirarucu: 'Pirarucu',
    },
    hu: {
      // Nyelvválasztó képernyő
      lang_title:       'Válassz nyelvet',
      lang_subtitle:    'Escolha o idioma',

      // Menü
      subtitle:         'Ez a játék a telefon mozgását érzékeli.',
      btn_start:        'Kezdj el horgászni',
      btn_instructions: 'Hogyan kell játszani',
      hint:             'A játékhoz tartsd a telefont függőlegesen',
      credits_by:       'By',
      credits_brand:    'Eu Concego Jogar',

      // Útmutató-képernyő
      how_to_play:      'Hogyan kell játszani',
      instr_sensor_title:  '📱 Telefon a mozgásérzékeléssel (gyorsulásmérővel)',
      instr_cast:       'Dobás',
      instr_cast_desc:  'döntsd előre a telefont',
      instr_reel:       'Zsinór visszahúzása',
      instr_reel_desc:  'döntsd hátra a telefont',
      instr_hook:       'Horogra akasztás',
      instr_hook_desc:  'Rázd meg a telefont, amikor meghallod a jelzést',
      instr_kb_title:   '⌨️ PC / billentyűzet',
      instr_kb_cast:    'Dobás',
      instr_kb_cast_desc: 'fel nyíl ↑',
      instr_kb_reel:    'Zsinór visszahúzása',
      instr_kb_reel_desc: 'le nyíl ↓',
      instr_kb_hook:    'Horogra akasztás',
      instr_kb_hook_desc: 'szóköz',
      instr_a11y_title: 'Akadálymentesítés',
      instr_a11y_1:     'TalkBack bekapcsolásával is működik',
      instr_a11y_2:     'Minden jelzés valós időben felolvasásra kerül',
      instr_a11y_3:     'Rezgéses visszajelzés fontos eseményeknél',
      btn_back:         'Vissza a menübe',

      // Játék kezelőfelülete
      hud_fish:         'Hal',
      hud_best:         'Legjobb',
      tension_label:    'Zsinór feszessége',

      // Eredményképernyő
      result_caught:    'Hal kifogva!',
      result_caught_desc: fish => `Fogtál egy ${fish}-t!`,
      result_snapped:   'A zsinór elszakadt!',
      result_snapped_desc: 'Ez a hal túl erős volt ezúttal.',
      stat_today:       'Mai halak',
      stat_best:        'Legjobb kör',
      stat_unit:        'hal',
      btn_again:        'Horgássz újra',
      btn_menu:         'Menü',

      // Állapotjelzések
      state_idle:       '🎣 Dobásra kész',
      state_casting:    '🌊 Dobás...',
      state_waiting:    '🌊 Kapásra várva...',
      state_biting:     fish => `⚡ ${fish} a horgon! Rázd meg!`,
      state_reeling:    fish => `🎣 ${fish} fárasztása...`,
      state_caught:     fish => `🏆 ${fish} kifogva!`,
      state_snapped:    '💥 Elszakadt a zsinór!',
      state_escaped:    '😔 A hal elmenekült...',
      state_tired:      fish => `😮‍💨 ${fish} elfáradt — húzd vissza!`,
      state_pulled_out: 'A csali kijött a vízből — döntsd előre a telefont',

      // Telefon döntési tippek
      tilt_idle:        'Döntsd előre a dobáshoz',
      tilt_casting:     'Csali bedobása...',
      tilt_waiting:     'Tartsd mozdulatlanul a telefont',
      tilt_biting:      'Rázd meg a telefont a hal horogra akasztásához!',
      tilt_reeling:     'Döntsd hátra a telefont a zsinór visszahúzásához!',

      // Hangbemondások
      speak_ready:      'Készen állsz. Döntsd előre.',
      speak_waiting:    'A csali a vízben van. Várj.',
      speak_fish:       'Hal a csalin! Rázd meg!',
      speak_hooked:     'Kapás! Döntsd hátra!',
      speak_rehooked:   'Kapás!',
      speak_escaped:    'Elmenekült.',
      speak_pulled_out: 'Újra dobás. Döntsd előre.',
      speak_tired:      'Elfáradt! Húzd vissza!',
      speak_snapped:    'Elszakadt a zsinór!',
      speak_caught:     (fish, size, score) => `${fish}! ${size}. ${score} hal.`,
      speak_caught_special: (fish, score) => `${fish}! Különleges egy fogás! ${score} hal.`,
      speak_danger:     'Veszély! Engedj a zsinóron!',
      speak_tension:    'Nagy zsinór-feszesség!',
      speak_no_sensor:  'Az érzékelők engedélyezése sikertelen. Billentyűzetes vezérlés használata.',

      // Méretleírások
      size_tiny:   'apró',
      size_small:  'kicsi',
      size_medium: 'közepes',
      size_large:  'hatalmas',

      // Halnevek
      fish_lambari:  'Lambari',
      fish_tilapia:  'Tilápia',
      fish_truta:    'Pisztráng',
      fish_dourado:  'Dourado',
      fish_pirarucu: 'Pirarucu',
    },
  };

  // ── Estado interno ───────────────────────────────────────────────────────
  let _lang = localStorage.getItem('bb_lang') || null;

  // ── API pública ──────────────────────────────────────────────────────────
  function setLang(code) {
    _lang = code;
    localStorage.setItem('bb_lang', code);
    const langMap = { pt: 'pt-BR', en: 'en', hu: 'hu' };
    document.documentElement.lang = langMap[code] || code;
  }

  function getLang() { return _lang; }

  function t(key, ...args) {
    const dict = STRINGS[_lang] || STRINGS['pt'];
    const val  = dict[key];
    if (typeof val === 'function') return val(...args);
    return val ?? key;
  }

  return { setLang, getLang, t };
})();



