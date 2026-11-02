'use strict';
/* =========================================================
   Запуск сайта: подключение всех кнопок, фильтров и окон.
   ========================================================= */

// Второй клик двойного щелчка по кнопке окна попадает в страницу под ним: такие клики мышью игнорируем.
// Клики с клавиатуры (detail === 0) не затрагиваются.
function justClosed(e) { return e.detail > 0 && Date.now() - state.lastClose < 400; }

// ---------- открыть дом ----------
function openHouse(id, source) {
  const house = Select.house(id);
  if (!house) return;
  const st = Select.status(house);
  if (st === 'occupied') {
    UI.toast('Этот дом уже занят. Выберите другой.', 'i-lock');
    return;
  }
  if (st === 'mine') {
    UI.toast('Это ваша бронь. Управлять ей можно в разделе «Мои брони».', 'i-check');
    UI.openBookings();
    return;
  }
  state.selectedId = house.id;
  UI.render();
  // маркер и карточка пересоздаются, поэтому фокус возвращаем по id
  const back = () => document.querySelector(source === 'marker'
    ? '.marker[data-id="' + id + '"]' : '.card[data-id="' + id + '"] .card-title-btn');
  Booking.open(house.id, null, back);
}

// ---------- фильтры ----------
function resetFilters() {
  state.filters = defaultFilters();
  state.selectedId = null;
  $('#price-from').value = '';
  $('#price-to').value = '';
  $('#search').value = '';
  setPriceError('');
  UI.render();
}

function setPriceError(msg) {
  $('#price-error').textContent = msg;
  ['#price-from', '#price-to'].forEach(s => {
    if (msg) $(s).setAttribute('aria-invalid', 'true'); else $(s).removeAttribute('aria-invalid');
  });
}

function readPrice() {
  const a = $('#price-from').value.trim(), b = $('#price-to').value.trim();
  const pa = a === '' ? null : Number(a), pb = b === '' ? null : Number(b);
  const bad = v => v !== null && (!Number.isFinite(v) || v < 0);
  if (bad(pa) || bad(pb)) { setPriceError('Цена — неотрицательное число'); return; }
  if (pa !== null && pb !== null && pa > pb) { setPriceError('«От» не может быть больше «До»'); return; }
  setPriceError('');
  state.filters.priceFrom = pa;
  state.filters.priceTo = pb;
  UI.render();
}

function debounce(fn, ms) {
  let t;
  return function () { clearTimeout(t); t = setTimeout(fn, ms); };
}

// ---------- панель фильтров на телефоне ----------
function drawerOpen() { return $('#filters').classList.contains('is-open'); }
function openDrawer() {
  $('#filters').classList.add('is-open');
  $('#filters-backdrop').hidden = false;
  $('#filters-toggle').setAttribute('aria-expanded', 'true');
  $('#filters-close').focus();
}
function closeDrawer(returnFocus) {
  if (!drawerOpen()) return;
  $('#filters').classList.remove('is-open');
  $('#filters-backdrop').hidden = true;
  $('#filters-toggle').setAttribute('aria-expanded', 'false');
  if (returnFocus) $('#filters-toggle').focus();
}

// ---------- тема ----------
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  $('#theme-toggle').setAttribute('aria-pressed', state.theme === 'dark' ? 'true' : 'false');
}

