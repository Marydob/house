'use strict';
/* =========================================================
   Хранилище: localStorage с запасным вариантом в памяти
   (если браузер запрещает localStorage, сайт всё равно работает).
   ========================================================= */
const Store = (() => {
  const KEY = 'dacha-club:v1';
  let memory = {};

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return memory;
      const data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : memory;
    } catch (e) {
      return memory;
    }
  }

  function save(data) {
    memory = data;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  return { load, save };
})();
