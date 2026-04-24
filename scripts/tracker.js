import { getHeroData, setHeroData, clearHeroData, getFavorites, toggleFavorite,
         getUIPrefs, setUIPrefs, getSettings, getCreators } from './state.js';

// ── Data ─────────────────────────────────────────────────────────────────────

let heroes = [], roles = [], ranks = [], roleIconMap = {};

// ── UI state ──────────────────────────────────────────────────────────────────

let activeRoles    = new Set(); // empty = show all roles
let showFavsOnly   = false;
let showCustomOnly = false;
let sortMode       = 'name-asc';
let searchQuery    = '';

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
    try {
        const [hRes, roRes, raRes] = await Promise.all([
            fetch('../app/heroes.json'),
            fetch('../app/roles.json'),
            fetch('../app/ranks.json'),
        ]);

        let officialHeroes;
        [officialHeroes, roles, ranks] = await Promise.all([
            hRes.json(), roRes.json(), raRes.json(),
        ]);

        const customHeroes = getCreators()
            .filter(c => c.addedToTracker)
            .map(c => ({ ...c, isCustom: true }));

        heroes     = [...officialHeroes, ...customHeroes];
        roleIconMap = Object.fromEntries(roles.map(r => [r.name, r.icon]));

        loadUIPrefs();
        buildFilters();
        renderGrid();
    } catch (err) {
        console.error('Failed to load data:', err);
        document.getElementById('hero-grid').innerHTML =
            '<p class="load-error">Failed to load heroes. Please refresh the page.</p>';
    }
}

// ── Card background colour ────────────────────────────────────────────────────

function cardColor(hero) {
    const { cardBgMode } = getSettings();
    if (cardBgMode === 'proficiency') {
        const d    = getHeroData(hero.name);
        const rank = d?.rank ? ranks.find(r => r.title === d.rank) : null;
        return rank?.color ?? 'var(--surface)';
    }
    if (cardBgMode === 'role') {
        const firstRole = Array.isArray(hero.role) ? hero.role[0] : hero.role;
        const role      = roles.find(r => r.name === firstRole);
        return role?.color ?? 'var(--surface)';
    }
    return hero.color ?? '#200630';
}

// ── UI prefs ──────────────────────────────────────────────────────────────────

function loadUIPrefs() {
    const p        = getUIPrefs();
    activeRoles    = new Set(p.activeRoles    ?? []);
    showFavsOnly   = p.showFavsOnly   ?? false;
    showCustomOnly = p.showCustomOnly ?? false;
    sortMode       = p.sortMode       ?? 'name-asc';
    searchQuery    = p.searchQuery    ?? '';

    document.getElementById('sort-select').value = sortMode;
    document.getElementById('hero-search').value = searchQuery;
    document.getElementById('filter-favorites').classList.toggle('active', showFavsOnly);
    document.getElementById('filter-custom').classList.toggle('active', showCustomOnly);
}

function saveUIPrefs() {
    setUIPrefs({
        activeRoles    : [...activeRoles],
        showFavsOnly,
        showCustomOnly,
        sortMode,
        searchQuery,
    });
}

// ── Filters UI ────────────────────────────────────────────────────────────────

let allBtn      = null;
const roleBtns  = new Map(); // roleName -> button element

function buildFilters() {
    const container = document.getElementById('role-filters');
    container.innerHTML = '';
    roleBtns.clear();

    allBtn = makeFilterBtn('All', null, activeRoles.size === 0);
    allBtn.addEventListener('click', () => {
        activeRoles.clear();
        syncFilterButtonStates();
        saveUIPrefs();
        renderGrid();
    });
    container.appendChild(allBtn);

    roles.forEach(role => {
        const btn = makeFilterBtn(role.name, role.icon, activeRoles.has(role.name));
        btn.addEventListener('click', () => {
            if (activeRoles.has(role.name)) {
                activeRoles.delete(role.name);
            } else {
                activeRoles.add(role.name);
            }
            syncFilterButtonStates();
            saveUIPrefs();
            renderGrid();
        });
        roleBtns.set(role.name, btn);
        container.appendChild(btn);
    });
}

function makeFilterBtn(label, iconSrc, isActive) {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (isActive ? ' active' : '');
    btn.title     = label;
    if (iconSrc) {
        const img = document.createElement('img');
        img.src = iconSrc;
        img.alt = label;
        btn.appendChild(img);
    } else {
        btn.textContent = label;
    }
    return btn;
}

