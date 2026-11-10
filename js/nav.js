// Injects the nav bar into every page and marks the current page active.
// To add a page: add one line to ITEMS (and its icon to icon_names in css/style.css).
// Items with `action` become buttons instead of links; `end` pushes them to the right on large screens.
import { url } from './config.js';
import { el, icon } from './dom.js';
import { openSettings } from './settings.js';

const ITEMS = [
  { label: 'Home',     icon: 'home',     href: '' },
  { label: 'Heroes',   icon: 'bolt',     href: 'views/heroes.html' },
  { label: 'Stats',    icon: 'bar_chart', href: 'views/stats.html' },
  { label: 'Settings', icon: 'settings', action: openSettings, end: true },
];

// Treat /x, /x/, /x/index.html and /x.html as the same page (GitHub Pages + Vercel clean URLs)
const norm = (path) => path.replace(/(\/index)?(\.html)?$/, '').replace(/\/$/, '');
const here = norm(location.pathname);

const link = (item) => {
  const attrs = { class: `nav-link${item.end ? ' nav-end' : ''}`, 'aria-label': item.label };
  const content = [icon(item.icon), el('span', { class: 'nav-label' }, item.label)];
  return item.action
    ? el('button', { ...attrs, type: 'button', 'aria-haspopup': 'dialog', onclick: item.action }, content)
    : el('a', {
        ...attrs,
        href: url(item.href),
        'aria-current': norm(new URL(url(item.href)).pathname) === here && 'page',
      }, content);
};

document.body.append(el('nav', { class: 'nav', 'aria-label': 'Main' }, ITEMS.map(link)));

// Install as app + favicon. Added from here so every page gets them from one place.
document.head.append(
  el('link', { rel: 'manifest', href: url('manifest.webmanifest') }),
  el('link', { rel: 'icon', type: 'image/png', href: url('assets/project/icon.png') }),
  el('link', { rel: 'apple-touch-icon', href: url('assets/project/icon.png') }),
);
navigator.serviceWorker?.register(url('sw.js')).catch(() => {});   // only exists on https (and localhost)