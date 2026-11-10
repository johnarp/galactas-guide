// Stats page. Everything is worked out from your saved data (storage.js), nothing is stored here.
import { loadData, roleImg, ROLES, url } from './config.js';
import { el } from './dom.js';
import * as store from './storage.js';
import { progressNodes, gradient, iconUrl } from './proficiency.js';
import { rankScore, pointsToGo, totalPoints, fromTotalPoints, effectiveProgress } from './progress.js';

const root = document.getElementById('stats');
const roleFilter = new Set();   // selected roles (empty = all heroes)
let heroes = [], ranks = [], saved = {};
// Auto-track (a Settings switch, key "autoTrack") makes every hero count as tracked. Reads the setting directly.
const autoTrack = store.get('settings').autoTrack === true;

const rolesOf = (h) => [].concat(h.role);
const byName = (a, b) => a.hero.name.localeCompare(b.hero.name);

const tile = (label, value) => el('div', { class: 'panel' }, [
  el('p', { class: 'stat-label' }, label),
  el('p', { class: 'stat-value' }, value),
]);

// rows: [{ hero, meta }]
const heroPanel = (title, rows, wide = false) => el('section', { class: `panel${wide ? ' wide' : ''}` }, [
  el('h2', {}, title),
  rows.length
    ? el('ul', { class: 'hero-list' }, rows.map(({ hero, meta }) => el('li', { style: `--hero:${hero.color}` }, [
        el('div', { class: 'name' }, hero.name),
        el('div', { class: 'meta' }, meta),
      ])))
    : el('p', { class: 'empty-note' }, 'Not enough heroes yet.'),
]);

const nextRank = (p) => ranks[ranks.findIndex((r) => r.title === p.rank) + 1]?.title;

function render(content) {
  const pool = heroes.filter((h) => !roleFilter.size || rolesOf(h).some((r) => roleFilter.has(r)));
  const tracked = pool
    .map((hero) => ({ hero, p: effectiveProgress(ranks, saved[hero.id], autoTrack) }))
    .filter((t) => t.p && ranks.some((r) => r.title === t.p.rank));

  if (!tracked.length) {
    content.replaceChildren(
      tile('Heroes tracked', `0 / ${pool.length}`),
      el('div', { class: 'panel' }, [
        el('p', { class: 'empty-note' }, 'Nothing tracked here yet. Add proficiency to a hero and your stats will show up.'),
        el('a', { class: 'btn btn-primary', href: url('views/heroes.html') }, 'Go to heroes'),
      ]),
    );
    return;
  }

  // Average proficiency: average everyone's total points, then turn that back into rank / level / points
  const avg = fromTotalPoints(ranks, tracked.reduce((sum, t) => sum + totalPoints(ranks, t.p), 0) / tracked.length);
  const difficulties = tracked.map((t) => t.hero.difficulty).filter(Number.isFinite);
  const avgDifficulty = difficulties.length
    ? `${(difficulties.reduce((a, b) => a + b, 0) / difficulties.length).toFixed(1)} / 5`
    : '–';

  const counts = ranks.map((r) => tracked.filter((t) => t.p.rank === r.title).length);
  const max = Math.max(1, ...counts);

  const byRank = [...tracked].sort((a, b) => rankScore(ranks, b.p) - rankScore(ranks, a.p) || byName(a, b));
  const top = byRank.slice(0, 3);
  const lowest = byRank.slice(3).slice(-3).reverse();   // never repeats a hero from the top 3

  const closest = (scope) => tracked
    .map((t) => ({ ...t, left: pointsToGo(ranks, t.p, scope) }))
    .filter((t) => t.left != null)
    .sort((a, b) => a.left - b.left || byName(a, b))
    .slice(0, 3);

  content.replaceChildren(
    el('div', { class: 'tiles' }, [
      tile('Heroes tracked', `${tracked.length} / ${pool.length}`),
      tile('Average proficiency', progressNodes(avg, ranks)),
      tile('Average difficulty', avgDifficulty),
    ]),
    el('div', { class: 'panels' }, [
      el('section', { class: 'panel wide' }, [
        el('h2', {}, 'Proficiency breakdown'),
        el('div', { class: 'rank-bars' }, ranks.map((r, i) => el('div', { class: 'bar-row' }, [
          el('img', { src: iconUrl(r.icon), alt: '' }),
          el('span', {}, r.title),
          el('div', { class: 'bar-track' }, el('div', {
            class: 'bar-fill',
            style: `width:${(counts[i] / max) * 100}%;background:${r.color ? gradient(r.color, 'right') : 'var(--color-primary)'}`,
          })),
          el('span', { class: 'bar-count' }, counts[i]),
        ]))),
      ]),
      heroPanel('Top 3', top.map((t) => ({ hero: t.hero, meta: progressNodes(t.p, ranks) }))),
      heroPanel('Lowest 3', lowest.map((t) => ({ hero: t.hero, meta: progressNodes(t.p, ranks) }))),
      heroPanel('Closest to ranking up', closest('rank').map((t) => ({ hero: t.hero, meta: `${t.left} points to ${nextRank(t.p)}` }))),
      heroPanel('Closest to levelling up', closest('level').map((t) => ({ hero: t.hero, meta: `${t.left} points to level ${t.p.level + 1}` }))),
    ]),
  );
}

async function init() {
  const content = el('div', { class: 'stats' });
  const roleBar = el('div', { class: 'segmented' }, ROLES.map((role) => el('button', {
    class: 'btn btn-icon',
    type: 'button',
    title: role,
    'aria-label': role,
    'aria-pressed': 'false',
    onclick: (e) => {
      const on = !roleFilter.has(role);
      roleFilter[on ? 'add' : 'delete'](role);
      e.currentTarget.setAttribute('aria-pressed', on);
      render(content);
    },
  }, el('img', { src: roleImg(role), alt: '' }))));
  root.append(el('div', { class: 'stats-head' }, roleBar), content);

  try {
    const [builtIn, loadedRanks] = await Promise.all([loadData('data/heroes.json'), loadData('data/proficiency.json')]);
    ranks = loadedRanks;
    heroes = [...builtIn, ...store.get('customHeroes')];
    saved = store.get('progress');
    render(content);
  } catch (err) {
    console.error(err);
    content.replaceChildren(el('p', { class: 'empty-note' }, 'Could not load the data files.'));
  }
}

init();