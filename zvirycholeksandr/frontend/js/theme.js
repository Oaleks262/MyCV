/* Shared public color settings for the legacy and 2026 design systems. */
(() => {
  const CURRENT_DEFAULTS = {
    accent: '#d7ff3a',
    accentHover: '#f2efe8',
    bg: '#f2efe8',
    bg2: '#e8e4db',
    bg3: '#f2efe8',
    text: '#0b0b0c',
    textMuted: '#565653',
    border: '#0b0b0c'
  };

  const LEGACY_DEFAULTS = {
    accent: '#6c63ff',
    accentHover: '#5a52e0',
    bg: '#0a0a0a',
    bg2: '#111111',
    bg3: '#1a1a1a',
    text: '#f0f0f0',
    textMuted: '#888888',
    border: '#222222'
  };

  const VARIABLE_MAP = {
    accent: ['--color-accent', '--signal'],
    accentHover: ['--color-accent-hover', '--signal-hover'],
    bg: ['--color-bg', '--paper'],
    bg2: ['--color-bg-2', '--paper-soft'],
    bg3: ['--color-bg-3', '--surface'],
    text: ['--color-text', '--ink'],
    textMuted: ['--color-text-muted', '--color-text-dim', '--graphite', '--ash'],
    border: ['--color-border', '--color-border-light', '--line']
  };

  const isHex = value => /^#[0-9a-f]{6}$/i.test(String(value || ''));

  function normalize(colors = {}) {
    return Object.fromEntries(Object.keys(CURRENT_DEFAULTS).map(key => {
      const raw = isHex(colors[key]) ? colors[key].toLowerCase() : CURRENT_DEFAULTS[key];
      const migrated = raw === LEGACY_DEFAULTS[key] ? CURRENT_DEFAULTS[key] : raw;
      return [key, migrated];
    }));
  }

  function apply(colors) {
    const normalized = normalize(colors);
    const root = document.documentElement;
    const targets = [root, document.body].filter(Boolean);

    Object.entries(VARIABLE_MAP).forEach(([key, variables]) => {
      if (normalized[key] === CURRENT_DEFAULTS[key]) return;
      targets.forEach(target => variables.forEach(variable => target.style.setProperty(variable, normalized[key])));
    });

    if (normalized.accent !== CURRENT_DEFAULTS.accent) {
      targets.forEach(target => target.style.setProperty('--color-accent-light', `${normalized.accent}1a`));
    }

    return normalized;
  }

  window.SiteTheme = { apply, normalize, defaults: { ...CURRENT_DEFAULTS } };

  fetch('/api/settings', { headers: { 'x-analytics-ignore': '1' } })
    .then(response => response.ok ? response.json() : null)
    .then(settings => settings?.colors && apply(settings.colors))
    .catch(() => {});
})();
