const DEFAULT_PORTFOLIO_VISUAL = '/og-image-2026.jpg';

const DEMO_VISUALS = {
  '/demos/landing-psycho': '/assets/demos/psychologist-hero.webp',
  '/demos/card-photo': '/assets/demos/photographer-hero.webp',
  '/demos/menu-cafe': '/assets/demos/cafe-hero.webp',
  '/demos/landing-massage': '/assets/demos/massage-hero.webp',
  '/demos/card-nutri': '/assets/demos/nutritionist-hero.webp',
  '/demos/menu-pub': '/assets/demos/pub-hero.webp',
};

function resolvePortfolioVisual(item = {}) {
  const uploadedVisual = String(item.screenshotUrl || '').trim();
  if (uploadedVisual) return uploadedVisual;

  const livePath = String(item.liveUrl || '').split(/[?#]/)[0].replace(/\/$/, '');
  if (DEMO_VISUALS[livePath]) return DEMO_VISUALS[livePath];

  const identity = `${item.slug || ''} ${item.title || ''} ${item.niche || ''}`.toLowerCase();
  if (/психолог|psycho/.test(identity)) return DEMO_VISUALS['/demos/landing-psycho'];
  if (/фотограф|photo|koval|коваль/.test(identity)) return DEMO_VISUALS['/demos/card-photo'];
  if (/нутриц|nutri|дієтолог/.test(identity)) return DEMO_VISUALS['/demos/card-nutri'];
  if (/масаж|massage/.test(identity)) return DEMO_VISUALS['/demos/landing-massage'];
  if (/паб|бар|pub|berloh|берлог/.test(identity)) return DEMO_VISUALS['/demos/menu-pub'];
  if (/кафе|кав'яр|кав’яр|cafe|aroma|горобин/.test(identity)) return DEMO_VISUALS['/demos/menu-cafe'];

  return DEFAULT_PORTFOLIO_VISUAL;
}

function withPortfolioVisual(item) {
  return { ...item, screenshotUrl: resolvePortfolioVisual(item) };
}

module.exports = { resolvePortfolioVisual, withPortfolioVisual };
