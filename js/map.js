'use strict';
/* =========================================================
   Схема посёлка: масштаб, перетаскивание, пальцы (pinch),
   колесо мыши, клавиатура и объединение близких домов в кластеры.
   ========================================================= */
const MapView = (() => {
  const MAX = 4;            // максимальный масштаб
  const CLUSTER_PX = 56;    // ближе этого расстояния (в пикселях на экране) дома объединяются
  let vp, canvas;
  const pointers = new Map();
  let drag = null, pinch = null, moved = false, suppressClick = false;

  const M = () => state.map;
  function dims() { return { w: vp.clientWidth || 800, h: vp.clientHeight || 380 }; }

  // Не даём вытащить схему за пределы рамки
  function clamp() {
    const d = dims(), m = M();
    m.scale = Math.min(MAX, Math.max(1, m.scale));
    m.tx = Math.min(0, Math.max(d.w - d.w * m.scale, m.tx));
    m.ty = Math.min(0, Math.max(d.h - d.h * m.scale, m.ty));
  }

  function apply(skipMarkers) {
    clamp();
    const m = M();
    canvas.style.transform = 'translate(' + m.tx + 'px, ' + m.ty + 'px) scale(' + m.scale + ')';
    canvas.style.setProperty('--inv', String(1 / m.scale)); // маркеры не растут вместе со схемой
    UI.hideTip();
    if (!skipMarkers) UI.renderMarkers(false);
  }

  function zoomAt(factor, px, py) {
    const m = M();
    const ns = Math.min(MAX, Math.max(1, m.scale * factor));
    if (ns === m.scale) return;
    const k = ns / m.scale;
    m.tx = px - (px - m.tx) * k;
    m.ty = py - (py - m.ty) * k;
    m.scale = ns;
    apply();
  }

  function zoomCenter(factor) { const d = dims(); zoomAt(factor, d.w / 2, d.h / 2); }

  function reset() { const m = M(); m.scale = 1; m.tx = 0; m.ty = 0; apply(); }

  // Приблизить к группе домов (клик по кластеру)
  function zoomToItems(items, keepScale) {
    const d = dims(), m = M();
    const cx = items.reduce((s, i) => s + i.x, 0) / items.length / 100 * d.w;
    const cy = items.reduce((s, i) => s + i.y, 0) / items.length / 100 * d.h;
    const ns = keepScale ? m.scale : Math.min(MAX, m.scale * 2.2);
    m.tx = d.w / 2 - cx * ns;
    m.ty = d.h / 2 - cy * ns;
    m.scale = ns;
    apply();
  }

  // Группировка домов: чем больше масштаб, тем меньше кластеров
  function cluster(list) {
    const d = dims();
    const limit = CLUSTER_PX / M().scale;
    const groups = [];
    list.forEach(house => {
      const px = house.x / 100 * d.w, py = house.y / 100 * d.h;
      const g = groups.find(g => Math.hypot(g.px - px, g.py - py) < limit);
      if (g) {
        g.items.push(house);
        g.px = (g.px * (g.items.length - 1) + px) / g.items.length;
        g.py = (g.py * (g.items.length - 1) + py) / g.items.length;
      } else {
        groups.push({ items: [house], px, py });
      }
    });
    groups.forEach(g => { g.x = g.px / d.w * 100; g.y = g.py / d.h * 100; });
    return groups;
  }

  // ----- жесты -----
  function pinchDist() {
    const p = Array.from(pointers.values());
    return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  }

  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      drag = { x: e.clientX, y: e.clientY, tx: M().tx, ty: M().ty };
      moved = false;
    } else if (pointers.size === 2) {
      pinch = { d: pinchDist(), scale: M().scale };
      moved = true;
      canvas.classList.add('is-dragging');
    }
  }

  function onMove(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const m = M();
    if (pointers.size === 2 && pinch) {
      const r = vp.getBoundingClientRect(), p = Array.from(pointers.values());
      const mx = (p[0].x + p[1].x) / 2 - r.left, my = (p[0].y + p[1].y) / 2 - r.top;
      zoomAt(pinch.scale * pinchDist() / pinch.d / m.scale, mx, my);
      return;
    }
    if (drag && pointers.size === 1) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!moved) {
        if (Math.hypot(dx, dy) < 5) return;
        moved = true;
        canvas.classList.add('is-dragging');
        try { vp.setPointerCapture(e.pointerId); } catch (err) { /* не критично */ }
        UI.hideTip();
      }
      m.tx = drag.tx + dx;
      m.ty = drag.ty + dy;
      apply(true);
    }
  }

  function onUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      canvas.classList.remove('is-dragging');
      if (moved) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
      drag = null;
    } else if (pointers.size === 1) {
      const p = Array.from(pointers.values())[0];
      drag = { x: p.x, y: p.y, tx: M().tx, ty: M().ty };
    }
  }

  function onKey(e) {
    if (e.target !== vp) return;
    const m = M(), step = 50;
    const k = e.key;
    if (k === 'ArrowLeft') m.tx += step;
    else if (k === 'ArrowRight') m.tx -= step;
    else if (k === 'ArrowUp') m.ty += step;
    else if (k === 'ArrowDown') m.ty -= step;
    else if (k === '+' || k === '=') { e.preventDefault(); zoomCenter(1.4); return; }
    else if (k === '-' || k === '_') { e.preventDefault(); zoomCenter(1 / 1.4); return; }
    else if (k === '0') { e.preventDefault(); reset(); return; }
    else return;
    e.preventDefault();
    apply(true);
  }

  function init() {
    vp = $('#map-viewport');
    canvas = $('#map-canvas');

    vp.addEventListener('pointerdown', onDown);
    vp.addEventListener('pointermove', onMove);
    vp.addEventListener('pointerup', onUp);
    vp.addEventListener('pointercancel', onUp);
    vp.addEventListener('keydown', onKey);
    // После перетаскивания клик по маркеру под курсором не должен срабатывать
    vp.addEventListener('click', e => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); } }, true);
    vp.addEventListener('wheel', e => {
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    $('#map-zoom-in').addEventListener('click', () => zoomCenter(1.5));
    $('#map-zoom-out').addEventListener('click', () => zoomCenter(1 / 1.5));
    $('#map-compass').addEventListener('click', reset);
    window.addEventListener('resize', () => apply());
    apply(true);
  }

  return { init, cluster, zoomToItems, reset, zoomCenter };
})();