function syncFilterButtonStates() {
    if (allBtn) allBtn.classList.toggle('active', activeRoles.size === 0);
    roleBtns.forEach((btn, name) => btn.classList.toggle('active', activeRoles.has(name)));
}

// ── Sort helpers ──────────────────────────────────────────────────────────────

function rankScore(hero) {
    const d  = getHeroData(hero.name);
    if (!d) return -1;
    const ri = ranks.findIndex(r => r.title === d.rank);
    if (ri < 0) return -1;
    return ri * 1_000_000 + (d.level ?? 0) * 2_000 + (d.points ?? 0);
}

function byRank(a, b) {
    const [sa, sb] = [rankScore(a), rankScore(b)];
    if (sa < 0 && sb < 0) return a.name.localeCompare(b.name);
    if (sa < 0) return 1;
    if (sb < 0) return -1;
    return sa - sb;
}

// Points remaining until next level up = ppl - current points.
// Champion (ppl null) = already maxed, distance = 0.
// Untracked = null (goes to end).
function levelUpDistance(hero) {
    const d = getHeroData(hero.name);
    if (!d?.rank) return null;
    const rank = ranks.find(r => r.title === d.rank);
    if (!rank) return null;
    if (rank.ppl === null) return 0;                  // Champion, maxed
    return rank.ppl - (d.points ?? 0);
}

function byLevelUp(a, b) {
    const [da, db] = [levelUpDistance(a), levelUpDistance(b)];
    if (da === null && db === null) return a.name.localeCompare(b.name);
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db; // ascending = closest first
}

// ── Filter + sort ─────────────────────────────────────────────────────────────

function getFilteredSorted() {
    const favSet = new Set(getFavorites());
    const q      = searchQuery.trim().toLowerCase();

    const list = heroes.filter(h => {
        // Role filter — if any roles are selected, hero must match at least one
        if (activeRoles.size > 0) {
            const hr = Array.isArray(h.role) ? h.role : [h.role];
            if (!hr.some(r => activeRoles.has(r))) return false;
        }
        if (showFavsOnly   && !favSet.has(h.name)) return false;
        if (showCustomOnly && !h.isCustom)          return false;
        if (q              && !h.name.toLowerCase().includes(q)) return false;
        return true;
    });

    list.sort((a, b) => {
        switch (sortMode) {
            case 'name-asc':     return a.name.localeCompare(b.name);
            case 'name-desc':    return b.name.localeCompare(a.name);
            case 'rank-asc':     return byRank(a, b);
            case 'rank-desc':    return byRank(b, a);
            case 'rel-asc':      return (a.season ?? 999) - (b.season ?? 999);
            case 'rel-desc':     return (b.season ?? 999) - (a.season ?? 999);
            case 'levelup-asc':  return byLevelUp(a, b);
            case 'levelup-desc': return byLevelUp(b, a);
            default:             return 0;
        }
    });

    return list;
}

// ── Grid ──────────────────────────────────────────────────────────────────────

function renderGrid() {
    const grid   = document.getElementById('hero-grid');
    const list   = getFilteredSorted();
    const favSet = new Set(getFavorites());

    grid.innerHTML = '';

    if (!list.length) {
        grid.innerHTML = '<p class="no-results">No heroes match your filters.</p>';
        return;
    }

    list.forEach(hero => grid.appendChild(buildCard(hero, favSet)));
}

