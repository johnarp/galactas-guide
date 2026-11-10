// Single source of truth for paths. Works from index.html (root) and views/*.html,
// and on GitHub Pages project subpaths (user.github.io/repo/), because it is
// resolved from this file's own location, not from the page's.
export const ROOT = new URL('../', import.meta.url);

export const url = (path) => new URL(path, ROOT).href;
export const heroImg = (id, type = 'hero') => url(`assets/heroes/${id}-${type}.png`);
export const roleImg = (role) => url(`assets/ui/${role.toLowerCase()}.png`);

export async function loadData(path) {
  const res = await fetch(url(path));
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

export const ROLES = ['Vanguard', 'Duelist', 'Strategist'];

// Built-in heroes find images by id in assets/heroes/. Custom heroes carry their own links in hero.images.
// form > 1 looks for e.g. 1011-2-agent.png (heroes with several forms, see "forms" in heroes.json)
export const heroImage = (hero, type, form = 1) => {
  if (hero.custom) {   // an extra form's own link, else the hero's first-form link
    const own = form > 1 ? hero.extraForms?.[form - 2]?.images?.[type] : null;
    return own ?? hero.images?.[type] ?? '';
  }
  return heroImg(hero.id, form > 1 ? `${form}-${type}` : type);
};