// ---------- запуск ----------
function init() {
  hydrate();
  applyTheme();

  // выпадающий список типов и чипы удобств строятся из data.js
  const typeSel = $('#type');
  Object.keys(TYPES).forEach(k => typeSel.appendChild(UI.h('option', { value: k, text: TYPES[k] })));
  $('#amenity-chips').replaceChildren(...Object.keys(AMENITIES).map(k =>
    UI.h('button', { type: 'button', class: 'chip', dataset: { amenity: k }, 'aria-pressed': 'false' },
      UI.icon(AMENITIES[k].icon), AMENITIES[k].label)));

  MapView.init();
  Booking.init();

  // --- фильтры ---
  $('#amenity-chips').addEventListener('click', e => {
    const c = e.target.closest('.chip');
    if (!c) return;
    const a = state.filters.amenities, k = c.dataset.amenity, i = a.indexOf(k);
    if (i === -1) a.push(k); else a.splice(i, 1);
    UI.render();
  });
  typeSel.addEventListener('change', () => { state.filters.type = typeSel.value; UI.render(); });
  $('#price-from').addEventListener('input', debounce(readPrice, 200));
  $('#price-to').addEventListener('input', debounce(readPrice, 200));
  $('#guests-minus').addEventListener('click', () => { state.filters.guests = Math.max(1, state.filters.guests - 1); UI.render(); });
  $('#guests-plus').addEventListener('click', () => { state.filters.guests = Math.min(12, state.filters.guests + 1); UI.render(); });
  $('#only-fav').addEventListener('click', () => { state.filters.onlyFav = !state.filters.onlyFav; UI.render(); });
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; UI.render(); });
  $('#reset-filters').addEventListener('click', resetFilters);
  $('#empty-reset').addEventListener('click', resetFilters);
  $('#apply-filters').addEventListener('click', () => {
    readPrice();
    closeDrawer(true);
    UI.render();
    $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // --- поиск ---
  const doSearch = debounce(() => { state.filters.search = $('#search').value; UI.render(); }, 150);
  $('#search').addEventListener('input', doSearch);
  document.querySelector('.search').addEventListener('submit', e => e.preventDefault());

  // --- панель фильтров (телефон) ---
  $('#filters-toggle').addEventListener('click', () => { if (drawerOpen()) closeDrawer(true); else openDrawer(); });
  $('#filters-close').addEventListener('click', () => closeDrawer(true));
  $('#filters-backdrop').addEventListener('click', () => closeDrawer(true));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawerOpen() && !document.querySelector('dialog[open]')) closeDrawer(true);
  });

  // --- маркеры на схеме ---
  const markers = $('#markers');
  markers.addEventListener('click', e => {
    if (justClosed(e)) return;
    const m = e.target.closest('.marker');
    if (m) { openHouse(Number(m.dataset.id), 'marker'); return; }
    const c = e.target.closest('.cluster');
    if (c) {
      const items = c.dataset.ids.split(',').map(Select.house);
      MapView.zoomToItems(items, false);
    }
  });
  markers.addEventListener('mouseover', e => { const m = e.target.closest('.marker'); if (m) UI.showTip(m); });
  markers.addEventListener('mouseout', e => { if (e.target.closest('.marker')) UI.hideTip(); });
  markers.addEventListener('focusin', e => { const m = e.target.closest('.marker'); if (m) UI.showTip(m); });
  markers.addEventListener('focusout', () => UI.hideTip());

  // --- карточки ---
  const cards = $('#cards');
  cards.addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (!card || justClosed(e)) return;
    const id = Number(card.dataset.id);
    if (e.target.closest('.fav')) {
      const i = state.favorites.indexOf(id);
      if (i === -1) state.favorites.push(id); else state.favorites.splice(i, 1);
      persist();
      UI.render();
      const f = document.querySelector('.card[data-id="' + id + '"] .fav');
      if (f) f.focus();
      return;
    }
    if (e.target.closest('.card-title-btn')) {
      const house = Select.house(id);
      if (house && Select.status(house) === 'free') MapView.zoomToItems([house], true);
      openHouse(id, 'card');
    }
  });
  // наведение на карточку подсвечивает маркер на схеме
  const hover = (e, on) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const m = document.querySelector('.marker[data-id="' + card.dataset.id + '"]');
    if (m) m.classList.toggle('is-hover', on);
    card.classList.toggle('is-hover', on);
  };
  cards.addEventListener('mouseover', e => hover(e, true));
  cards.addEventListener('mouseout', e => hover(e, false));

  // --- мои брони ---
  $('#my-bookings-btn').addEventListener('click', () => UI.openBookings());
  $('#bookings-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    const li = e.target.closest('.booking-item');
    if (!btn || !li) return;
    const id = li.dataset.id;
    if (btn.dataset.action === 'cancel') Booking.cancel(id);
    else if (btn.dataset.action === 'edit') { $('#bookings-dialog').close(); Booking.edit(id); }
  });

  // --- окна: закрытие, клик по фону, возврат фокуса ---
  $$('dialog').forEach(d => {
    d.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) { d.close(); return; }
      if (e.target === d) {
        const r = d.getBoundingClientRect();
        const out = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
        if (out) d.close();
      }
    });
    d.addEventListener('close', () => { state.lastClose = Date.now(); });
    if (d.id !== 'confirm-dialog') d.addEventListener('close', () => UI.restoreFocus(d));
  });

  // --- информационные ссылки ---
  $$('[data-info]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    UI.openInfo(a.dataset.info, () => a);
  }));
  document.querySelector('.logo').addEventListener('click', e => {
    e.preventDefault();
    resetFilters();
    MapView.reset();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // --- тема ---
  $('#theme-toggle').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    persist();
  });

  UI.render();
}

init();