function buildCard(hero, favSet) {
    const heroRoles = Array.isArray(hero.role) ? hero.role : [hero.role];
    const data      = getHeroData(hero.name);
    const isFav     = favSet.has(hero.name);
    const rank      = data ? ranks.find(r => r.title === data.rank) : null;

    const card = document.createElement('div');
    card.className = 'hero-card' + (data ? ' is-tracked' : '');
    card.style.setProperty('--hero-color', cardColor(hero));

    const roleBadges = heroRoles
        .filter(r => roleIconMap[r])
        .map(r => `<img src="${roleIconMap[r]}" alt="${r}">`)
        .join('');

    const rankInfo = rank ? `
        <div class="hero-rank-info">
            <img src="${rank.icon}" alt="${data.rank}">
            <span>${data.rank} ${data.level}${data.points != null ? ` · ${data.points} pts` : ''}</span>
        </div>` : '';

    card.innerHTML = `
        <button class="fav-btn${isFav ? ' active' : ''}" aria-label="${isFav ? 'Unfavourite' : 'Favourite'} ${hero.name}">★</button>
        <div class="role-badge" aria-hidden="true">${roleBadges}</div>
        <img src="${hero.image}"    class="hero-art"      alt="${hero.name}" loading="lazy">
        <img src="${hero.prestige || hero.image}" class="hero-prestige" alt="${hero.name} prestige" loading="lazy">
        <div class="hero-info">
            <div class="hero-name">${hero.name}</div>
            ${rankInfo}
        </div>
    `;

    card.querySelector('.fav-btn').addEventListener('click', e => {
        e.stopPropagation();
        toggleFavorite(hero.name);
        renderGrid();
    });

    card.addEventListener('click', () => openModal(hero));
    return card;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

let currentHero  = null;
let selectedRank = null;

function openModal(hero) {
    currentHero = hero;
    const data  = getHeroData(hero.name) ?? {};

    document.getElementById('modal-hero-name').textContent = hero.name;
    const artEl = document.getElementById('modal-hero-art');
    artEl.src = hero.image;
    artEl.alt = hero.name;

    selectedRank = data.rank ? (ranks.find(r => r.title === data.rank) ?? null) : null;

    renderRankGrid(data.rank ?? null);
    syncLevelControls(selectedRank, data.level ?? null, data.points ?? null);

    document.getElementById('modal').classList.remove('hidden');
}

function renderRankGrid(activeTitle) {
    const grid = document.getElementById('rank-grid');
    grid.innerHTML = '';

    ranks.forEach(rank => {
        const btn = document.createElement('button');
        btn.className    = 'rank-option' + (rank.title === activeTitle ? ' active' : '');
        btn.dataset.rank = rank.title;
        btn.title        = rank.title;
        btn.innerHTML    = `<img src="${rank.icon}" alt="${rank.title}"><span>${rank.title}</span>`;

        btn.addEventListener('click', () => {
            grid.querySelectorAll('.rank-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedRank = rank;
            syncLevelControls(rank, null, null);
        });

        grid.appendChild(btn);
    });
}

function syncLevelControls(rank, level, points) {
    const levelSection  = document.getElementById('level-section');
    const pointsSection = document.getElementById('points-section');

    if (!rank) { levelSection.classList.add('hidden'); return; }

    levelSection.classList.remove('hidden');

    const levelInput = document.getElementById('level-input');
    levelInput.min   = rank.minLevel;
    levelInput.max   = rank.maxLevel;
    levelInput.value = level ?? rank.minLevel;
    document.getElementById('level-range').textContent = `${rank.minLevel}–${rank.maxLevel}`;

    if (rank.ppl != null) {
        pointsSection.classList.remove('hidden');
        const pointsInput       = document.getElementById('points-input');
        pointsInput.max         = rank.ppl;
        pointsInput.value       = points ?? '';
        pointsInput.placeholder = `0–${rank.ppl}`;
        document.getElementById('points-max').textContent = rank.ppl;
    } else {
        pointsSection.classList.add('hidden');
    }
}

function saveModal() {
    if (!selectedRank || !currentHero) return;

    const levelInput = document.getElementById('level-input');
    const level = parseInt(levelInput.value, 10);

    if (isNaN(level) || level < selectedRank.minLevel || level > selectedRank.maxLevel) {
        levelInput.reportValidity();
        return;
    }

    const raw    = document.getElementById('points-input').value.trim();
    const points = raw !== '' ? parseInt(raw, 10) : null;

    setHeroData(currentHero.name, {
        rank:   selectedRank.title,
        level,
        points: points !== null && !isNaN(points) ? points : null,
    });

    closeModal();
    renderGrid();
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    currentHero  = null;
    selectedRank = null;
}

// ── Event listeners ───────────────────────────────────────────────────────────

document.getElementById('sort-select').addEventListener('change', e => {
    sortMode = e.target.value;
    saveUIPrefs();
    renderGrid();
});

document.getElementById('hero-search').addEventListener('input', function () {
    searchQuery = this.value;
    saveUIPrefs();
    renderGrid();
});

document.getElementById('filter-favorites').addEventListener('click', function () {
    showFavsOnly = !showFavsOnly;
    this.classList.toggle('active', showFavsOnly);
    saveUIPrefs();
    renderGrid();
});

document.getElementById('filter-custom').addEventListener('click', function () {
    showCustomOnly = !showCustomOnly;
    this.classList.toggle('active', showCustomOnly);
    saveUIPrefs();
    renderGrid();
});

document.getElementById('modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
});

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-save').addEventListener('click',  saveModal);

document.getElementById('modal-clear').addEventListener('click', () => {
    if (currentHero) { clearHeroData(currentHero.name); closeModal(); renderGrid(); }
});

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

init();