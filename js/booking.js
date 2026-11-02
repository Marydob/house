'use strict';
/* =========================================================
   Бронирование: окно дома, календарь заезда/выезда, расчёт стоимости,
   проверка пересечения дат, создание, изменение и отмена брони.
   ========================================================= */
const Booking = (() => {
  const MAX_NIGHTS = 30;
  let bk = null;            // данные открытого окна
  let submitting = false;   // защита от двойного клика

  const dlg = () => $('#booking-dialog');

  // ---------- проверка чисел ----------
  function parseNights(v) {
    v = String(v).trim();
    if (v === '') return { error: 'Укажите число ночей' };
    if (!/^\d+$/.test(v)) return { error: 'Число ночей должно быть целым' };
    const n = Number(v);
    if (n < 1 || n > MAX_NIGHTS) return { error: 'Число ночей — от 1 до ' + MAX_NIGHTS };
    return { value: n };
  }
  function parseGuests(v, cap) {
    v = String(v).trim();
    if (v === '') return { error: 'Укажите число гостей' };
    if (!/^\d+$/.test(v)) return { error: 'Число гостей должно быть целым' };
    const n = Number(v);
    if (n < 1 || n > cap) return { error: 'Для этого дома — от 1 до ' + cap + ' ' + Utils.plural(cap, ['гостя', 'гостей', 'гостей']) };
    return { value: n };
  }

  // ---------- ошибки ----------
  function setError(field, msg) {
    const p = $('#' + field + '-error');
    const input = $('#' + field);
    p.textContent = msg || '';
    if (input) {
      if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    }
  }
  function setFormError(msg, kind) {
    const p = $('#form-error');
    p.textContent = msg || '';
    p.dataset.kind = msg ? (kind || '') : '';
  }
  function clearErrors() {
    setError('nights', ''); setError('b-guests', ''); setFormError('');
  }

  // ---------- даты ----------
  function checkConflict() {
    bk.conflict = !!(bk.from && bk.to && !Avail.rangeFree(bk.house, bk.from, bk.to));
    if (bk.conflict) {
      setFormError('В эти даты дом занят другим гостем. Выберите другие даты в календаре.', 'conflict');
    } else if ($('#form-error').dataset.kind === 'conflict') {
      setFormError('');
    }
  }

  function updateSummary() {
    const p = $('#dates-summary');
    if (bk.from && bk.to) {
      const n = Utils.diffDays(bk.from, bk.to);
      p.textContent = 'Заезд: ' + Utils.fmt(bk.from) + ' · выезд: ' + Utils.fmt(bk.to) + ' · ' + n + ' ' + Utils.plural(n, ['ночь', 'ночи', 'ночей']);
    } else if (bk.from) {
      p.textContent = 'Заезд: ' + Utils.fmt(bk.from) + '. Теперь выберите дату выезда.';
    } else {
      p.textContent = '';
    }
  }

  // «Ноябрь 2026 г.» — только первая буква заглавная
  function monthTitle(d) {
    const t = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function renderCalendar(focusIso) {
    const cal = $('#calendar');
    cal.replaceChildren();
    const m = bk.month, y = m.getFullYear(), mo = m.getMonth();
    const t = Utils.today();
    const curStart = new Date(t.getFullYear(), t.getMonth(), 1);
    const maxStart = new Date(t.getFullYear(), t.getMonth() + 12, 1);
    const todayIso = Utils.toISO(t);

    const prev = UI.h('button', { type: 'button', class: 'icon-btn cal-nav', dataset: { nav: '-1' }, 'aria-label': 'Предыдущий месяц' }, UI.icon('i-chevron', 'rot-left'));
    const next = UI.h('button', { type: 'button', class: 'icon-btn cal-nav', dataset: { nav: '1' }, 'aria-label': 'Следующий месяц' }, UI.icon('i-chevron', 'rot-right'));
    prev.disabled = m <= curStart;
    next.disabled = m >= maxStart;
    cal.appendChild(UI.h('div', { class: 'cal-head' }, prev,
      UI.h('span', { class: 'cal-title', 'aria-live': 'polite', text: monthTitle(m) }), next));

    const grid = UI.h('div', { class: 'cal-grid' });
    ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach(d => grid.appendChild(UI.h('span', { class: 'cal-dow', text: d })));
    const first = (new Date(y, mo, 1).getDay() + 6) % 7;
    for (let i = 0; i < first; i++) grid.appendChild(UI.h('span'));

    const days = new Date(y, mo + 1, 0).getDate();
    const pickingEnd = !!bk.from && !bk.to;
    for (let d = 1; d <= days; d++) {
      const iso = Utils.toISO(new Date(y, mo, d));
      let disabled;
      if (pickingEnd && iso > bk.from) {
        disabled = Utils.diffDays(bk.from, iso) > MAX_NIGHTS || !Avail.rangeFree(bk.house, bk.from, iso);
      } else {
        disabled = iso < todayIso || Avail.nightBusy(bk.house, iso);
      }
      const inRange = bk.from && bk.to && iso > bk.from && iso < bk.to;
      const cls = 'cal-day' + (iso === todayIso ? ' is-today' : '') + (inRange ? ' in-range' : '') +
        (iso === bk.from ? ' is-start' : '') + (iso === bk.to ? ' is-end' : '');
      const b = UI.h('button', {
        type: 'button', class: cls, dataset: { date: iso }, text: String(d),
        'aria-label': Utils.longFmt(iso) + (disabled ? ', недоступно' : ''),
        'aria-pressed': (iso === bk.from || iso === bk.to) ? 'true' : 'false'
      });
      b.disabled = disabled;
      grid.appendChild(b);
    }
    cal.appendChild(grid);
    if (focusIso) {
      const f = cal.querySelector('[data-date="' + focusIso + '"]');
      if (f) f.focus();
    }
  }

  function onCalendarClick(e) {
    const nav = e.target.closest('[data-nav]');
    if (nav && !nav.disabled) {
      bk.month = new Date(bk.month.getFullYear(), bk.month.getMonth() + Number(nav.dataset.nav), 1);
      renderCalendar();
      return;
    }
    const b = e.target.closest('.cal-day');
    if (!b || b.disabled) return;
    const iso = b.dataset.date;
    const pickingEnd = !!bk.from && !bk.to;
    if (pickingEnd && iso > bk.from) {
      bk.to = iso;
      bk.nights = Utils.diffDays(bk.from, bk.to);
      $('#nights').value = String(bk.nights);
      setError('nights', '');
    } else if (pickingEnd && iso === bk.from) {
      // повторный клик по дате заезда ничего не меняет
    } else {
      bk.from = iso;
      bk.to = null;
    }
    checkConflict();
    renderCalendar(iso);
    updateSummary();
    updatePrice();
  }

  // ---------- стоимость ----------
  function updatePrice() {
    const valid = Number.isInteger(bk.nights) && bk.nights >= 1 && bk.nights <= MAX_NIGHTS;
    const set = (id, v) => { $('#' + id).textContent = v; };
    if (!valid) {
      set('row-base-label', 'Цена × ночи'); set('row-base', '—'); set('row-fee', '—'); set('row-total', '—');
      $('#row-discount-wrap').hidden = true;
      return;
    }
    const c = Utils.calc(bk.house.price, bk.nights);
    set('row-base-label', Utils.money(bk.house.price) + ' × ' + bk.nights + ' ' + Utils.plural(bk.nights, ['ночь', 'ночи', 'ночей']));
    set('row-base', Utils.money(c.base));
    set('row-fee', Utils.money(c.fee));
    $('#row-discount-wrap').hidden = c.discount === 0;
    set('row-discount', '−' + Utils.money(c.discount));
    set('row-total', Utils.money(c.total));
    const tot = $('#row-total');
    tot.classList.remove('bump'); void tot.offsetWidth; tot.classList.add('bump');
  }

  // ---------- поля формы ----------
  function onNightsInput() {
    const r = parseNights($('#nights').value);
    if (r.error) { setError('nights', r.error); bk.nights = NaN; updatePrice(); return; }
    setError('nights', '');
    bk.nights = r.value;
    if (bk.from && bk.to) bk.to = Utils.addDays(bk.from, bk.nights);   // выезд сдвигается вслед за числом ночей
    checkConflict();
    renderCalendar();
    updateSummary();
    updatePrice();
  }

  function onGuestsInput() {
    const r = parseGuests($('#b-guests').value, bk.house.capacity);
    if (r.error) { setError('b-guests', r.error); bk.guests = NaN; return; }
    setError('b-guests', '');
    bk.guests = r.value;
  }

  function step(field, delta) {
    const input = $('#' + field);
    const cur = Number(input.value);
    const base = Number.isFinite(cur) && input.value.trim() !== '' ? cur : 1;
    const isNights = field === 'nights';
    const min = 1, max = isNights ? MAX_NIGHTS : bk.house.capacity;
    const n = base + delta;
    if (n < min || n > max) {
      setError(field, isNights ? 'Число ночей — от 1 до ' + MAX_NIGHTS
        : 'Для этого дома — от 1 до ' + max + ' ' + Utils.plural(max, ['гостя', 'гостей', 'гостей']));
      return;
    }
    input.value = String(n);
    if (isNights) onNightsInput(); else onGuestsInput();
  }

  // ---------- открыть окно ----------
  function open(houseId, editId, returnTo) {
    const house = Select.house(houseId);
    if (!house) return;
    const editing = editId ? state.bookings.find(b => b.id === editId) : null;
    const nights = editing ? editing.nights : 1;
    const guests = editing ? editing.guests : Math.min(Math.max(1, state.filters.guests), house.capacity);
    const from = editing ? editing.from : Avail.firstFree(house, nights);
    const to = editing ? editing.to : Utils.addDays(from, nights);
    const f = Utils.fromISO(from);
    bk = { house, editing, from, to, nights, guests, conflict: false, month: new Date(f.getFullYear(), f.getMonth(), 1) };

    $('#booking-title').textContent = editing ? 'Изменить бронь: ' + house.name : house.name;
    $('#booking-location').textContent = house.place;
    $('#booking-desc').textContent = house.desc;
    $('#booking-capacity').textContent = house.capacity + ' ' + Utils.plural(house.capacity, ['гость', 'гостя', 'гостей']);
    $('#booking-price').textContent = Utils.money(house.price);
    $('#booking-photo').replaceChildren(Art.media(house));
    $('#booking-amenities').replaceChildren(...house.amenities.map(a =>
      UI.h('li', {}, UI.icon(AMENITIES[a].icon), AMENITIES[a].label)));
    $('#nights').value = String(nights);
    $('#b-guests').value = String(guests);
    $('#b-guests').max = String(house.capacity);
    $('#confirm-booking').textContent = editing ? 'Сохранить изменения' : 'Подтвердить бронь';
    clearErrors();
    checkConflict();
    renderCalendar();
    updateSummary();
    updatePrice();
    UI.openDialog(dlg(), returnTo);
  }

  // ---------- отправка формы ----------
  function submit(e) {
    e.preventDefault();
    if (submitting || !bk) return;
    submitting = true;
    const btn = $('#confirm-booking');
    btn.disabled = true;
    try { doSubmit(); } finally { submitting = false; btn.disabled = false; }
  }

  function doSubmit() {
    clearErrors();
    let bad = null;
    const n = parseNights($('#nights').value);
    if (n.error) { setError('nights', n.error); bad = bad || '#nights'; }
    const g = parseGuests($('#b-guests').value, bk.house.capacity);
    if (g.error) { setError('b-guests', g.error); bad = bad || '#b-guests'; }
    if (bad) { $(bad).focus(); return; }

    if (!bk.from || !bk.to) { setFormError('Выберите даты заезда и выезда в календаре.'); return; }
    bk.nights = n.value; bk.guests = g.value;
    if (Utils.diffDays(bk.from, bk.to) !== bk.nights) bk.to = Utils.addDays(bk.from, bk.nights);
    if (!Avail.rangeFree(bk.house, bk.from, bk.to)) {
      checkConflict(); renderCalendar(); updateSummary();
      return;
    }
    if (!bk.editing) {
      if (bk.house.occupied || Select.bookingFor(bk.house.id)) { setFormError('Этот дом уже занят.'); return; }
    }

    const c = Utils.calc(bk.house.price, bk.nights);
    if (bk.editing) {
      Object.assign(bk.editing, { from: bk.from, to: bk.to, nights: bk.nights, guests: bk.guests, price: bk.house.price, base: c.base, fee: c.fee, discount: c.discount, total: c.total });
      persist();
      state.lastClose = Date.now();
      dlg().close();
      UI.render();
      UI.toast('Даты брони изменены: ' + Utils.fmt(bk.from) + ' — ' + Utils.fmt(bk.to), 'i-check');
      return;
    }
    state.seq += 1;
    const booking = {
      id: 'DC-' + state.seq, houseId: bk.house.id, houseName: bk.house.name,
      from: bk.from, to: bk.to, nights: bk.nights, guests: bk.guests, price: bk.house.price,
      base: c.base, fee: c.fee, discount: c.discount, total: c.total, createdAt: new Date().toISOString()
    };
    state.bookings.push(booking);
    state.selectedId = null;
    persist();
    state.lastClose = Date.now();
    dlg().close();
    UI.render();
    UI.toast('Бронь ' + booking.id + ' оформлена: ' + bk.house.name + ', ' + Utils.money(c.total), 'i-check');
  }

  // ---------- изменить и отменить ----------
  function edit(id) {
    const b = state.bookings.find(x => x.id === id);
    if (!b) return;
    open(b.houseId, id, () => $('#my-bookings-btn'));
  }

  async function cancel(id) {
    const b = state.bookings.find(x => x.id === id);
    if (!b) return;
    const ok = await UI.confirm({
      title: 'Отменить бронь?',
      text: b.houseName + ', ' + Utils.fmt(b.from) + ' — ' + Utils.fmt(b.to) + '. Дом снова станет свободным.',
      yes: 'Да, отменить', no: 'Нет, оставить'
    });
    if (!ok) return;
    state.bookings = state.bookings.filter(x => x.id !== id);
    persist();
    UI.render();
    UI.toast('Бронь ' + id + ' отменена, дом свободен', 'i-check');
  }

  function init() {
    $('#booking-form').addEventListener('submit', submit);
    $('#calendar').addEventListener('click', onCalendarClick);
    $('#nights').addEventListener('input', onNightsInput);
    $('#b-guests').addEventListener('input', onGuestsInput);
    $('#nights-minus').addEventListener('click', () => step('nights', -1));
    $('#nights-plus').addEventListener('click', () => step('nights', 1));
    $('#b-guests-minus').addEventListener('click', () => step('b-guests', -1));
    $('#b-guests-plus').addEventListener('click', () => step('b-guests', 1));
  }

  return { init, open, edit, cancel };
})();
