import { marked } from 'marked';

// Map guide slugs to their Markdown files (loaded via Vite ?raw imports)
const GUIDES = {
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

export function initGuidePanel() {
  const content = document.getElementById('guide-content');
  const navBtns = document.querySelectorAll('.guide-nav-btn');

  async function showGuide(slug) {
    navBtns.forEach(b => {
      b.classList.toggle('guide-nav-btn--active', b.dataset.guide === slug);
    });
    if (!content) return;
    content.innerHTML = '<p>Laden...</p>';
    try {
      const mod = await GUIDES[slug]?.();
      if (!mod) { content.innerHTML = '<p>Anleitung nicht gefunden.</p>'; return; }
      content.innerHTML = marked.parse(mod.default);
    } catch {
      content.innerHTML = '<p>Anleitung konnte nicht geladen werden.</p>';
    }
  }

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => showGuide(btn.dataset.guide));
  });

  // Load first guide by default
  showGuide('00_installation');
}
