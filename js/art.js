'use strict';
/* =========================================================
   Иллюстрации домов в виде SVG (вместо фотографий).
   Свет, глубина резкости, текстура дерева, освещённые окна.
   Работают без интернета. Если у дома в data.js заполнено поле photo,
   показывается фотография, а рисунок остаётся запасным вариантом.
   ========================================================= */
const Art = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  let uid = 0;

  // Время суток и сезоны: небо, свет, цвет «цветокоррекции», освещённые окна
  const MOODS = {
    day: {
      sky: ['#4f9fe6', '#9ccdf3', '#e9f5ff'], sun: { x: 252, y: 46, c: '#fff4c2', glow: 0.55 },
      grade: null, mount: ['#9db9d0', '#7f9fb8'], fog: '#eaf5ff', tree: ['#2f7a4f', '#1c5238'],
      grass: ['#93c46b', '#5f9a4c'], lake: ['#7dc0e8', '#3f86b8'], clouds: '#ffffff', lit: false
    },
    dusk: {
      sky: ['#2b2a63', '#a8527f', '#ffb67f'], sun: { x: 58, y: 118, c: '#ffd9a0', glow: 0.8 },
      grade: { c: '#d9a2b8', o: 0.5 }, mount: ['#6b5d8a', '#4b476f'], fog: '#f3a98c', tree: ['#1f3a40', '#10252c'],
      grass: ['#4a6a56', '#2c4a3d'], lake: ['#e69a8f', '#6d5a90'], clouds: '#ffb092', lit: true
    },
    night: {
      sky: ['#040a20', '#0f2150', '#2a4a86'], moon: { x: 258, y: 38 },
      grade: { c: '#4a68b0', o: 0.8 }, mount: ['#1f3a66', '#142a4c'], fog: '#2f4d86', tree: ['#0b2a2c', '#06181c'],
      grass: ['#1d3a3a', '#0f2527'], lake: ['#2c5b8f', '#0f2a4d'], clouds: null, lit: true
    },
    autumn: {
      sky: ['#79b0dd', '#c9e0ee', '#fde9c6'], sun: { x: 248, y: 48, c: '#fff0b8', glow: 0.55 },
      grade: { c: '#ffd9a2', o: 0.35 }, mount: ['#b8a58c', '#9c8a73'], fog: '#fbe8c9', tree: ['#2f6f4d', '#1b4a35'],
      grass: ['#c4a246', '#98782f'], lake: ['#93c1d4', '#4d8199'], clouds: '#ffffff', lit: false, leaves: true
    },
    winter: {
      sky: ['#8fb0d3', '#cfdeec', '#f5f9fc'], sun: { x: 246, y: 48, c: '#fffbe6', glow: 0.45 },
      grade: { c: '#cfe0f6', o: 0.35 }, mount: ['#b4c6da', '#93aac4'], fog: '#f1f6fb', tree: ['#2f5a52', '#1b3a38'],
      grass: ['#fbfdff', '#d4e1ef'], lake: ['#b9d3e8', '#7ea4c6'], clouds: '#ffffff', lit: true, snow: true
    }
  };

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // Предсказуемый «случайный» генератор: у каждого дома своя картинка, но всегда одинаковая
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Осветлить (p > 0) или затемнить (p < 0) цвет вида #rrggbb
  function shade(hex, p) {
    const n = parseInt(hex.slice(1), 16);
    let R = n >> 16, G = (n >> 8) & 255, B = n & 255;
    const f = p < 0 ? 0 : 255, t = Math.abs(p);
    R = Math.round((f - R) * t + R); G = Math.round((f - G) * t + G); B = Math.round((f - B) * t + B);
    return '#' + (0x1000000 + R * 65536 + G * 256 + B).toString(16).slice(1);
  }

  // ---------- контекст сцены: градиенты, размытие, окна ----------
  function makeCtx(svg, id, m, rand, has) {
    const defs = el('defs', {}, svg);
    let n = 0;
    ['1', '3', '6', '10'].forEach(s => {
      const f = el('filter', { id: `b${id}_${s}`, x: '-40%', y: '-40%', width: '180%', height: '180%' }, defs);
      el('feGaussianBlur', { stdDeviation: s }, f);
    });
    const ctx = {
      id, m, rand, has, svg, glass: [],
      blur: s => `url(#b${id}_${s})`,
      lg(stops, x1, y1, x2, y2) {
        const gid = `g${id}_${++n}`;
        const g = el('linearGradient', { id: gid, x1: x1 || 0, y1: y1 || 0, x2: x2 === undefined ? 0 : x2, y2: y2 === undefined ? 1 : y2 }, defs);
        stops.forEach(s => el('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] === undefined ? 1 : s[2] }, g));
        return `url(#${gid})`;
      },
      rg(stops) {
        const gid = `g${id}_${++n}`;
        const g = el('radialGradient', { id: gid, cx: 0.5, cy: 0.5, r: 0.5 }, defs);
        stops.forEach(s => el('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] === undefined ? 1 : s[2] }, g));
        return `url(#${gid})`;
      },
      // окно — рисуется позже, после цветокоррекции, чтобы светиться
      glassRect(x, y, w, h, bars) { ctx.glass.push({ tag: 'rect', a: { x, y, width: w, height: h }, bars: bars || [] }); },
      glassPoly(points, bars) { ctx.glass.push({ tag: 'polygon', a: { points: points.map(p => p.join(',')).join(' ') }, bars: bars || [] }); },
      // кровля: тень, основная полоса, блик и снег
      roof(pts, wd, col, snow) {
        const p = pts.map(q => q.join(',')).join(' ');
        const g = el('g', {}, ctx.cur);
        el('polyline', { points: p, fill: 'none', stroke: '#000', 'stroke-opacity': 0.28, 'stroke-width': wd + 3, 'stroke-linejoin': 'miter', transform: 'translate(0,4)', filter: ctx.blur(1) }, g);
        el('polyline', { points: p, fill: 'none', stroke: ctx.lg([[0, shade(col, 0.2)], [1, shade(col, -0.2)]], 0, 0, 1, 1), 'stroke-width': wd, 'stroke-linejoin': 'miter' }, g);
        el('polyline', { points: p, fill: 'none', stroke: shade(col, 0.4), 'stroke-opacity': 0.55, 'stroke-width': 1.2, 'stroke-linejoin': 'miter', transform: `translate(0,${-wd / 2 + 1})` }, g);
        if (snow) el('polyline', { points: p, fill: 'none', stroke: '#f7fafd', 'stroke-width': wd * 0.62, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', transform: `translate(0,${-wd * 0.5})` }, g);
      }
    };
    return ctx;
  }

  // ---------- материалы ----------
  // Деревянная стена: градиент освещения, доски, оттенки отдельных досок
  function wall(ctx, g, x, y, w, h, base, o) {
    o = o || {};
    const step = o.step || 6;
    el('rect', { x, y, width: w, height: h, fill: ctx.lg([[0, shade(base, 0.16)], [0.55, base], [1, shade(base, -0.28)]], 0, 0, 1, 0.15) }, g);
    const rand = ctx.rand;
    let tones = '';
    if (o.dir === 'v') {
      for (let i = 0; i < w; i += step) if (rand() < 0.3) tones += `M${x + i} ${y}h${step}v${h}h-${step}z`;
    } else {
      for (let j = 0; j < h; j += step) if (rand() < 0.3) tones += `M${x} ${y + j}h${w}v${step}h-${w}z`;
    }
    el('path', { d: tones, fill: rand() < 0.5 ? '#000' : '#fff', opacity: 0.07 }, g);
    let dark = '', light = '';
    if (o.dir === 'v') {
      for (let i = step; i < w; i += step) { dark += `M${x + i} ${y}v${h}`; light += `M${x + i + 1} ${y}v${h}`; }
    } else {
      for (let j = step; j < h; j += step) { dark += `M${x} ${y + j}h${w}`; light += `M${x} ${y + j + 1}h${w}`; }
    }
    el('path', { d: dark, stroke: shade(base, -0.55), 'stroke-width': 0.8, opacity: 0.55, fill: 'none' }, g);
    el('path', { d: light, stroke: shade(base, 0.4), 'stroke-width': 0.6, opacity: 0.28, fill: 'none' }, g);
    // тень от карниза сверху
    el('rect', { x, y, width: w, height: Math.min(8, h), fill: ctx.lg([[0, '#000', 0.4], [1, '#000', 0]]) }, g);
  }

  // Настил террасы
  function deck(ctx, g, x, y, w, h, base) {
    el('rect', { x, y, width: w, height: h, fill: ctx.lg([[0, shade(base, 0.22)], [1, shade(base, -0.1)]]) }, g);
    let d = '';
    for (let i = 8; i < w; i += 9) d += `M${x + i} ${y}v${h}`;
    el('path', { d, stroke: shade(base, -0.5), 'stroke-width': 0.6, opacity: 0.5, fill: 'none' }, g);
    el('rect', { x, y: y + h, width: w, height: 2.2, fill: shade(base, -0.45) }, g);
  }

  // Перила
  function rail(ctx, g, x, y, w, h, col) {
    el('rect', { x, y, width: w, height: 1.6, fill: col }, g);
    let d = '';
    for (let i = 3; i < w; i += 5) d += `M${x + i} ${y}v${h}`;
    el('path', { d, stroke: col, 'stroke-width': 0.9, opacity: 0.85 }, g);
    el('rect', { x, y: y + h, width: w, height: 1.4, fill: col }, g);
  }

  // Камень цоколя
  function stone(ctx, g, x, y, w, h) {
    el('rect', { x, y, width: w, height: h, fill: ctx.lg([[0, '#9a9690'], [1, '#625f5a']], 0, 0, 1, 0) }, g);
    const r = ctx.rand;
    for (let j = 0; j < h; j += 5) {
      for (let i = (j / 5 % 2) * 6; i < w; i += 12) {
        el('rect', { x: x + i + 0.5, y: y + j + 0.5, width: 10.5, height: 4, rx: 1, fill: shade('#8d8982', r() * 0.3 - 0.15), opacity: 0.9 }, g);
      }
    }
  }

  // ---------- деревья ----------
  function conifer(ctx, g, x, base, h, cols, snow) {
    const w = h * 0.36, tiers = 5;
    let dark = '', lite = '', cap = '';
    for (let i = 0; i < tiers; i++) {
      const ty = base - h * 0.14 - i * h * 0.17;
      const wi = w * (1 - i * 0.17);
      const top = ty - h * 0.3;
      dark += `M${x} ${top}L${x + wi} ${ty}L${x - wi} ${ty}Z`;
      lite += `M${x} ${top}L${x - wi * 0.2} ${ty - h * 0.02}L${x - wi} ${ty}Z`;
      if (snow) cap += `M${x} ${top}L${x + wi * 0.55} ${top + (ty - top) * 0.55}L${x + wi * 0.1} ${top + (ty - top) * 0.45}L${x - wi * 0.4} ${top + (ty - top) * 0.6}Z`;
    }
    el('rect', { x: x - h * 0.025, y: base - h * 0.16, width: h * 0.05, height: h * 0.18, fill: '#4a3628' }, g);
    el('path', { d: dark, fill: cols[1] }, g);
    el('path', { d: lite, fill: cols[0], opacity: 0.75 }, g);
    if (snow) el('path', { d: cap, fill: '#f5f9fd', opacity: 0.95 }, g);
  }

  function broadleaf(ctx, g, x, base, r, col) {
    el('rect', { x: x - r * 0.1, y: base - r * 1.5, width: r * 0.2, height: r * 1.6, fill: '#5a4130' }, g);
    const pts = [[0, -1.9, 1], [-0.8, -1.35, 0.78], [0.8, -1.35, 0.78], [0, -1.2, 0.9]];
    pts.forEach(p => el('circle', { cx: x + p[0] * r, cy: base + p[1] * r, r: r * p[2], fill: shade(col, -0.12) }, g));
    el('circle', { cx: x - r * 0.25, cy: base - r * 2.05, r: r * 0.7, fill: shade(col, 0.2), opacity: 0.8 }, g);
  }

  // ---------- дома ----------
  // Каждая функция рисует дом и возвращает положение трубы (для дыма) и точки для гирлянды
  const HOUSE = {};

  HOUSE.log = (ctx, g, c) => {
    wall(ctx, g, 100, 128, 124, 42, c.wood, { step: 6 });
    // торцы брёвен по углам
    for (let y = 131; y < 168; y += 6) [100, 224].forEach(x => el('circle', { cx: x, cy: y, r: 3, fill: shade(c.wood, 0.1), stroke: shade(c.wood, -0.5), 'stroke-width': 0.6 }, g));
    // фронтон
    el('polygon', { points: '96,130 162,86 228,130', fill: ctx.lg([[0, shade(c.wood, 0.1)], [1, shade(c.wood, -0.25)]], 0, 0, 1, 1) }, g);
    let v = '';
    for (let x = 108; x < 220; x += 5) v += `M${x} 128L${x} ${Math.max(92, 128 - (x < 162 ? (x - 100) * 0.7 : (224 - x) * 0.7))}`;
    el('path', { d: v, stroke: shade(c.wood, -0.5), 'stroke-width': 0.6, opacity: 0.5 }, g);
    ctx.glassPoly([[150, 128], [162, 104], [174, 128]], [[162, 104, 162, 128]]);
    ctx.roof([[84, 134], [162, 82], [240, 134]], 7, c.roof, ctx.m.snow);
    // труба
    el('rect', { x: 200, y: 88, width: 12, height: 26, fill: ctx.lg([[0, '#8a7d73'], [1, '#524842']], 0, 0, 1, 0) }, g);
    el('rect', { x: 198, y: 86, width: 16, height: 4, fill: '#3d3530' }, g);
    // крыльцо с навесом
    deck(ctx, g, 92, 168, 70, 7, c.wood);
    el('rect', { x: 94, y: 140, width: 3, height: 28, fill: shade(c.wood, -0.35) }, g);
    el('rect', { x: 156, y: 140, width: 3, height: 28, fill: shade(c.wood, -0.35) }, g);
    ctx.roof([[88, 142], [158, 142]], 4, c.roof, ctx.m.snow);
    ctx.glassRect(108, 148, 24, 16, [[120, 148, 120, 164], [108, 156, 132, 156]]);
    ctx.glassRect(176, 140, 26, 20, [[189, 140, 189, 160], [176, 150, 202, 150]]);
    ctx.glassRect(206, 140, 12, 20, []);
    el('rect', { x: 138, y: 146, width: 16, height: 22, fill: shade(c.wood, -0.45) }, g);
    ctx.glassRect(141, 149, 10, 12, []);
    return { smoke: { x: 206, y: 86 }, lights: [[92, 142, 158, 142]] };
  };

  HOUSE.chalet = (ctx, g, c) => {
    stone(ctx, g, 100, 152, 124, 18);
    wall(ctx, g, 100, 118, 124, 34, c.wood, { dir: 'v', step: 5 });
    el('polygon', { points: '100,118 162,92 224,118', fill: ctx.lg([[0, shade(c.wood, 0.08)], [1, shade(c.wood, -0.3)]], 0, 0, 1, 1) }, g);
    ctx.glassPoly([[134, 116], [162, 98], [190, 116]], [[162, 98, 162, 116]]);
    ctx.roof([[66, 128], [162, 86], [258, 128]], 8, c.roof, ctx.m.snow);
    // балкон
    deck(ctx, g, 104, 148, 116, 5, c.wood);
    rail(ctx, g, 104, 138, 116, 10, shade(c.wood, -0.4));
    ctx.glassRect(112, 122, 44, 22, [[134, 122, 134, 144], [112, 133, 156, 133]]);
    ctx.glassRect(166, 122, 44, 22, [[188, 122, 188, 144], [166, 133, 210, 133]]);
    // нижний этаж
    ctx.glassRect(108, 156, 34, 14, [[125, 156, 125, 170]]);
    el('rect', { x: 150, y: 154, width: 20, height: 16, fill: shade(c.wood, -0.5) }, g);
    ctx.glassRect(153, 157, 14, 10, []);
    ctx.glassRect(180, 156, 36, 14, [[198, 156, 198, 170]]);
    el('rect', { x: 206, y: 94, width: 8, height: 22, fill: '#5d554f' }, g);
    return { smoke: { x: 210, y: 94 }, lights: [[104, 136, 220, 136]] };
  };

  HOUSE.aframe = (ctx, g, c) => {
    const body = ctx.lg([[0, shade(c.roof, 0.22)], [1, shade(c.roof, -0.2)]], 0, 0, 1, 0.4);
    el('polygon', { points: '96,172 160,66 224,172', fill: body }, g);
    el('polygon', { points: '96,172 160,66 160,72 102,172', fill: shade(c.roof, 0.35), opacity: 0.5 }, g);
    if (ctx.m.snow) el('polygon', { points: '160,66 176,92 150,86 138,98 146,84', fill: '#f5f9fd', opacity: 0.95 }, g);
    ctx.glassPoly([[118, 172], [160, 96], [202, 172]], [[160, 96, 160, 172], [139, 134, 181, 134], [128, 154, 192, 154]]);
    // обшивка по бокам стекла
    wall(ctx, g, 90, 170, 140, 7, c.wood, { step: 4 });
    el('rect', { x: 96, y: 177, width: 4, height: 9, fill: shade(c.wood, -0.5) }, g);
    el('rect', { x: 220, y: 177, width: 4, height: 9, fill: shade(c.wood, -0.5) }, g);
    rail(ctx, g, 90, 162, 36, 8, shade(c.wood, -0.45));
    rail(ctx, g, 194, 162, 36, 8, shade(c.wood, -0.45));
    // металлическая труба
    el('rect', { x: 126, y: 92, width: 4, height: 24, fill: '#3b3f44', transform: 'rotate(-30 128 104)' }, g);
    return { smoke: { x: 116, y: 102 }, lights: [[90, 166, 160, 70], [160, 70, 230, 166]] };
  };

  HOUSE.barn = (ctx, g, c) => {
    const dark = shade(c.wood, -0.62);
    wall(ctx, g, 102, 118, 116, 52, dark, { dir: 'v', step: 7 });
    el('polygon', { points: '102,120 112,100 162,86 212,100 218,120', fill: ctx.lg([[0, shade(dark, 0.12)], [1, shade(dark, -0.2)]], 0, 0, 1, 1) }, g);
    ctx.roof([[96, 124], [111, 97], [162, 82], [213, 97], [224, 124]], 7, c.roof, ctx.m.snow);
    el('polyline', { points: '104,120 113,102 162,88 211,102 216,120', fill: 'none', stroke: '#f1f1ee', 'stroke-width': 1.3 }, g);
    ctx.glassPoly([[134, 114], [140, 101], [162, 94], [184, 101], [190, 114]], [[162, 94, 162, 114]]);
    ctx.glassRect(130, 124, 64, 46, [[146, 124, 146, 170], [162, 124, 162, 170], [178, 124, 178, 170], [130, 146, 194, 146]]);
    ctx.glassRect(108, 134, 14, 22, []);
    ctx.glassRect(202, 134, 14, 22, []);
    // пристройка слева
    wall(ctx, g, 82, 146, 22, 24, dark, { dir: 'v', step: 6 });
    ctx.roof([[78, 148], [92, 138], [106, 148]], 5, c.roof, ctx.m.snow);
    el('rect', { x: 188, y: 78, width: 6, height: 16, fill: '#34383c' }, g);
    deck(ctx, g, 112, 169, 100, 5, c.wood);
    return { smoke: { x: 191, y: 78 }, lights: [[102, 120, 218, 120]] };
  };

  HOUSE.dome = (ctx, g, c) => {
    deck(ctx, g, 86, 169, 148, 7, c.wood);
    el('rect', { x: 92, y: 176, width: 4, height: 9, fill: shade(c.wood, -0.5) }, g);
    el('rect', { x: 224, y: 176, width: 4, height: 9, fill: shade(c.wood, -0.5) }, g);
    el('path', { d: 'M104 170A56 56 0 0 1 216 170Z', fill: ctx.lg([[0, '#fbf8f0'], [1, '#c9c2b2']], 0, 0, 1, 1) }, g);
    // стеклянные грани купола
    const poly = [[[104, 170], [122, 132], [146, 170]], [[122, 132], [160, 112], [146, 170]], [[160, 112], [174, 170], [146, 170]],
      [[160, 112], [198, 132], [174, 170]], [[198, 132], [216, 170], [174, 170]], [[122, 132], [160, 112], [140, 118]]];
    poly.forEach(p => ctx.glassPoly(p, []));
    let ribs = '';
    [[104, 170, 122, 132], [122, 132, 160, 112], [160, 112, 198, 132], [198, 132, 216, 170], [122, 132, 146, 170], [160, 112, 146, 170],
     [160, 112, 174, 170], [198, 132, 174, 170], [122, 132, 198, 132]].forEach(l => { ribs += `M${l[0]} ${l[1]}L${l[2]} ${l[3]}`; });
    el('path', { d: ribs, stroke: '#7b7567', 'stroke-width': 1.3, fill: 'none', opacity: 0.8 }, g);
    el('path', { d: 'M148 170V152A12 12 0 0 1 172 152V170Z', fill: shade(c.wood, -0.3) }, g);
    el('rect', { x: 166, y: 100, width: 6, height: 14, fill: '#555a5f' }, g);
    return { smoke: { x: 169, y: 99 }, lights: [[90, 168, 160, 108], [160, 108, 230, 168]] };
  };

  HOUSE.modern = (ctx, g, c) => {
    // нижний объём
    el('rect', { x: 100, y: 142, width: 116, height: 28, fill: ctx.lg([[0, '#f1efe9'], [1, '#bdb9ae']], 0, 0, 1, 0.2) }, g);
    // верхний объём с вертикальной рейкой, нависает слева
    wall(ctx, g, 128, 110, 124, 33, shade(c.wood, -0.45), { dir: 'v', step: 4 });
    el('rect', { x: 124, y: 106, width: 132, height: 5, fill: ctx.lg([[0, '#4a4f55'], [1, '#202327']]) }, g);
    el('rect', { x: 96, y: 140, width: 126, height: 4, fill: ctx.lg([[0, '#4a4f55'], [1, '#202327']]) }, g);
    if (ctx.m.snow) { el('rect', { x: 124, y: 103, width: 132, height: 4, rx: 2, fill: '#f6f9fc' }, g); el('rect', { x: 96, y: 137, width: 126, height: 4, rx: 2, fill: '#f6f9fc' }, g); }
    ctx.glassRect(138, 117, 106, 19, [[164, 117, 164, 136], [190, 117, 190, 136], [216, 117, 216, 136]]);
    ctx.glassRect(106, 148, 62, 22, [[137, 148, 137, 170]]);
    // деревянная реечная вставка
    wall(ctx, g, 176, 146, 36, 24, c.wood, { dir: 'v', step: 3 });
    el('rect', { x: 190, y: 150, width: 12, height: 20, fill: '#2a2d31' }, g);
    // колонна
    el('rect', { x: 248, y: 112, width: 3, height: 58, fill: '#2a2d31' }, g);
    // терраса + водная гладь
    el('rect', { x: 92, y: 170, width: 160, height: 5, fill: ctx.lg([[0, '#d6d1c6'], [1, '#a29d92']]) }, g);
    return { smoke: null, lights: [[128, 106, 252, 106]] };
  };

  // ---------- сцена ----------
  function create(house) {
    const id = ++uid;
    const m = MOODS[house.mood] || MOODS.day;
    const rand = rng(house.id * 1013 + 7);
    const has = a => (house.amenities || []).indexOf(a) !== -1;
    const wood = house.wood || '#a8744a';
    const c = { wood, roof: house.roof || '#3b3f46' };

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 320 200');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    svg.setAttribute('class', 'art');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const ctx = makeCtx(svg, id, m, rand, has);
    const root = el('g', {}, svg);

    // небо
    el('rect', { width: 320, height: 200, fill: ctx.lg([[0, m.sky[0]], [0.55, m.sky[1]], [1, m.sky[2]]]) }, root);

    // солнце, луна, звёзды
    if (m.moon) {
      for (let i = 0; i < 46; i++) el('circle', { cx: (rand() * 320).toFixed(1), cy: (rand() * 110).toFixed(1), r: (0.4 + rand() * 0.9).toFixed(2), fill: '#fff', opacity: (0.35 + rand() * 0.65).toFixed(2) }, root);
      el('circle', { cx: m.moon.x, cy: m.moon.y, r: 34, fill: ctx.rg([[0, '#cfe0ff', 0.5], [1, '#cfe0ff', 0]]) }, root);
      el('circle', { cx: m.moon.x, cy: m.moon.y, r: 10.5, fill: '#f6f2dc' }, root);
      [[-3, -2, 2.2], [3, 3, 1.8], [2, -4, 1.3]].forEach(k => el('circle', { cx: m.moon.x + k[0], cy: m.moon.y + k[1], r: k[2], fill: '#c9c5ad', opacity: 0.45 }, root));
    } else if (m.sun) {
      el('circle', { cx: m.sun.x, cy: m.sun.y, r: 80, fill: ctx.rg([[0, m.sun.c, m.sun.glow], [1, m.sun.c, 0]]) }, root);
      el('circle', { cx: m.sun.x, cy: m.sun.y, r: 11, fill: m.sun.c }, root);
    }

    // облака — мягкие, размытые
    if (m.clouds) {
      const cg = el('g', { filter: ctx.blur(3), opacity: house.mood === 'dusk' ? 0.55 : 0.8 }, root);
      [[70, 36, 1], [188, 26, 0.85], [140, 62, 0.65], [276, 70, 0.7]].forEach(([x, y, k]) => {
        el('ellipse', { cx: x, cy: y, rx: 32 * k, ry: 7 * k, fill: m.clouds }, cg);
        el('ellipse', { cx: x + 14 * k, cy: y - 6 * k, rx: 18 * k, ry: 7 * k, fill: m.clouds }, cg);
      });
    }

    // горы в дымке
    const ridge = (base, amp, seed, col, k) => {
      let d = `M0 ${base}`;
      for (let x = 0; x <= 336; x += 14) {
        const y = base - amp * (0.55 * Math.abs(Math.sin(x / 47 + seed)) + 0.45 * Math.abs(Math.sin(x / 19 + seed * 2.3))) - rand() * 2;
        d += `L${x} ${y.toFixed(1)}`;
      }
      d += 'L320 200L0 200Z';
      el('path', { d, fill: ctx.lg([[0, col[0]], [1, col[1]]]) }, root);
    };
    const tall = has('views') ? 1.25 : 1;
    ridge(124, 52 * tall, 1.4 + house.id, [m.mount[0], m.mount[1]]);
    el('rect', { y: 98, width: 320, height: 40, fill: ctx.lg([[0, m.fog, 0], [1, m.fog, 0.85]]) }, root);
    ridge(134, 34 * tall, 3.1 + house.id, [shade(m.mount[1], -0.1), shade(m.mount[1], -0.25)]);
    el('rect', { y: 108, width: 320, height: 40, fill: ctx.lg([[0, m.fog, 0], [1, m.fog, 0.55]]) }, root);

    // дальний лес
    const far = el('g', { filter: ctx.blur(1), opacity: 0.9 }, root);
    for (let x = -6; x < 330; x += 8 + rand() * 4) {
      if (m.leaves && rand() < 0.5) broadleaf(ctx, far, x, 142, 4 + rand() * 2, ['#d9772b', '#c4501f', '#e3a33a'][Math.floor(rand() * 3)]);
      else conifer(ctx, far, x, 142, 18 + rand() * 10, [shade(m.tree[0], 0.2), shade(m.tree[1], 0.1)], m.snow);
    }
    el('rect', { y: 120, width: 320, height: 28, fill: ctx.lg([[0, m.fog, 0], [1, m.fog, 0.35]]) }, root);

    // земля: два плана
    el('path', { d: 'M0 144Q80 132 170 140T320 136V200H0Z', fill: ctx.lg([[0, shade(m.grass[0], 0.1)], [1, m.grass[1]]]) }, root);
    el('path', { d: 'M0 160Q90 149 180 157T320 152V200H0Z', fill: ctx.lg([[0, m.grass[0]], [1, shade(m.grass[1], -0.12)]]) }, root);
    // пятна света на траве
    const patches = el('g', { filter: ctx.blur(6), opacity: m.snow ? 0.35 : 0.25 }, root);
    for (let i = 0; i < 5; i++) el('ellipse', { cx: 20 + rand() * 280, cy: 168 + rand() * 24, rx: 30 + rand() * 30, ry: 6 + rand() * 5, fill: m.snow ? '#aac7e6' : shade(m.grass[0], 0.3) }, patches);

    // озеро
    if (has('water')) {
      const lk = el('g', {}, root);
      el('path', { d: 'M0 164Q54 156 112 170L96 200H0Z', fill: ctx.lg([[0, m.lake[0]], [1, m.lake[1]]]) }, lk);
      el('path', { d: 'M0 164Q54 156 112 170', stroke: m.snow ? '#ffffff' : shade(m.grass[0], 0.2), 'stroke-width': 1.6, fill: 'none', opacity: 0.8 }, lk);
      [[10, 176, 38], [34, 184, 46], [18, 192, 30]].forEach(l => el('line', { x1: l[0], x2: l[0] + l[2], y1: l[1], y2: l[1], stroke: '#fff', 'stroke-width': 1, opacity: 0.45, 'stroke-linecap': 'round' }, lk));
    }

    // деревья за домом
    const back = el('g', {}, root);
    const pick = () => [shade(m.tree[0], 0.05), m.tree[1]];
    const backList = [[66, 168, 52], [84, 170, 40], [244, 168, 46], [262, 170, 38], [290, 168, 50]];
    if (has('woods')) backList.push([50, 164, 60], [276, 164, 58], [108, 156, 34], [214, 156, 34], [304, 170, 44]);
    backList.forEach(t => {
      if (m.leaves && rand() < 0.5) broadleaf(ctx, back, t[0], t[1], t[2] * 0.2, ['#d9772b', '#c4501f', '#e3a33a', '#a9a43c'][Math.floor(rand() * 4)]);
      else conifer(ctx, back, t[0] + rand() * 4, t[1], t[2] + rand() * 6, pick(), m.snow);
    });

    // дорожка и тень дома
    el('path', { d: 'M126 200Q150 184 154 172L170 172Q176 186 206 200Z', fill: m.snow ? '#e4ebf3' : '#d9c9a6', opacity: 0.9 }, root);
    el('ellipse', { cx: 160, cy: 174, rx: 84, ry: 7, fill: '#000', opacity: 0.35, filter: ctx.blur(3) }, root);

    // дом
    const hg = el('g', {}, root);
    ctx.cur = hg;
    const info = (HOUSE[house.type] || HOUSE.log)(ctx, hg, c);

    // купель
    if (has('hottub')) {
      const tg = el('g', {}, root);
      el('ellipse', { cx: 262, cy: 180, rx: 17, ry: 5.5, fill: '#000', opacity: 0.3, filter: ctx.blur(1) }, tg);
      el('rect', { x: 246, y: 170, width: 32, height: 10, rx: 2, fill: ctx.lg([[0, shade(wood, 0.2)], [0.6, wood], [1, shade(wood, -0.35)]], 0, 0, 1, 0) }, tg);
      el('ellipse', { cx: 262, cy: 170, rx: 16, ry: 5, fill: shade(wood, 0.25) }, tg);
      el('ellipse', { cx: 262, cy: 170, rx: 13.5, ry: 3.8, fill: ctx.lg([[0, '#9fe0ee'], [1, '#4ba6c4']]) }, tg);
    }

    // деревья переднего плана
    const front = el('g', {}, root);
    const frontList = [[16, 202, 104], [46, 204, 84], [294, 202, 108], [314, 206, 88]];
    if (has('woods')) frontList.push([4, 202, 96]);
    frontList.forEach(t => {
      if (m.leaves && rand() < 0.5) broadleaf(ctx, front, t[0], t[1], t[2] * 0.19, ['#d9772b', '#c4501f', '#e3a33a'][Math.floor(rand() * 3)]);
      else conifer(ctx, front, t[0], t[1], t[2], [shade(m.tree[0], -0.05), shade(m.tree[1], -0.1)], m.snow);
    });

    // цветокоррекция сцены (закат, ночь, осень, зима)
    if (m.grade) el('rect', { width: 320, height: 200, fill: m.grade.c, opacity: m.grade.o, style: 'mix-blend-mode:multiply' }, root);

    // окна: днём отражают небо, вечером и ночью тёплые и светятся
    ctx.glass.forEach(w => {
      const sh = el('g', {}, root);
      if (m.lit) {
        const glow = el(w.tag, Object.assign({}, w.a, { fill: '#ffb347', opacity: 0.55, filter: ctx.blur(6), style: 'mix-blend-mode:screen' }), sh);
        glow.setAttribute('transform', 'translate(0,0)');
        el(w.tag, Object.assign({}, w.a, { fill: ctx.lg([[0, '#fff4cf'], [0.5, '#ffd27e'], [1, '#f4a343']]) }), sh);
        // отблеск лампы
        el(w.tag, Object.assign({}, w.a, { fill: ctx.rg([[0, '#fff', 0.7], [1, '#fff', 0]]), opacity: 0.6 }), sh);
      } else {
        el(w.tag, Object.assign({}, w.a, { fill: ctx.lg([[0, '#cfe8f8'], [0.5, '#76aad2'], [1, '#2f5d85']]) }), sh);
        el(w.tag, Object.assign({}, w.a, { fill: ctx.lg([[0, '#fff', 0.6], [0.4, '#fff', 0], [0.55, '#fff', 0.2], [1, '#fff', 0]], 0, 0, 1, 1) }), sh);
      }
      w.bars.forEach(b => el('line', { x1: b[0], y1: b[1], x2: b[2], y2: b[3], stroke: '#1d2024', 'stroke-width': 1.2, opacity: 0.85 }, sh));
      el(w.tag, Object.assign({}, w.a, { fill: 'none', stroke: '#1d2024', 'stroke-width': 1.3, opacity: 0.9 }), sh);
    });

    // гирлянда — тёплые огоньки
    if (m.lit && info && info.lights) {
      info.lights.forEach(l => {
        const lg = el('g', {}, root);
        const dx = l[2] - l[0], dy = l[3] - l[1], len = Math.hypot(dx, dy);
        const n = Math.max(4, Math.round(len / 11));
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const x = l[0] + dx * t, y = l[1] + dy * t + Math.sin(t * Math.PI) * 4;
          el('circle', { cx: x, cy: y, r: 4.5, fill: '#ffcf70', opacity: 0.6, filter: ctx.blur(1) }, lg);
          el('circle', { cx: x, cy: y, r: 1.3, fill: '#fff6d6' }, lg);
        }
      });
    }

    // подсветка воды в купели и пар
    if (has('hottub')) {
      const sg = el('g', {}, root);
      if (m.lit) el('ellipse', { cx: 262, cy: 169, rx: 20, ry: 8, fill: '#58e0ff', opacity: 0.45, filter: ctx.blur(3), style: 'mix-blend-mode:screen' }, sg);
      [[258, 163, 3], [265, 156, 4], [260, 148, 5]].forEach((s, i) => el('circle', { cx: s[0], cy: s[1], r: s[2], fill: '#fff', opacity: 0.45 - i * 0.1, filter: ctx.blur(3) }, sg));
    }

    // дым из трубы
    if (info && info.smoke && has('fireplace')) {
      const sm = el('g', { filter: ctx.blur(3) }, root);
      for (let i = 0; i < 4; i++) el('circle', { cx: info.smoke.x + 3 + i * 5, cy: info.smoke.y - 8 - i * 11, r: 4 + i * 2.2, fill: m.snow ? '#e9eef4' : '#f0f0f0', opacity: 0.6 - i * 0.14 }, sm);
    }

    // размытый передний план — эффект глубины резкости
    const bokeh = el('g', { filter: ctx.blur(6) }, root);
    el('ellipse', { cx: 6, cy: 196, rx: 46, ry: 18, fill: m.tree[1], opacity: 0.85 }, bokeh);
    el('ellipse', { cx: 316, cy: 198, rx: 50, ry: 18, fill: m.tree[1], opacity: 0.85 }, bokeh);

    // лёгкое затемнение по краям
    el('rect', { width: 320, height: 200, fill: ctx.rg([[0.55, '#000', 0], [1, '#000', 0.3]]) }, root);
    return svg;
  }

  // Фото (если указано) или рисунок
  function media(house) {
    if (house.photo) {
      const img = document.createElement('img');
      img.className = 'art';
      img.alt = '';
      img.loading = 'lazy';
      img.src = house.photo;
      img.addEventListener('error', () => img.replaceWith(create(house)));
      return img;
    }
    return create(house);
  }

  return { create, media };
})();
