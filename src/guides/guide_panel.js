import { marked } from 'marked';
import { getLang, t } from '../i18n/index.js';

const GUIDES_DE = {
  '00_installation':        () => import('./00_installation.md?raw'),
  '01_bluetooth_pairing':   () => import('./01_bluetooth_pairing.md?raw'),
  '02_wearing_h10':         () => import('./02_wearing_h10.md?raw'),
  '03_first_session':       () => import('./03_first_session.md?raw'),
  '04_edf_check':           () => import('./04_edf_check.md?raw'),
  '05_24h_prep':            () => import('./05_24h_prep.md?raw'),
  '06_h10_troubleshooting': () => import('./06_h10_troubleshooting.md?raw'),
  '07_datenschutz':         () => import('./07_datenschutz.md?raw'),
  '08_hrv_metriken':        () => import('./08_hrv_metriken.md?raw'),
};

const GUIDES_EN = {
  '00_installation':        () => import('./en/00_installation.md?raw'),
  '01_bluetooth_pairing':   () => import('./en/01_bluetooth_pairing.md?raw'),
  '02_wearing_h10':         () => import('./en/02_wearing_h10.md?raw'),
  '03_first_session':       () => import('./en/03_first_session.md?raw'),
  '04_edf_check':           () => import('./en/04_edf_check.md?raw'),
  '05_24h_prep':            () => import('./en/05_24h_prep.md?raw'),
  '06_h10_troubleshooting': () => import('./en/06_h10_troubleshooting.md?raw'),
  '07_datenschutz':         () => import('./en/07_datenschutz.md?raw'),
  '08_hrv_metriken':        () => import('./en/08_hrv_metriken.md?raw'),
};

function getGuides() {
  return getLang() === 'en' ? GUIDES_EN : GUIDES_DE;
}

export function initGuidePanel() {
  const content = document.getElementById('guide-content');
  const navBtns = document.querySelectorAll('.guide-nav-btn');
  let currentSlug = '00_installation';

  async function showGuide(slug) {
    currentSlug = slug;
    navBtns.forEach(b => {
      b.classList.toggle('guide-nav-btn--active', b.dataset.guide === slug);
    });
    if (!content) return;
    content.innerHTML = `<p>${t('guide.loading')}</p>`;
    try {
      const mod = await getGuides()[slug]?.();
      if (!mod) { content.innerHTML = `<p>${t('guide.not_found')}</p>`; return; }
      content.innerHTML = marked.parse(mod.default);
    } catch {
      content.innerHTML = `<p>${t('guide.load_error')}</p>`;
    }
  }

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => showGuide(btn.dataset.guide));
  });

  // Reload current guide when language changes
  window.addEventListener('languagechange', () => showGuide(currentSlug));

  showGuide('00_installation');
}
