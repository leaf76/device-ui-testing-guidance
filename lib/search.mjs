import { loadGuides } from "./guides.mjs";

const SYNONYMS = {
  rwd: ["responsive", "viewport", "matrix", "breakpoints"],
  mobile: ["phone", "touch", "compact", "ios", "portrait"],
  phone: ["mobile", "360x640", "390x844", "667x375", "844x390"],
  ipad: ["tablet", "768x1024", "1024x768", "split-screen"],
  split: ["split-screen", "640x800", "tablet", "breakpoints"],
  modal: ["dialog", "overlay", "backdrop", "drawer", "top-layer"],
  popup: ["popover", "dropdown", "menu", "dialog"],
  clip: ["clipping", "overflow", "bounding-box", "truncation"],
  cut: ["clipping", "truncation", "overflow"],
  cutoff: ["clipping", "truncation", "overflow"],
  scroll: ["scrollwidth", "overscroll", "bounce", "touch-action"],
  safari: ["ios", "zoom", "16px", "safe-area", "closedby"],
  zoom: ["16px", "200-percent", "text-scale", "ios", "auto-zoom"],
  tap: ["touch", "44px", "pointer", "coarse", "hit-area"],
  click: ["touch", "pointer", "overlap", "buttons"],
  cjk: ["bilingual", "chinese", "ime", "i18n", "expansion"],
  zh: ["bilingual", "cjk", "chinese", "i18n"],
  en: ["bilingual", "latin", "i18n", "expansion"],
  i18n: ["bilingual", "cjk", "latin", "locale"],
  dark: ["theme", "dark-mode", "light-mode", "contrast"],
  light: ["theme", "light-mode", "dark-mode", "contrast"],
  a11y: ["accessibility", "contrast", "zoom", "focus", "touch", "wcag"],
  crowd: ["crowding", "toolbar", "above-the-fold", "height-budget", "overlap"],
  cramped: ["crowding", "above-the-fold", "compact", "toolbar"],
  notch: ["safe-area", "dynamic-island", "viewport-fit", "dvh"],
  vh: ["dvh", "svh", "safe-area", "viewport"],
  hidden: ["specificity", "display-flex", "display-grid", "checkbox"],
  lint: ["static-scan", "antipattern", "rules", "css"],
  scan: ["static-scan", "clipping", "overflow", "audit"],
  screenshot: ["visual-inspection", "triage", "fullpage"],
  long: ["long-string", "long-tokens", "adversarial", "uuid", "url", "slug"],
  pwa: ["standalone", "display-mode", "offline", "companion"],
  keyboard: ["ime", "focus", "landscape", "orientation", "short-height"],
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "to",
  "for",
  "of",
  "in",
  "on",
  "at",
  "and",
  "or",
  "with",
  "how",
  "test",
  "testing",
  "check",
  "verify",
  "page",
  "app",
  "ui",
  "web",
]);

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, " ")
    .split(/\s+/)
    .flatMap((t) => {
      if (!t) return [];
      const parts = t.includes("-") ? [t, ...t.split("-").filter(Boolean)] : [t];
      return parts;
    })
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

export function searchGuides(query, { category = "", limit = 8, guides = loadGuides() } = {}) {
  const rawQuery = String(query || "").trim().toLowerCase();
  if (!rawQuery) return [];

  const primaryTokens = [...new Set(tokenize(rawQuery))];
  const expandedTokens = new Set();
  for (const tok of primaryTokens) {
    for (const syn of SYNONYMS[tok] || []) {
      expandedTokens.add(syn);
    }
  }

  const filtered = category
    ? guides.filter((g) => g.category.toLowerCase() === category.toLowerCase())
    : guides;

  const scored = [];
  for (const g of filtered) {
    let score = 0;
    const idLower = g.id.toLowerCase();
    const titleLower = g.title.toLowerCase();
    const descLower = g.description.toLowerCase();
    const kwSet = new Set(g.keywords.map((k) => k.toLowerCase()));
    const kwText = g.keywords.join(" ").toLowerCase();
    const headingsText = g.headings.join(" ").toLowerCase();
    const bodyLower = g.body.toLowerCase();

    if (idLower === rawQuery) score += 100;
    else if (idLower.includes(rawQuery)) score += 40;
    if (titleLower.includes(rawQuery)) score += 30;
    if (descLower.includes(rawQuery)) score += 18;

    let primaryHits = 0;
    for (const tok of primaryTokens) {
      let hit = false;
      if (idLower.includes(tok)) {
        score += 18;
        hit = true;
      }
      if (kwSet.has(tok)) {
        score += 16;
        hit = true;
      } else if (kwText.includes(tok)) {
        score += 10;
        hit = true;
      }
      if (titleLower.includes(tok)) {
        score += 14;
        hit = true;
      }
      if (g.category.toLowerCase().includes(tok)) {
        score += 8;
        hit = true;
      }
      if (descLower.includes(tok)) {
        score += 8;
        hit = true;
      }
      if (headingsText.includes(tok)) {
        score += 5;
        hit = true;
      }
      if (bodyLower.includes(tok)) {
        score += 2;
        hit = true;
      }
      if (hit) primaryHits++;
    }

    for (const syn of expandedTokens) {
      if (idLower.includes(syn) || kwSet.has(syn)) score += 5;
      else if (titleLower.includes(syn) || descLower.includes(syn)) score += 3;
      else if (bodyLower.includes(syn)) score += 1;
    }

    // Coverage bonus when multiple query terms match
    if (primaryTokens.length > 1 && primaryHits === primaryTokens.length) {
      score += 15;
    }

    if (score > 0) {
      scored.push({ guide: g, score });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.guide.id.localeCompare(b.guide.id));

  return scored.slice(0, limit).map(({ guide, score }) => ({
    id: guide.id,
    category: guide.category,
    title: guide.title,
    description: guide.description,
    score,
  }));
}
