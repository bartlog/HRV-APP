import { strings } from './strings.js';

let _lang = localStorage.getItem('hrv-lang') || 'de';

export function getLang() { return _lang; }

export function setLang(lang) {
  _lang = lang;
  localStorage.setItem('hrv-lang', lang);
}

export function t(key) {
  return strings[_lang]?.[key] ?? strings['de']?.[key] ?? key;
}

export function tf(key, vars = {}) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(`{${k}}`, v),
    t(key)
  );
}

export function applyLanguage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('lang-btn--active', btn.dataset.lang === _lang);
  });
  // Refresh compat message if currently shown
  const compatEl = document.getElementById('compat-warning');
  if (compatEl?.dataset.compatKey) {
    const msgEl = document.getElementById('compat-message');
    if (msgEl) msgEl.textContent = t(compatEl.dataset.compatKey);
  }
}
