'use strict';
/* =========================================================
   Отрисовка интерфейса: маркеры на схеме, карточки, «Мои брони»,
   уведомления, подтверждение, подсказки. Всё строится через DOM
   (textContent), без innerHTML с пользовательскими данными.
   ========================================================= */
const UI = (() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let lastKey = '';

  // h('div', {class:'x', text:'...'}, дети...) — короткая запись для создания элементов
  function h(tag, props) {
    const e = document.createElement(tag);
    props = props || {};
    for (const k in props) {
      const v = props[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'dataset') Object.assign(e.dataset, v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) {
      [].concat(arguments[i]).forEach(c => {
        if (c === null || c === undefined || c === false) return;
        e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
      });
    }
    return e;
  }

  function icon(name, cls) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'i' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#' + name);
    svg.appendChild(use);
    return svg;
  }

  // Подсветка найденного текста (поиск)
  function hl(text) {
    const q = Utils.norm(state.filters.search);
    if (!q) return [text];
    const i = text.toLowerCase().replace(/ё/g, 'е').indexOf(q);
    if (i < 0) return [text];
    return [text.slice(0, i), h('mark', { class: 'hl', text: text.slice(i, i + q.length) }), text.slice(i + q.length)];
  }

  const STATUS_TEXT = { free: '', selected: 'Выбран', occupied: 'Занято', mine: 'Ваша бронь' };
  const STATUS_WORD = { free: 'свободен', selected: 'выбран', occupied: 'занят', mine: 'ваша бронь' };

  // ---------- маркеры на схеме ----------
  function markerEl(house) {
    const st = Select.status(house);
    return h('button', {
      type: 'button',
      class: 'marker is-' + st,
      style: '--x:' + house.x + ';--y:' + house.y,
      dataset: { id: house.id },
      'aria-pressed': st === 'selected' ? 'true' : 'false',
      'aria-disabled': st === 'occupied' ? 'true' : null,
      'aria-label': house.name + ', ' + Utils.money(house.price) + ' за ночь, до ' + house.capacity + ' гостей, ' + STATUS_WORD[st]
    },
      h('span', { class: 'marker-pic' },
        h('span', { class: 'marker-photo' }, Art.media(house)),
        h('span', { class: 'marker-badge' }, icon('i-check', 'ico-check'), icon('i-lock', 'ico-lock'))),
      h('span', { class: 'marker-label' }, hl(house.name)),
      h('span', { class: 'marker-status', text: STATUS_TEXT[st] }));
  }

  function clusterEl(group) {
    const n = group.items.length;
    return h('button', {
      type: 'button',
      class: 'cluster',
      style: '--x:' + group.x.toFixed(2) + ';--y:' + group.y.toFixed(2),
      dataset: { ids: group.items.map(i => i.id).join(',') },
      'aria-label': n + ' ' + Utils.plural(n, ['дом', 'дома', 'домов']) + ' рядом. Нажмите, чтобы приблизить'
    }, h('span', { text: String(n) }));
  }

  function renderMarkers(force) {
    const list = Select.visible();
    const groups = MapView.cluster(list);
    const key = groups.map(g => g.items.map(i => i.id + Select.status(i)).join(',')).join('|') + '#' + state.filters.search;
    if (!force && key === lastKey) return;
    lastKey = key;
    hideTip();
    $('#markers').replaceChildren(...groups.map(g => g.items.length === 1 ? markerEl(g.items[0]) : clusterEl(g)));
  }

  // ---------- карточки ----------
  function cardEl(house) {
    const st = Select.status(house);
    const fav = state.favorites.indexOf(house.id) !== -1;
    const statusKids = st === 'selected' ? [icon('i-check'), 'Выбран']
      : st === 'occupied' ? [icon('i-lock'), 'Занято']
      : st === 'mine' ? [icon('i-check'), 'Ваша бронь'] : [];
    return h('li', { class: 'card is-' + st, dataset: { id: house.id } },
      h('div', { class: 'card-img' }, Art.media(house)),
      h('span', { class: 'card-status' }, statusKids),
      h('button', {
        type: 'button', class: 'fav', 'aria-pressed': fav ? 'true' : 'false',
        'aria-label': (fav ? 'Убрать из избранного: ' : 'Добавить в избранное: ') + house.name
      }, icon('i-heart')),
      h('h3', { class: 'card-title' },
        h('button', {
          type: 'button', class: 'card-title-btn',
          'aria-disabled': st === 'occupied' ? 'true' : null,
          'aria-label': house.name + ', ' + STATUS_WORD[st] + '. ' + (st === 'mine' ? 'Открыть мои брони' : st === 'occupied' ? 'Недоступно' : 'Открыть бронирование')
        }, hl(house.name))),
      h('p', { class: 'card-loc' }, icon('i-pin'), h('span', {}, hl(house.place))),
      h('p', { class: 'card-meta', text: TYPES[house.type] + ' · до ' + house.capacity + ' ' + Utils.plural(house.capacity, ['гостя', 'гостей', 'гостей']) }),
      h('p', { class: 'card-price' }, Utils.money(house.price) + ' ', h('span', { text: '/ночь' })));
  }

  function renderCards() {
    const list = Select.visible();
    const ul = $('#cards');
    ul.replaceChildren(...list.map(cardEl));
    ul.hidden = list.length === 0;
    $('#empty-state').hidden = list.length > 0;
  }

  function renderCount() {
    const n = Select.visible().length;
    $('#results-number').textContent = String(n);
    $('#results-word').textContent = Utils.plural(n, ['результат', 'результата', 'результатов']);
  }

  function renderBadge() {
    const n = state.bookings.length;
    const b = $('#bookings-count');
    b.textContent = String(n);
    b.hidden = n === 0;
  }

  // Фильтры: состояние кнопок и чипов
  function syncFilters() {
    const f = state.filters;
    $$('#amenity-chips .chip').forEach(c => c.setAttribute('aria-pressed', f.amenities.indexOf(c.dataset.amenity) !== -1 ? 'true' : 'false'));
    $('#guests-value').textContent = String(f.guests);
    $('#only-fav').setAttribute('aria-pressed', f.onlyFav ? 'true' : 'false');
    $('#sort').value = state.sort;
    $('#type').value = f.type;
  }

  // ---------- «Мои брони» ----------
  function bookingEl(b) {
    const house = Select.house(b.houseId);
    return h('li', { class: 'booking-item', dataset: { id: b.id } },
      h('div', { class: 'booking-item-main' },
        h('p', { class: 'booking-item-title', text: b.houseName }),
        h('p', { class: 'muted small', text: 'Бронь № ' + b.id + ' · ' + b.nights + ' ' + Utils.plural(b.nights, ['ночь', 'ночи', 'ночей']) + ' · ' + b.guests + ' ' + Utils.plural(b.guests, ['гость', 'гостя', 'гостей']) }),
        h('p', { class: 'muted small', text: Utils.fmt(b.from) + ' — ' + Utils.fmt(b.to, true) }),
        h('p', { class: 'muted small', text: (house ? house.place + ' · ' : '') + 'создана ' + new Date(b.createdAt).toLocaleDateString('ru-RU') })),
      h('div', { class: 'booking-item-side' },
        h('p', { class: 'booking-item-sum', text: Utils.money(b.total) }),
        h('div', { class: 'booking-item-actions' },
          h('button', { type: 'button', class: 'btn btn-ghost btn-sm', dataset: { action: 'edit' }, 'aria-label': 'Изменить даты брони ' + b.id }, 'Изменить даты'),
          h('button', { type: 'button', class: 'btn btn-danger-outline btn-sm', dataset: { action: 'cancel' }, 'aria-label': 'Отменить бронь ' + b.id }, 'Отменить'))));
  }

  function renderBookingsList() {
    const list = state.bookings.slice().sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    $('#bookings-list').replaceChildren(...list.map(bookingEl));
    $('#bookings-empty').hidden = list.length > 0;
  }

  function render() {
    syncFilters();
    renderMarkers(true);
    renderCards();
    renderCount();
    renderBadge();
    renderBookingsList();
  }

  // ---------- подсказка над маркером ----------
  function showTip(btn) {
    const house = Select.house(btn.dataset.id);
    if (!house) return;
    const tip = $('#tooltip'), map = $('#map');
    tip.replaceChildren(h('strong', { text: house.name }), h('br'),
      document.createTextNode(Utils.money(house.price) + ' / ночь · до ' + house.capacity + ' гостей'));
    tip.hidden = false;
    const mr = map.getBoundingClientRect();
    const pic = btn.querySelector('.marker-pic').getBoundingClientRect();
    const cx = Math.min(mr.width - 110, Math.max(110, pic.left + pic.width / 2 - mr.left));
    tip.style.left = cx + 'px';
    if (pic.top - mr.top < 70) {
      tip.style.top = (pic.bottom - mr.top + 8) + 'px';
      tip.style.transform = 'translate(-50%, 0)';
    } else {
      tip.style.top = (pic.top - mr.top - 8) + 'px';
      tip.style.transform = 'translate(-50%, -100%)';
    }
  }
  function hideTip() { const t = $('#tooltip'); if (t) t.hidden = true; }

  // ---------- уведомления ----------
  function toast(message, iconName) {
    const box = $('#toasts');
    const t = h('div', { class: 'toast', role: 'status' }, iconName ? icon(iconName) : null, h('span', { text: message }));
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => t.remove(), 4200);
  }

  // ---------- диалоги ----------
  function openDialog(dlg, returnTo) {
    dlg._returnTo = returnTo || null;
    dlg._prev = document.activeElement;
    if (!dlg.open) dlg.showModal();
  }

  function restoreFocus(dlg) {
    let t = dlg._returnTo ? dlg._returnTo() : dlg._prev;
    if (!t || !t.isConnected) t = dlg._prev;
    if (!t || !t.isConnected) {
      const open = $$('dialog[open]');
      t = open.length ? $('.dialog-close', open[open.length - 1]) : $('#results');
    }
    if (t && t.focus) t.focus();
  }

  function openBookings() {
    renderBookingsList();
    openDialog($('#bookings-dialog'), () => $('#my-bookings-btn'));
  }

  // Свой confirm() — в виде окна
  function confirm(opts) {
    return new Promise(resolve => {
      const d = $('#confirm-dialog'), yes = $('#confirm-yes'), no = $('#confirm-no');
      $('#confirm-title').textContent = opts.title;
      $('#confirm-text').textContent = opts.text;
      yes.textContent = opts.yes || 'Да';
      no.textContent = opts.no || 'Нет';
      let done = false;
      const finish = v => {
        if (done) return;
        done = true;
        d.onclose = null;
        yes.onclick = no.onclick = null;
        if (d.open) d.close();
        restoreFocus(d);
        resolve(v);
      };
      yes.onclick = () => finish(true);
      no.onclick = () => finish(false);
      d.onclose = () => finish(false);
      openDialog(d, null);
      no.focus();
    });
  }

  // ---------- информационные окна ----------
  const INFO = {
    about: { title: 'О нас', build: () => [
      h('p', { text: 'DACHA CLUB — сервис, в котором можно выбрать загородный дом на схеме посёлка, посчитать стоимость и оформить бронь.' }),
      h('p', { class: 'muted', text: 'Бронирование занимает меньше минуты, оплата на сайте не нужна.' })] },
    perks: { title: 'Преимущества', build: () => [h('ul', {},
      ['Выбор дома прямо на схеме посёлка', 'Расчёт стоимости до подтверждения', 'Скидка 10% при бронировании от 7 ночей', 'Избранное и сохранённые брони в браузере']
        .map(t => h('li', {}, icon('i-check'), h('span', { text: t }))))] },
    faq: { title: 'Частые вопросы', build: () => [
      ['Нужна ли оплата?', 'Нет. Бронь подтверждается сразу, оплата на сайте не требуется.'],
      ['Где хранятся мои брони?', 'В памяти вашего браузера на этом устройстве. Если очистить данные сайта, список броней пропадёт.'],
      ['Как отменить бронь?', 'Откройте «Мои брони» и нажмите «Отменить». Дом снова станет свободным.'],
      ['Можно ли изменить даты?', 'Да, в «Моих бронях» есть кнопка «Изменить даты».']
    ].map(q => h('details', {}, h('summary', { text: q[0] }), h('p', { text: q[1] }))) },
    join: { title: 'Вступить в клуб', build: () => [
      h('p', { text: 'Регистрация не нужна: бронь оформляется без аккаунта.' }),
      h('p', { class: 'muted', text: 'Просто выберите дом на схеме и оформите бронь.' })] }
  };

  function openInfo(key, returnTo) {
    const info = INFO[key];
    if (!info) return;
    $('#info-title').textContent = info.title;
    $('#info-body').replaceChildren(...info.build());
    openDialog($('#info-dialog'), returnTo);
  }

  return { h, icon, render, renderMarkers, renderCards, renderBookingsList, renderBadge, syncFilters,
    showTip, hideTip, toast, openDialog, restoreFocus, openBookings, openInfo, confirm };
})();
