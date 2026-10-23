(function () {
  'use strict';

  var KEY = 'pastel-pomodoro-v1';
  var MODES = {
    focus: { label: 'Focus', ms: 25 * 60000 },
    short: { label: 'Break', ms: 5 * 60000 },
    long: { label: 'Long break', ms: 15 * 60000 }
  };
  var TYPES = ['tulip', 'daisy', 'lavender'];
  var NAMES = { tulip: 'Blush tulip', daisy: 'Moon daisy', lavender: 'Lilac spire' };
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- state ---------- */
  function defaults() {
    return {
      stage: 0, type: 'tulip', garden: [], blooms: 0, days: {}, totalMin: 0, cycle: 0,
      timer: { mode: 'focus', running: false, endAt: 0, remainingMs: MODES.focus.ms },
      prefs: { chime: true, volume: 0.5 }
    };
  }
  function load() {
    var d = defaults();
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return d;
      var s = JSON.parse(raw);
      if (!s || typeof s !== 'object') return d;
      if (typeof s.stage === 'number') d.stage = Math.max(0, Math.min(4, Math.floor(s.stage)));
      if (TYPES.indexOf(s.type) >= 0) d.type = s.type;
      if (Array.isArray(s.garden)) d.garden = s.garden.filter(function (g) { return g && TYPES.indexOf(g.type) >= 0; });
      if (typeof s.blooms === 'number') d.blooms = s.blooms;
      if (s.days && typeof s.days === 'object') d.days = s.days;
      if (typeof s.totalMin === 'number') d.totalMin = s.totalMin;
      if (typeof s.cycle === 'number') d.cycle = s.cycle;
      if (s.timer && MODES[s.timer.mode]) {
        d.timer.mode = s.timer.mode;
        d.timer.running = !!s.timer.running;
        d.timer.endAt = +s.timer.endAt || 0;
        d.timer.remainingMs = +s.timer.remainingMs || MODES[s.timer.mode].ms;
      }
      if (s.prefs) {
        if (typeof s.prefs.chime === 'boolean') d.prefs.chime = s.prefs.chime;
        if (typeof s.prefs.volume === 'number') d.prefs.volume = Math.max(0, Math.min(1, s.prefs.volume));
      }
    } catch (e) {}
    return d;
  }
  // The original visual timer state remains a local cache. Authoritative user
  // progress, sessions and rewards are stored in the authenticated API.
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  var state = load();

  function dayKey(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  /* ---------- pixel art ---------- */
  var C = {
    leaf: '#86B584', leafD: '#55805A', leafL: '#B9DBB1', stem: '#62905F', stemD: '#4E7A52',
    pot: '#EBA79F', potD: '#C97A74', potL: '#F8C9C2', soil: '#6B4A3E', soilL: '#8A6554', soilW: '#4B342B',
    seed: '#D2A56B', spark: '#FFF1A6', drop: '#8FCBF2', dropL: '#D6EEFC', can: '#A9CBA4', canD: '#58805D',
    tulip: { m: '#E8789A', l: '#F7ADC2', d: '#BC4C72' },
    daisy: { m: '#FFFFFF', d: '#DCCFE6', c: '#F3C94F', cd: '#D6962A' },
    lavender: { m: '#A99BE3', l: '#CFC6F3', d: '#7B69C2' }
  };

  function readTheme() {
    var s = getComputedStyle(document.documentElement);
    return {
      cloud: s.getPropertyValue('--cloud').trim() || '#ffffff',
      shelf: s.getPropertyValue('--shelf').trim() || '#D4A99A',
      shelfD: s.getPropertyValue('--shelf-dark').trim() || '#B3877A'
    };
  }
  var th = readTheme();

  function paint(c, stage, type, o) {
    o = o || {};
    c.clearRect(0, 0, 48, 48);
    function px(x, y, col) { c.fillStyle = col; c.fillRect(x, y, 1, 1); }
    function rc(x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
    function leaf(ax, ay, side, big) {
      var rows = big
        ? [[0, 3, -3, C.leaf], [0, 6, -2, C.leaf], [0, 7, -1, C.leaf], [0, 5, 0, C.leafD], [1, 4, -2, C.leafL]]
        : [[0, 2, -2, C.leaf], [0, 5, -1, C.leaf], [0, 4, 0, C.leafD], [1, 3, -1, C.leafL]];
      rows.forEach(function (r) {
        var x0 = side < 0 ? ax - r[1] : ax + r[0];
        rc(x0, ay + r[2], r[1] - r[0] + 1, 1, r[3]);
      });
    }
    function stem(top) { rc(23, top, 2, 36 - top, C.stem); rc(24, top, 1, 36 - top, C.stemD); }
    function plus(x, y, small) {
      px(x, y, C.spark);
      if (!small) { px(x - 1, y, C.spark); px(x + 1, y, C.spark); px(x, y - 1, C.spark); px(x, y + 1, C.spark); }
    }

    if (o.bg) {
      var cl = th.cloud;
      [[4, 7], [33, 5], [5, 19]].forEach(function (p) {
        rc(p[0] + 1, p[1], 5, 1, cl); rc(p[0], p[1] + 1, 8, 1, cl); rc(p[0] + 2, p[1] - 1, 3, 1, cl);
      });
    }
    /* shelf */
    rc(2, 46, 44, 2, th.shelf); rc(2, 47, 44, 1, th.shelfD);

    /* pot */
    rc(15, 37, 18, 3, C.pot); rc(15, 37, 18, 1, C.potL); rc(15, 39, 18, 1, C.potD);
    var widths = [14, 14, 12, 12, 10, 10];
    for (var i = 0; i < 6; i++) {
      var w = widths[i], x = 24 - w / 2;
      rc(x, 40 + i, w, 1, C.pot);
      px(x, 40 + i, C.potL); px(x + w - 1, 40 + i, C.potD); px(x + w - 2, 40 + i, C.potD);
    }
    rc(19, 42, 3, 1, C.potL); rc(26, 43, 3, 1, C.potD);
    /* soil */
    rc(16, 36, 16, 1, (o.water != null && o.water > 8) ? C.soilW : C.soil);
    rc(17, 36, 3, 1, C.soilL);

    /* plant */
    if (stage === 0) {
      rc(21, 35, 2, 1, C.soil); rc(25, 35, 2, 1, C.soil);
      px(23, 35, C.seed); px(24, 35, C.seed);
    } else if (stage === 1) {
      stem(31);
      leaf(22, 32, -1, false); leaf(25, 31, 1, false);
    } else if (stage === 2) {
      stem(23);
      leaf(22, 33, -1, true); leaf(25, 30, 1, true); leaf(22, 26, -1, false);
    } else {
      var top = stage === 3 ? 19 : 18;
      stem(top);
      leaf(22, 33, -1, true); leaf(25, 30, 1, true); leaf(22, 26, -1, false); leaf(25, 24, 1, false);
      if (stage === 3) {
        var p = C[type];
        var m = p.m, l = p.l || '#ffffff', d = p.d;
        if (type === 'daisy') { m = '#EFE7F5'; l = '#FFFFFF'; d = '#CDBFDB'; }
        rc(23, 13, 2, 1, m); rc(22, 14, 4, 4, m);
        px(22, 14, l); px(22, 15, l); px(25, 16, d); px(25, 17, d);
        rc(22, 18, 4, 1, C.leaf); px(21, 18, C.leafL); px(26, 18, C.leafL);
      } else if (type === 'tulip') {
        var t = C.tulip;
        px(21, 8, t.m); px(23, 8, t.m); px(24, 8, t.m); px(26, 8, t.m);
        rc(20, 9, 8, 1, t.m);
        rc(19, 10, 10, 2, t.m);
        rc(20, 12, 8, 2, t.m);
        rc(21, 14, 6, 1, t.m);
        rc(22, 15, 4, 1, t.m);
        rc(23, 16, 2, 1, t.m);
        for (var y = 9; y <= 13; y++) { px(y < 12 ? 19 + (y === 9 ? 1 : 0) : 20, y, t.l); px(y < 12 ? 28 - (y === 9 ? 1 : 0) : 27, y, t.d); }
        px(23, 10, t.l); px(23, 11, t.l); px(24, 12, t.d); px(24, 13, t.d);
        rc(22, 17, 4, 1, C.leaf);
      } else if (type === 'daisy') {
        var dz = C.daisy;
        for (var yy = 5; yy <= 18; yy++) {
          for (var xx = 16; xx <= 31; xx++) {
            var dx = xx + 0.5 - 24, dy = yy + 0.5 - 12, r = Math.sqrt(dx * dx + dy * dy);
            if (r > 6.4) continue;
            if (r <= 2.9) { px(xx, yy, ((xx + yy) % 3 === 0 && r > 1.2) ? dz.cd : dz.c); continue; }
            var a = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI / 4);
            var gap = a < 0.16 || a > Math.PI / 4 - 0.16;
            px(xx, yy, gap ? dz.d : dz.m);
          }
        }
      } else {
        var lv = C.lavender;
        var spire = [[5, 2], [6, 2], [7, 4], [8, 4], [9, 4], [10, 6], [11, 6], [12, 6], [13, 6], [14, 4], [15, 4], [16, 2], [17, 2]];
        spire.forEach(function (rw) {
          var wd = rw[1], x0 = 24 - wd / 2;
          for (var k = 0; k < wd; k++) {
            var X = x0 + k;
            px(X, rw[0], ((X + rw[0]) % 2) ? lv.m : lv.l);
          }
          px(x0 + wd - 1, rw[0], lv.d);
        });
        px(21, 12, C.leaf); px(26, 12, C.leaf); px(21, 15, C.leafL); px(26, 15, C.leafL);
      }
      if (stage === 4) {
        var sp = o.sp ? 1 : 0;
        plus(11, 9, !!sp); plus(37, 8, !sp); plus(9, 24, !sp); plus(39, 22, !!sp); plus(13, 31, !sp);
      }
    }

    /* watering can + drops */
    if (o.water != null) {
      var f = o.water;
      rc(7, 10, 9, 6, C.can); rc(7, 15, 9, 1, C.canD); rc(7, 10, 1, 6, C.canD); rc(8, 11, 3, 1, '#D6E8D2');
      rc(5, 11, 2, 1, C.canD); rc(4, 12, 1, 3, C.canD); rc(5, 15, 2, 1, C.canD);
      rc(16, 13, 4, 1, C.canD); rc(19, 14, 1, 1, C.canD); rc(20, 13, 2, 4, C.canD);
      if (f < 14) {
        for (var k = 0; k < 3; k++) {
          var yd = 18 + ((f * 3 + k * 6) % 18);
          px(21 + k, yd, C.drop); px(21 + k, yd + 1, C.dropL);
        }
      }
    }
    /* growth burst */
    if (o.burst != null) {
      var b = o.burst;
      c.globalAlpha = Math.max(0.15, 1 - b / 6);
      for (var n = 0; n < 8; n++) {
        var ang = n * Math.PI / 4 + 0.4, rad = 7 + b * 2.2;
        plus(Math.round(24 + Math.cos(ang) * rad), Math.round(24 + Math.sin(ang) * rad), b > 3);
      }
      c.globalAlpha = 1;
    }
  }

  var sceneEl = document.getElementById('scene');
  var sctx = sceneEl.getContext('2d');
  sctx.imageSmoothingEnabled = false;
  var shown = { stage: state.stage, type: state.type };
  var spark = 0, animating = false, animIv = null;

  function drawMain(extra) {
    var o = { bg: true, sp: spark };
    if (extra) for (var k in extra) o[k] = extra[k];
    paint(sctx, shown.stage, shown.type, o);
  }

  function animateGrowth(prevStage) {
    if (animIv) { clearInterval(animIv); animIv = null; }
    shown.type = state.type;
    if (reduce) { shown.stage = state.stage; animating = false; drawMain(); return; }
    shown.stage = prevStage;
    animating = true;
    var f = 0;
    animIv = setInterval(function () {
      if (f < 16) {
        drawMain({ water: f });
      } else if (f < 22) {
        shown.stage = state.stage;
        drawMain({ burst: f - 16 });
      } else {
        clearInterval(animIv); animIv = null; animating = false;
        shown.stage = state.stage; drawMain();
      }
      f++;
    }, 85);
  }

  setInterval(function () {
    if (shown.stage === 4 && !animating && !reduce) { spark = spark ? 0 : 1; drawMain(); }
  }, 700);

  function themeChanged() { th = readTheme(); drawMain(); renderGarden(); }
  if (window.matchMedia) {
    var mq = matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', themeChanged); else if (mq.addListener) mq.addListener(themeChanged);
  }
  try { new MutationObserver(themeChanged).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) {}

  /* ---------- audio (generated in the browser) ---------- */
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  var BEAT = 0.8, BAR = BEAT * 4;
  var PROG = [
    { root: 48, notes: [60, 64, 67, 71] },
    { root: 45, notes: [57, 60, 64, 67] },
    { root: 41, notes: [53, 57, 60, 64] },
    { root: 43, notes: [55, 59, 62, 65] }
  ];
  var PENT = [72, 74, 76, 79, 81];

  var Snd = {
    ctx: null, master: null, bus: null, hiss: null, iv: null, noise: null, nextT: 0, step: 0, playing: false,
    ensure: function () {
      if (!this.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        try { this.ctx = new AC(); } catch (e) { return false; }
        this.master = this.ctx.createGain();
        this.master.gain.value = state.prefs.volume;
        this.master.connect(this.ctx.destination);
        var n = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate), d = n.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.noise = n;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    },
    setVolume: function (v) { if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); },
    hit: function (t, type, freq, dur, vol) {
      var c = this.ctx, s = c.createBufferSource();
      s.buffer = this.noise;
      var f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
      var g = c.createGain();
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(this.bus);
      s.start(t, Math.random() * 0.5, dur + 0.05);
    },
    bar: function (t, i) {
      var c = this.ctx, bus = this.bus, ch = PROG[i], self = this;
      ch.notes.forEach(function (m, k) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'triangle'; o.frequency.value = hz(m); o.detune.value = k % 2 ? 7 : -7;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.05, t + 0.35);
        g.gain.linearRampToValueAtTime(0.0001, t + BAR + 0.4);
        o.connect(g); g.connect(bus); o.start(t); o.stop(t + BAR + 0.5);
      });
      var bo = c.createOscillator(), bg = c.createGain();
      bo.type = 'sine'; bo.frequency.value = hz(ch.root);
      bg.gain.setValueAtTime(0.0001, t); bg.gain.linearRampToValueAtTime(0.22, t + 0.05);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + BAR - 0.1);
      bo.connect(bg); bg.connect(bus); bo.start(t); bo.stop(t + BAR);
      [0, 2.5].forEach(function (b) {
        var s = t + b * BEAT, ko = c.createOscillator(), kg = c.createGain();
        ko.type = 'sine'; ko.frequency.setValueAtTime(130, s); ko.frequency.exponentialRampToValueAtTime(42, s + 0.13);
        kg.gain.setValueAtTime(0.4, s); kg.gain.exponentialRampToValueAtTime(0.0001, s + 0.2);
        ko.connect(kg); kg.connect(bus); ko.start(s); ko.stop(s + 0.25);
      });
      [1, 3].forEach(function (b) { self.hit(t + b * BEAT, 'bandpass', 1800, 0.13, 0.16); });
      for (var h = 0; h < 8; h++) self.hit(t + h * BEAT / 2 + (h % 2 ? 0.05 : 0), 'highpass', 7500, 0.04, h % 2 ? 0.05 : 0.08);
      var spots = [0, 1, 1.5, 2, 2.5, 3, 3.5];
      for (var n = 0; n < 3; n++) {
        if (Math.random() < 0.65) {
          var st = t + spots[Math.floor(Math.random() * spots.length)] * BEAT + 0.02;
          var no = c.createOscillator(), ng = c.createGain();
          no.type = 'triangle'; no.frequency.value = hz(PENT[Math.floor(Math.random() * PENT.length)]);
          ng.gain.setValueAtTime(0.0001, st); ng.gain.linearRampToValueAtTime(0.07, st + 0.01);
          ng.gain.exponentialRampToValueAtTime(0.0001, st + 1.0);
          no.connect(ng); ng.connect(bus); no.start(st); no.stop(st + 1.05);
        }
      }
    },
    sched: function () {
      while (this.nextT < this.ctx.currentTime + 1.5) {
        this.bar(this.nextT, this.step % 4);
        this.nextT += BAR; this.step++;
      }
    },
    start: function () {
      if (!this.ensure()) return false;
      if (this.playing) return true;
      var c = this.ctx, self = this;
      this.bus = c.createGain(); this.bus.gain.value = 1;
      var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600; lp.Q.value = 0.6;
      this.bus.connect(lp); lp.connect(this.master);
      var h = c.createBufferSource(); h.buffer = this.noise; h.loop = true;
      var hb = c.createBiquadFilter(); hb.type = 'bandpass'; hb.frequency.value = 2800; hb.Q.value = 0.5;
      var hg = c.createGain(); hg.gain.value = 0.012;
      h.connect(hb); hb.connect(hg); hg.connect(this.bus); h.start();
      this.hiss = h;
      this.nextT = c.currentTime + 0.15; this.step = 0; this.playing = true;
      this.sched();
      this.iv = setInterval(function () { self.sched(); }, 250);
      return true;
    },
    stop: function () {
      if (!this.playing) return;
      this.playing = false; clearInterval(this.iv);
      var c = this.ctx, bus = this.bus, h = this.hiss;
      bus.gain.cancelScheduledValues(c.currentTime);
      bus.gain.setTargetAtTime(0, c.currentTime, 0.15);
      setTimeout(function () { try { h.stop(); } catch (e) {} try { bus.disconnect(); } catch (e) {} }, 900);
    },
    chime: function () {
      if (!state.prefs.chime || !this.ensure()) return;
      var c = this.ctx, t = c.currentTime + 0.02, m = this.master;
      [84, 88, 91, 96].forEach(function (n, i) {
        var o = c.createOscillator(), g = c.createGain(), s = t + i * 0.14;
        o.type = 'sine'; o.frequency.value = hz(n);
        g.gain.setValueAtTime(0.0001, s); g.gain.linearRampToValueAtTime(0.16, s + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, s + 1.4);
        o.connect(g); g.connect(m); o.start(s); o.stop(s + 1.5);
      });
    }
  };

  /* ---------- elements ---------- */
  function $(id) { return document.getElementById(id); }
  var elDigits = $('digits'), elSeg = $('seg'), elStart = $('startBtn'), elEvent = $('event');
  var segs = [];
  for (var i = 0; i < 25; i++) { var sp = document.createElement('span'); elSeg.appendChild(sp); segs.push(sp); }
  var pipEls = [];
  for (var j = 0; j < 4; j++) { var pp = document.createElement('span'); $('pips').appendChild(pp); pipEls.push(pp); }

  /* ---------- rendering ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function renderTimer() {
    var t = state.timer, mode = MODES[t.mode];
    var ms = t.running ? Math.max(0, t.endAt - Date.now()) : t.remainingMs;
    var secs = Math.ceil(ms / 1000);
    var txt = pad(Math.floor(secs / 60)) + ':' + pad(secs % 60);
    elDigits.textContent = txt;
    var progress = 1 - ms / mode.ms;
    var filled = Math.min(25, Math.max(0, Math.floor(progress * 25 + 0.0001)));
    for (var k = 0; k < 25; k++) segs[k].className = k < filled ? 'on' : '';
    elSeg.setAttribute('data-mode', t.mode);
    elStart.textContent = t.running ? 'Pause' : (ms < mode.ms ? 'Resume' : 'Start');
    document.querySelectorAll('[data-mode].btn').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-mode') === t.mode ? 'true' : 'false');
    });
    document.title = t.running ? txt + ' · ' + mode.label : 'Bloom — Focus & Grow';
  }

  var STATUS = [
    'A seed is in the pot. Finish one focus sprint to water it.',
    'A sprout came up. Three more sprints to a flower.',
    'Leaves are opening. Two more sprints to go.',
    'A bud has formed. One more sprint.',
    'It bloomed and moved to your garden shelf.'
  ];
  function renderPlant() {
    $('plantName').textContent = NAMES[state.type];
    for (var k = 0; k < 4; k++) pipEls[k].className = k < state.stage ? 'on' : '';
    $('pipLabel').textContent = state.stage >= 4 ? 'Bloomed' : 'Sprint ' + state.stage + ' of 4';
    $('plantStatus').textContent = STATUS[state.stage];
    $('newSeed').hidden = state.stage < 4;
    sceneEl.setAttribute('aria-label', NAMES[state.type] + ', growth stage ' + state.stage + ' of 4');
  }

  function fmtTime(min) {
    if (min < 60) return min + 'm';
    var h = Math.floor(min / 60), m = min % 60;
    return h + 'h ' + pad(m) + 'm';
  }
  function streak() {
    var d = new Date();
    if (!(state.days[dayKey(d)] > 0)) d.setDate(d.getDate() - 1);
    var n = 0;
    while (state.days[dayKey(d)] > 0) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function renderStats() {
    $('sToday').textContent = state.days[dayKey(new Date())] || 0;
    $('sStreak').textContent = streak();
    $('sTime').textContent = fmtTime(state.totalMin);
    $('sBlooms').textContent = state.blooms;
    var week = $('week');
    week.textContent = '';
    for (var k = 6; k >= 0; k--) {
      var d = new Date(); d.setDate(d.getDate() - k);
      var n = state.days[dayKey(d)] || 0;
      var col = document.createElement('div');
      col.className = 'day' + (k === 0 ? ' today' : '');
      var num = document.createElement('div'); num.className = 'n'; num.textContent = n;
      var stack = document.createElement('div'); stack.className = 'stack';
      for (var p = 0; p < 4; p++) {
        var s = document.createElement('span');
        if (n >= 4) s.className = 'full'; else if (p < n) s.className = 'on';
        stack.appendChild(s);
      }
      var lab = document.createElement('div'); lab.className = 'l';
      lab.textContent = d.toLocaleDateString('en', { weekday: 'short' }).slice(0, 2);
      col.appendChild(num); col.appendChild(stack); col.appendChild(lab);
      col.setAttribute('aria-label', d.toLocaleDateString('en', { weekday: 'long' }) + ': ' + n + ' sprints');
      week.appendChild(col);
    }
  }

  function renderGarden() {
    var ul = $('garden');
    ul.textContent = '';
    $('gardenEmpty').hidden = state.garden.length > 0;
    state.garden.slice().reverse().forEach(function (g) {
      var li = document.createElement('li');
      var cv = document.createElement('canvas'); cv.width = 48; cv.height = 48;
      var c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
      paint(c, 4, g.type, { bg: false, sp: 0 });
      cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', NAMES[g.type]);
      var nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = NAMES[g.type];
      var dt = document.createElement('div'); dt.className = 'dt';
      dt.textContent = new Date(g.date).toLocaleDateString('en', { day: 'numeric', month: 'short' });
      li.appendChild(cv); li.appendChild(nm); li.appendChild(dt);
      ul.appendChild(li);
    });
  }

  function renderPrefs() {
    $('chimeBtn').setAttribute('aria-pressed', state.prefs.chime ? 'true' : 'false');
    $('chimeBtn').textContent = 'Chime: ' + (state.prefs.chime ? 'on' : 'off');
    $('vol').value = Math.round(state.prefs.volume * 100);
    var on = Snd.playing;
    $('musicBtn').setAttribute('aria-pressed', on ? 'true' : 'false');
    $('musicBtn').textContent = 'Lo-fi: ' + (on ? 'on' : 'off');
  }

  function say(msg) { elEvent.textContent = msg; }

  /* ---------- timer logic ---------- */
  var ticker = null;

  function startTicker() {
    if (ticker) clearInterval(ticker);
    ticker = setInterval(tick, 250);
  }
  function stopTicker() { if (ticker) { clearInterval(ticker); ticker = null; } }

  function tick() {
    var t = state.timer;
    if (!t.running) { stopTicker(); return; }
    var left = t.endAt - Date.now();
    if (left <= 0) complete(false); else renderTimer();
  }

  function replant() {
    state.stage = 0;
    state.type = TYPES[state.blooms % TYPES.length];
    shown.stage = 0; shown.type = state.type;
  }

  function startTimer() {
    var t = state.timer;
    if (t.mode === 'focus' && state.stage >= 4) { replant(); drawMain(); renderPlant(); }
    Snd.ensure();
    t.running = true;
    t.endAt = Date.now() + t.remainingMs;
    save(); startTicker(); renderTimer();
    if (t.mode === 'focus') window.dispatchEvent(new CustomEvent('bloom:timer-start'));
    say(t.mode === 'focus' ? 'Focus sprint started.' : 'Break started.');
  }
  function pauseTimer() {
    var t = state.timer;
    t.remainingMs = Math.max(1000, t.endAt - Date.now());
    t.running = false; t.endAt = 0;
    stopTicker(); save(); renderTimer();
    if (t.mode === 'focus') window.dispatchEvent(new CustomEvent('bloom:timer-pause'));
    say('Paused.');
  }
  function resetTimer() {
    var t = state.timer;
    stopTicker();
    t.running = false; t.endAt = 0; t.remainingMs = MODES[t.mode].ms;
    save(); renderTimer();
    window.dispatchEvent(new CustomEvent('bloom:timer-reset'));
    say('');
  }
  function setMode(m) {
    var t = state.timer;
    stopTicker();
    if (t.mode === 'focus') window.dispatchEvent(new CustomEvent('bloom:timer-reset'));
    t.mode = m; t.running = false; t.endAt = 0; t.remainingMs = MODES[m].ms;
    save(); renderTimer(); say('');
  }

  function complete(awayCredit, manual) {
    stopTicker();
    var t = state.timer;
    var wasFocus = t.mode === 'focus';
    if (manual && wasFocus) {
      t.running = false; t.endAt = 0; t.remainingMs = MODES.focus.ms;
      save(); renderTimer();
      window.dispatchEvent(new CustomEvent('bloom:timer-reset'));
      say('Session skipped. No focus rewards were earned.');
      return;
    }
    if (wasFocus) window.dispatchEvent(new CustomEvent('bloom:session-complete', { detail: { minutes: 25 } }));
    t.running = false; t.endAt = 0;
    Snd.chime();
    if (wasFocus) {
      if (state.stage >= 4) replant();
      var before = state.stage;
      state.stage++;
      var bloomed = state.stage === 4;
      if (bloomed) { state.blooms++; state.garden.push({ type: state.type, date: Date.now() }); }
      var k = dayKey(new Date());
      state.days[k] = (state.days[k] || 0) + 1;
      state.totalMin += 25;
      state.cycle++;
      var next = 'short';
      if (state.cycle >= 4) { next = 'long'; state.cycle = 0; }
      t.mode = next; t.remainingMs = MODES[next].ms;
      save();
      animateGrowth(before);
      renderPlant(); renderStats(); renderGarden(); renderTimer();
      say((awayCredit ? 'A sprint finished while you were away. ' : 'Sprint done. ') +
        (bloomed ? 'Your ' + NAMES[state.type].toLowerCase() + ' bloomed.' : 'The plant got watered.') +
        ' ' + (next === 'long' ? 'Take a 15-minute break.' : 'Take a 5-minute break.'));
    } else {
      t.mode = 'focus'; t.remainingMs = MODES.focus.ms;
      save(); renderTimer();
      say('Break over. Ready for the next sprint.');
    }
  }

  /* ---------- events ---------- */
  elStart.addEventListener('click', function () { state.timer.running ? pauseTimer() : startTimer(); });
  $('resetBtn').addEventListener('click', resetTimer);
  $('skipBtn').addEventListener('click', function () { complete(false, true); });
  document.querySelectorAll('[data-mode].btn').forEach(function (b) {
    b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); });
  });
  $('newSeed').addEventListener('click', function () {
    replant(); save(); drawMain(); renderPlant(); say('New seed planted.');
  });
  $('musicBtn').addEventListener('click', function () {
    if (Snd.playing) Snd.stop(); else if (!Snd.start()) say('This browser blocked audio.');
    renderPrefs();
  });
  $('chimeBtn').addEventListener('click', function () {
    state.prefs.chime = !state.prefs.chime; save(); renderPrefs();
    if (state.prefs.chime) Snd.chime();
  });
  $('vol').addEventListener('input', function (e) {
    state.prefs.volume = e.target.value / 100;
    Snd.setVolume(state.prefs.volume); save();
  });
  $('clearBtn').addEventListener('click', function () { $('clearBtn').hidden = true; $('clearAsk').hidden = false; });
  $('clearNo').addEventListener('click', function () { $('clearAsk').hidden = true; $('clearBtn').hidden = false; });
  $('clearYes').addEventListener('click', function () {
    var prefs = state.prefs;
    stopTicker();
    state = defaults(); state.prefs = prefs;
    shown.stage = 0; shown.type = state.type;
    save(); drawMain(); renderAll();
    $('clearAsk').hidden = true; $('clearBtn').hidden = false;
    say('Progress cleared. A fresh seed is in the pot.');
  });

  function renderAll() { renderTimer(); renderPlant(); renderStats(); renderGarden(); renderPrefs(); }

  /* ---------- boot ---------- */
  drawMain();
  renderAll();
  if (state.timer.running) {
    if (state.timer.endAt > Date.now()) { startTicker(); say('Picked up where you left off.'); }
    else complete(true);
  }

})();
