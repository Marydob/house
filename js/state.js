'use strict';
/* =========================================================
   Состояние приложения, выбор домов и вспомогательные функции.
   Один источник правды: объект state. После изменений вызывается UI.render().
   ========================================================= */

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

const NF = new Intl.NumberFormat('ru-RU');

const Utils = {
  money(n) { return NF.format(Math.round(n)) + ' ₽'; },
  plural(n, forms) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  },
  pad(n) { return String(n).padStart(2, '0'); },
  toISO(d) { return d.getFullYear() + '-' + Utils.pad(d.getMonth() + 1) + '-' + Utils.pad(d.getDate()); },
  fromISO(s) { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); },
  today() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); },
  addDays(iso, n) { const d = Utils.fromISO(iso); d.setDate(d.getDate() + n); return Utils.toISO(d); },
  diffDays(a, b) { return Math.round((Utils.fromISO(b) - Utils.fromISO(a)) / 86400000); },
  fmt(iso, withYear) {
    const o = { day: 'numeric', month: 'short' };
    if (withYear) o.year = 'numeric';
    return Utils.fromISO(iso).toLocaleDateString('ru-RU', o);
  },
  longFmt(iso) {
    return Utils.fromISO(iso).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  },
  // Стоимость: цена × ночи + сервисный сбор 5% − скидка 10% от 7 ночей
  calc(price, nights) {
    const base = price * nights;
    const fee = Math.round(base * 0.05);
    const discount = nights >= 7 ? Math.round(base * 0.10) : 0;
    return { base, fee, discount, total: base + fee - discount };
  },
  norm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е').trim(); }
};

// Доступность по датам: занятые ночи других гостей (моки из data.js).
// Бронь [from, to) занимает ночи from ... to-1, поэтому день выезда может совпадать с началом чужой брони.
const Avail = {
  ranges(house) {
    const t = Utils.toISO(Utils.today());
    return (house.busy || []).map(r => ({ from: Utils.addDays(t, r[0]), to: Utils.addDays(t, r[0] + r[1]) }));
  },
  nightBusy(house, iso) {
    return Avail.ranges(house).some(r => iso >= r.from && iso < r.to);
  },
  rangeFree(house, from, to) {
    return !Avail.ranges(house).some(r => from < r.to && r.from < to);
  },
  firstFree(house, nights) {
    let d = Utils.addDays(Utils.toISO(Utils.today()), 1);
    for (let i = 0; i < 365; i++) {
      if (Avail.rangeFree(house, d, Utils.addDays(d, nights))) return d;
      d = Utils.addDays(d, 1);
    }
    return d;
  }
};

function defaultFilters() {
  return { priceFrom: null, priceTo: null, type: '', amenities: [], guests: 1, onlyFav: false, search: '' };
}

const state = {
  filters: defaultFilters(),
  sort: 'newest',
  selectedId: null,
  favorites: [],
  bookings: [],
  seq: 1000,
  theme: 'light',
  lastClose: 0,
  map: { scale: 1, tx: 0, ty: 0 }
};

function validBooking(b) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  return !!b && typeof b.id === 'string' && HOUSES.some(h => h.id === b.houseId) &&
    re.test(b.from) && re.test(b.to) && Number.isInteger(b.nights) && b.nights >= 1 &&
    Number.isInteger(b.guests) && Number.isFinite(b.total);
}

function hydrate() {
  const d = Store.load();
  if (Array.isArray(d.bookings)) {
    const seen = {};
    state.bookings = d.bookings.filter(b => {
      if (!validBooking(b) || seen[b.houseId]) return false;
      seen[b.houseId] = true;
      return true;
    });
  }
  if (Array.isArray(d.favorites)) state.favorites = d.favorites.filter(id => HOUSES.some(h => h.id === id));
  if (Number.isFinite(d.seq)) state.seq = Math.max(1000, d.seq);
  if (d.theme === 'dark' || d.theme === 'light') state.theme = d.theme;
}

function persist() {
  Store.save({ bookings: state.bookings, favorites: state.favorites, seq: state.seq, theme: state.theme });
}

// Выборки
const Select = {
  house(id) { return HOUSES.find(h => h.id === Number(id)) || null; },
  bookingFor(houseId) { return state.bookings.find(b => b.houseId === houseId) || null; },

  // free | selected | occupied | mine
  status(house) {
    if (Select.bookingFor(house.id)) return 'mine';
    if (house.occupied) return 'occupied';
    if (state.selectedId === house.id) return 'selected';
    return 'free';
  },

  // Дома после фильтров и сортировки: и схема, и список берут результат отсюда
  visible() {
    const f = state.filters;
    const q = Utils.norm(f.search);
    const list = HOUSES.filter(h => {
      if (f.priceFrom !== null && h.price < f.priceFrom) return false;
      if (f.priceTo !== null && h.price > f.priceTo) return false;
      if (f.type && h.type !== f.type) return false;
      if (f.amenities.length && !f.amenities.every(a => h.amenities.indexOf(a) !== -1)) return false;
      if (h.capacity < f.guests) return false;
      if (f.onlyFav && state.favorites.indexOf(h.id) === -1) return false;
      if (q) {
        const hay = Utils.norm(h.name + ' ' + h.place + ' ' + TYPES[h.type]);
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    const by = {
      newest: (a, b) => b.added - a.added,
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      capacity: (a, b) => b.capacity - a.capacity || a.price - b.price
    }[state.sort] || ((a, b) => b.added - a.added);
    return list.sort(by);
  }
};
