// Tiny element builder used everywhere instead of innerHTML strings.
// Attributes that are false/null are skipped; "onclick"-style keys become listeners;
// false/null children are skipped (so `cond && el(...)` works).
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (val === false || val == null) continue;
    if (key.startsWith('on')) node.addEventListener(key.slice(2), val);
    else node.setAttribute(key, val === true ? '' : val);
  }
  node.append(...[children].flat(Infinity).filter((c) => c !== false && c != null));
  return node;
}

// Material Symbols icon. The name must also be listed in icon_names in css/style.css.
export const icon = (name) => el('span', { class: 'icon', 'aria-hidden': 'true' }, name);