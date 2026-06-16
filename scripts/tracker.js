import { getHeroData, setHeroData, clearHeroData, getFavorites, toggleFavorite,
         getUIPrefs, setUIPrefs, getSettings, getCreators,
         getIconPref, setIconPref,
         getCostumeData, setCostumeData, clearCostumeData } from './state.js';

// ── Data ─────────────────────────────────────────────────────────────────────

let heroes = [], roles = [], ranks = [], roleIconMap = {};
let costumes = [], rarities = [], difficulties = [], seasons = [];

// ── UI state ──────────────────────────────────────────────────────────────────

let activeRoles    = new Set(); // empty = show all roles
let activeRanks    = new Set(); // empty = show all ranks
let favFilter      = 'all';   // 'all' | 'only' | 'exclude'
let customFilter   = 'all';   // 'all' | 'only' | 'exclude'
let trackedFilter = 'all';
let sortMode       = 'name-asc';
let searchQuery    = '';
let cardSize       = 'md';    // 'sm' | 'md' | 'lg'  — card view
let iconSize       = 'md';    // 'sm' | 'md' | 'lg'  — icon view

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
    try {
        const [hRes, roRes, raRes, coRes, rarRes, difRes, seaRes] = await Promise.all([
            fetch('../app/heroes.json'),
            fetch('../app/roles.json'),
            fetch('../app/ranks.json'),
            fetch('../app/costumes.json'),
            fetch('../app/rarities.json'),
            fetch('../app/difficulties.json'),
            fetch('../app/seasons.json')
        ]);

        let officialHeroes;
        [officialHeroes, roles, ranks, costumes, rarities, difficulties, seasons] = await Promise.all([
            hRes.json(), roRes.json(), raRes.json(), coRes.json(), rarRes.json(), difRes.json(), seaRes.json(),
        ]);

        const customHeroes = getCreators()
            .filter(c => c.addedToTracker)
            .map(c => ({ ...c, isCustom: true }));

        heroes     = [...officialHeroes, ...customHeroes];
        roleIconMap = Object.fromEntries(roles.map(r => [r.name, r.icon]));

        loadUIPrefs();
        buildFilters();
        buildRankFilter();
        const { showHoverImage } = getSettings();
        document.documentElement.dataset.hoverImage = showHoverImage ?? 'on';
        renderGrid();
    } catch (err) {
        console.error('Failed to load data:', err);
        document.getElementById('hero-grid').innerHTML =
            '<p class="load-error">Failed to load heroes. Please refresh the page.</p>';
    }
}

// ── Active image resolution (hero → costume → recolor) ───────────────────────
// Only keys present in costume/recolor override the hero. Missing keys fall
// through to heroes.json automatically — no need to duplicate paths everywhere.

function getActiveImages(hero) {
    const { showCostumes } = getSettings();
    if ((showCostumes ?? 'on') === 'off') return hero;

    const cd = getCostumeData(hero.name);
    if (!cd?.name) return hero;

    const costume = costumes.find(c => c.hero === hero.name && c.name === cd.name);
    if (!costume) return hero;

    const keys   = ['image', 'prestige', 'icon', 'icon-lord', 'icon-champion'];
    const merged = { ...hero };                       // start with full hero data

    keys.forEach(k => { if (costume[k]) merged[k] = costume[k]; });  // costume overrides

    if (cd.recolorIdx > 0) {
        const rc = costume.recolors?.[cd.recolorIdx - 1];
        if (rc) keys.forEach(k => { if (rc[k]) merged[k] = rc[k]; });  // recolor overrides
    }

    return merged;
}

// ── Card background colour ────────────────────────────────────────────────────

function cardColor(hero) {
    const { cardBgMode } = getSettings();
    if (cardBgMode === 'rarity') {
        const cd      = getCostumeData(hero.name);
        const costume = cd?.name ? costumes.find(c => c.hero === hero.name && c.name === cd.name) : null;
        const rarity  = costume  ? rarities.find(r => r.name === costume.rarity) : null;
        return rarity?.color ?? rarities.find(r => r.name === 'Default')?.color ?? 'var(--surface)';
    }
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
    if (cardBgMode === 'difficulty') {
        const diff = difficulties.find(d => d.difficulty === hero.difficulty);
        return diff?.color ?? 'var(--surface)';
    }
    if (cardBgMode === 'season') {
        const season = seasons.find(s => s.season === hero.season);
        return season?.color ?? 'var(--surface)';
    }
    if (cardBgMode === 'none') return 'var(--surface)';
    return hero.color ?? '#200630';
}

// ── UI prefs ──────────────────────────────────────────────────────────────────

function loadUIPrefs() {
    const p        = getUIPrefs();
    activeRoles    = new Set(p.activeRoles    ?? []);
    activeRanks    = new Set(p.activeRanks    ?? []);
    favFilter    = p.favFilter    ?? 'all';
    customFilter = p.customFilter ?? 'all';
    trackedFilter = p.trackedFilter ?? 'all';
    sortMode       = p.sortMode       ?? 'name-asc';
    searchQuery    = p.searchQuery    ?? '';
    cardSize       = p.cardSize       ?? 'md';
    iconSize       = p.iconSize       ?? 'md';

    document.getElementById('sort-select').value = sortMode;
    // Sync size-select to whichever view is currently active
    const isIconView = getSettings().viewMode === 'icon';
    document.getElementById('size-select').value = isIconView ? iconSize : cardSize;
    document.getElementById('hero-search').value = searchQuery;
    syncCycleBtn(document.getElementById('filter-favorites'), favFilter);
    syncCycleBtn(document.getElementById('filter-custom'),    customFilter);
    syncCycleBtn(document.getElementById('filter-tracked'), trackedFilter)
}

function saveUIPrefs() {
    setUIPrefs({
        activeRoles  : [...activeRoles],
        activeRanks  : [...activeRanks],
        favFilter,
        customFilter,
        trackedFilter,
        sortMode,
        searchQuery,
        cardSize,
        iconSize,
    });
}

// Cycle: all -> only -> exclude -> all
function cycleFilterState(current) {
    if (current === 'all')  return 'only';
    if (current === 'only') return 'exclude';
    return 'all';
}

function syncCycleBtn(btn, state) {
    btn.classList.remove('active', 'filter-exclude');
    if (state === 'only')    btn.classList.add('active');
    if (state === 'exclude') btn.classList.add('filter-exclude');
}

// ── Rank filter dropdown ──────────────────────────────────────────────────────

function buildRankFilter() {
    const wrapper = document.getElementById('rank-filter');
    wrapper.innerHTML = '';

    // ── Trigger button ────────────────────────────────────────────────────────
    const trigger = document.createElement('button');
    trigger.className = 'filter-btn rank-filter-trigger';
    trigger.id        = 'rank-filter-trigger';
    updateRankTriggerLabel(trigger);

    // ── Panel ─────────────────────────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.className = 'rank-filter-panel hidden';
    panel.id        = 'rank-filter-panel';

    // "All" clear row
    const clearRow = document.createElement('button');
    clearRow.className   = 'rank-filter-row rank-filter-clear';
    clearRow.textContent = 'All';
    clearRow.addEventListener('click', () => {
        activeRanks.clear();
        updateRankPanelChecks(panel);
        updateRankTriggerLabel(trigger);
        saveUIPrefs();
        renderGrid();
    });
    panel.appendChild(clearRow);

    // One row per rank
    ranks.forEach(rank => {
        const row = document.createElement('button');
        row.className        = 'rank-filter-row' + (activeRanks.has(rank.title) ? ' checked' : '');
        row.dataset.rankTitle = rank.title;

        const check = document.createElement('span');
        check.className = 'rank-filter-check';
        check.textContent = '✓';

        const icon = document.createElement('img');
        icon.src   = rank.icon;
        icon.alt   = rank.title;

        const label = document.createElement('span');
        label.textContent = rank.title;

        row.append(check, icon, label);

        row.addEventListener('click', () => {
            if (activeRanks.has(rank.title)) {
                activeRanks.delete(rank.title);
                row.classList.remove('checked');
            } else {
                activeRanks.add(rank.title);
                row.classList.add('checked');
            }
            updateRankTriggerLabel(trigger);
            saveUIPrefs();
            renderGrid();
        });

        panel.appendChild(row);
    });

    wrapper.append(trigger, panel);

    // ── Toggle open/close ─────────────────────────────────────────────────────
    trigger.addEventListener('click', e => {
        e.stopPropagation();
        const isOpen = !panel.classList.contains('hidden');
        closeAllRankPanels();
        if (!isOpen) panel.classList.remove('hidden');
    });

    // Close on outside click
    document.addEventListener('click', e => {
        if (!wrapper.contains(e.target)) panel.classList.add('hidden');
    });
}

function updateRankTriggerLabel(trigger) {
    const n = activeRanks.size;
    trigger.textContent = n > 0 ? `Rank (${n}) ▾` : 'Rank ▾';
    trigger.classList.toggle('active', n > 0);
}

function updateRankPanelChecks(panel) {
    panel.querySelectorAll('.rank-filter-row[data-rank-title]').forEach(row => {
        row.classList.toggle('checked', activeRanks.has(row.dataset.rankTitle));
    });
}

function closeAllRankPanels() {
    document.querySelectorAll('.rank-filter-panel').forEach(p => p.classList.add('hidden'));
}

// ── Role filters ──────────────────────────────────────────────────────────────

let allBtn      = null;
const roleBtns  = new Map();

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

function levelUpDistance(hero) {
    const d = getHeroData(hero.name);
    if (!d?.rank) return null;
    const rank = ranks.find(r => r.title === d.rank);
    if (!rank) return null;
    if (rank.ppl === null) return 0;
    return rank.ppl - (d.points ?? 0);
}

function byLevelUp(a, b) {
    const [da, db] = [levelUpDistance(a), levelUpDistance(b)];
    if (da === null && db === null) return a.name.localeCompare(b.name);
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
}

function rankUpDistance(hero) {
    const d = getHeroData(hero.name);
    if (!d?.rank) return null;

    const rank = ranks.find(r => r.title === d.rank);
    if (!rank || rank.ppl === null) return null;

    const levelsLeft = rank.maxLevel - (d.level ?? rank.minLevel);
    const pointsToFill = rank.ppl - (d.points ?? 0);

    return levelsLeft * rank.ppl + pointsToFill;
}

function byRankUp(a, b) {
    const [da, db] = [rankUpDistance(a), rankUpDistance(b)];
    if (da === null && db === null) return a.name.localeCompare(b.name);
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
}

// ── Filter + sort ─────────────────────────────────────────────────────────────

function getFilteredSorted() {
    const favSet = new Set(getFavorites());
    const q      = searchQuery.trim().toLowerCase();

    const list = heroes.filter(h => {
        if (activeRanks.size > 0) {
            const d = getHeroData(h.name);
            if (!d?.rank || !activeRanks.has(d.rank)) return false;
        }
        if (activeRoles.size > 0) {
            const hr = Array.isArray(h.role) ? h.role : [h.role];
            if (!hr.some(r => activeRoles.has(r))) return false;
        }
        if (favFilter    === 'only'    && !favSet.has(h.name)) return false;
        if (favFilter    === 'exclude' &&  favSet.has(h.name)) return false;
        if (customFilter === 'only'    && !h.isCustom)         return false;
        if (customFilter === 'exclude' &&  h.isCustom)         return false;
        if (trackedFilter === 'only' && !getHeroData(h.name)) return false;
        if (trackedFilter === 'exclude' && getHeroData(h.name)) return false;
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
            case 'rankup-asc':   return byRankUp(a, b);
            case 'rankup-desc':  return byRankUp(b, a);
            case 'diff-asc':     return (a.difficulty ?? 0) - (b.difficulty ?? 0);
            case 'diff-desc':    return (b.difficulty ?? 0) - (a.difficulty ?? 0);
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
    const isIcon = getSettings().viewMode === 'icon';

    grid.innerHTML = '';
    grid.dataset.viewMode = isIcon ? 'icon' : 'card';
    grid.dataset.cardSize = isIcon ? iconSize : cardSize;
    // Keep the size dropdown in sync when switching views
    document.getElementById('size-select').value = isIcon ? iconSize : cardSize;

    if (!list.length) {
        grid.innerHTML = '<p class="no-results">No heroes match your filters.</p>';
        return;
    }

    list.forEach(hero => grid.appendChild(isIcon ? buildIconCard(hero, favSet) : buildCard(hero, favSet)));
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

    const { showName, showProficiency, showRoleIcons } = getSettings();
    const imgs = getActiveImages(hero);
    card.innerHTML = `
        <button class="fav-btn${isFav ? ' active' : ''}" aria-label="${isFav ? 'Unfavourite' : 'Favourite'} ${hero.name}">⛊</button>
        ${showRoleIcons !== 'off' ? `<div class="role-badge" aria-hidden="true">${roleBadges}</div>` : ''}
        <img src="${imgs.image}"                   class="hero-art"      alt="${hero.name}" loading="lazy">
        <img src="${imgs.prestige || imgs.image}"   class="hero-prestige" alt="${hero.name} prestige" loading="lazy">
        ${(showName !== 'off' || showProficiency !== 'off') ? `
        <div class="hero-info">
            ${showName        !== 'off' ? `<div class="hero-name">${hero.name}</div>` : ''}
            ${showProficiency !== 'off' ? rankInfo : ''}
        </div>` : ''}
    `;

    card.querySelector('.fav-btn').addEventListener('click', e => {
        e.stopPropagation();
        toggleFavorite(hero.name);
        renderGrid();
    });

    card.addEventListener('click', () => openModal(hero));
    return card;
}

// ── Icon card ─────────────────────────────────────────────────────────────────

// Pick the right icon image based on rank tier
// Returns the icon set at a given index (0 = base, 1+ = alt-icons)
function getIconSet(hero, idx) {
    if (!idx) return hero;
    return (hero['alt-icons'] ?? [])[idx - 1] ?? hero;
}

function heroIcon(hero, data) {
    const ri          = data?.rank ? ranks.findIndex(r => r.title === data.rank) : -1;
    const championIdx = ranks.findIndex(r => r.title === 'Champion');
    const lordIdx     = ranks.findIndex(r => r.title === 'Lord');

    // If costume equipped, active images already merge costume+recolor on top of hero
    if (getCostumeData(hero.name)?.name) {
        const imgs = getActiveImages(hero);
        if (ri >= championIdx && imgs['icon-champion']) return imgs['icon-champion'];
        if (ri >= lordIdx     && imgs['icon-lord'])     return imgs['icon-lord'];
        return imgs.icon ?? imgs.image;
    }

    // Default: respect icon picker + rank tier
    const iconSet = getIconSet(hero, getIconPref(hero.name));
    if (ri >= championIdx && iconSet['icon-champion']) return iconSet['icon-champion'];
    if (ri >= lordIdx     && iconSet['icon-lord'])     return iconSet['icon-lord'];
    return iconSet.icon ?? hero.image;
}

function buildIconCard(hero, favSet) {
    const heroRoles = Array.isArray(hero.role) ? hero.role : [hero.role];
    const data      = getHeroData(hero.name);
    const isFav     = favSet.has(hero.name);
    const rank      = data ? ranks.find(r => r.title === data.rank) : null;

    const card = document.createElement('div');
    card.className = 'hero-icon-card' + (data ? ' is-tracked' : '');
    card.style.setProperty('--hero-color', cardColor(hero));

    const roleBadges = heroRoles
        .filter(r => roleIconMap[r])
        .map(r => `<img src="${roleIconMap[r]}" alt="${r}">`)
        .join('');

    const rankInfo = rank ? `
        <div class="hero-rank-info">
            <img src="${rank.icon}" alt="${data.rank}">
            <span>${data.rank} ${data.level}${data.points != null ? ` · ${data.points}pts` : ''}</span>
        </div>` : '';

    const { showName, showProficiency, showRoleIcons } = getSettings();
    card.innerHTML = `
        <button class="fav-btn${isFav ? ' active' : ''}" aria-label="${isFav ? 'Unfavourite' : 'Favourite'} ${hero.name}">⛊</button>
        ${showRoleIcons !== 'off' ? `<div class="role-badge" aria-hidden="true">${roleBadges}</div>` : ''}
        <img src="${heroIcon(hero, data)}" class="hero-icon-img" alt="${hero.name}" loading="lazy">
        ${(showName !== 'off' || showProficiency !== 'off') ? `
        <div class="hero-info">
            ${showName        !== 'off' ? `<div class="hero-name">${hero.name}</div>` : ''}
            ${showProficiency !== 'off' ? rankInfo : ''}
        </div>` : ''}
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

function getModalIcon(hero, data) {
    const ri      = data?.rank ? ranks.findIndex(r => r.title === data.rank) : -1;
    const lordIdx = ranks.findIndex(r => r.title === 'Lord');

    if (getCostumeData(hero.name)?.name) {
        const imgs = getActiveImages(hero);
        if (ri >= lordIdx && imgs['icon-lord']) return imgs['icon-lord'];
        return imgs.icon ?? imgs.image;
    }

    const iconSet = getIconSet(hero, getIconPref(hero.name));
    if (!data?.rank) return iconSet.icon ?? hero.image;
    if (ri >= lordIdx && iconSet['icon-lord']) return iconSet['icon-lord'];
    return iconSet.icon ?? hero.image;
}

function buildIconPicker(hero, data) {
    const container = document.getElementById('modal-icon-picker');
    container.innerHTML = '';

    const alts       = hero['alt-icons'] ?? [];
    const allSets    = [hero, ...alts];   // idx 0 = base, 1+ = alts
    const currentIdx = getIconPref(hero.name);

    // Only show picker if there are multiple options
    if (allSets.length <= 1) return;

    allSets.forEach((iconSet, i) => {
        const opt = document.createElement('div');
        opt.className = 'modal-icon-option' + (i === currentIdx ? ' active' : '');

        const img = document.createElement('img');
        img.src     = iconSet.icon ?? hero.image;
        img.alt     = `Icon ${i + 1}`;
        img.loading = 'lazy';
        opt.appendChild(img);

        opt.addEventListener('click', () => {
            container.querySelectorAll('.modal-icon-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            setIconPref(hero.name, i);
            document.getElementById('modal-hero-art').src = getModalIcon(hero, data);
            renderGrid();
        });

        container.appendChild(opt);
    });
}

function openModal(hero) {
    currentHero = hero;
    const data  = getHeroData(hero.name) ?? {};

    document.getElementById('modal-hero-name').textContent = hero.name;
    const artEl = document.getElementById('modal-hero-art');
    artEl.src = getModalIcon(hero, data);
    artEl.alt = hero.name;

    selectedRank = data.rank ? (ranks.find(r => r.title === data.rank) ?? null) : null;

    renderRankGrid(data.rank ?? null);
    syncLevelControls(selectedRank, data.level ?? null, data.points ?? null);
    buildIconPicker(hero, data);

    // Show costume button only if this hero has costumes defined
    const hasCostumes = costumes.some(c => c.hero === hero.name);
    document.getElementById('modal-costume-area').classList.toggle('hidden', !hasCostumes);

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
            document.getElementById('modal-hero-art').src = getModalIcon(currentHero, { rank: rank.title });
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

document.getElementById('size-select').addEventListener('change', e => {
    const isIcon = getSettings().viewMode === 'icon';
    if (isIcon) iconSize = e.target.value;
    else        cardSize = e.target.value;
    saveUIPrefs();
    renderGrid();
});

document.getElementById('hero-search').addEventListener('input', function () {
    searchQuery = this.value;
    saveUIPrefs();
    renderGrid();
});

document.getElementById('filter-favorites').addEventListener('click', function () {
    favFilter = cycleFilterState(favFilter);
    syncCycleBtn(this, favFilter);
    saveUIPrefs();
    renderGrid();
});

document.getElementById('filter-tracked').addEventListener('click', function () {
    trackedFilter = cycleFilterState(trackedFilter);
    syncCycleBtn(this, trackedFilter);
    saveUIPrefs();
    renderGrid();
})

document.getElementById('filter-custom').addEventListener('click', function () {
    customFilter = cycleFilterState(customFilter);
    syncCycleBtn(this, customFilter);
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
// ── Costume modal ─────────────────────────────────────────────────────────────

let costumeModalHero = null;

function openCostumeModal(hero) {
    costumeModalHero = hero;
    document.getElementById('costume-modal-name').textContent = hero.name;
    document.getElementById('costume-modal-art').src =
        getModalIcon(hero, getHeroData(hero.name) ?? {});
    renderCostumeModal(hero);
    document.getElementById('costume-modal').classList.remove('hidden');
}

function closeCostumeModal() {
    document.getElementById('costume-modal').classList.add('hidden');
    costumeModalHero = null;
}

function renderCostumeModal(hero) {
    // Refresh art in case costume changed
    document.getElementById('costume-modal-art').src =
        getModalIcon(hero, getHeroData(hero.name) ?? {});

    const list = document.getElementById('costume-list');
    list.innerHTML = '';

    const cd           = getCostumeData(hero.name);
    const heroCostumes = costumes.filter(c => c.hero === hero.name);
    heroCostumes.forEach(costume => list.appendChild(buildCostumeItem(costume, cd, hero)));
}

function buildCostumeItem(costume, cd, hero) {
    const isEquipped = cd?.name === costume.name;

    const item = document.createElement('div');
    item.className = 'costume-item' + (isEquipped ? ' equipped' : '');

    // Thumbnail: use recolor image if this costume is equipped with a recolor
    let thumbSrc = costume.image;
    if (isEquipped && cd.recolorIdx > 0) {
        const rc = costume.recolors?.[cd.recolorIdx - 1];
        if (rc?.image) thumbSrc = rc.image;
    }

    const rarity = rarities.find(r => r.name === costume.rarity);

    item.innerHTML = `
        <img class="costume-thumb" src="${thumbSrc}" alt="${costume.name}">
        <div class="costume-info">
            <div class="costume-name">${costume.name}</div>
            <div class="costume-rarity">
                ${rarity?.icon ? `<img src="${rarity.icon}" alt="${costume.rarity}" class="rarity-icon">` : ''}
                <span style="color:${rarity?.color ?? 'inherit'}">${costume.rarity}</span>
            </div>
        </div>
    `;

    // Recolor picker (stop propagation so it doesn't trigger equip/unequip)
    if (costume.recolors?.length > 0) {
        item.appendChild(buildRecolorPicker(costume, cd, hero));
    }

    // Click costume to equip; click again to unequip
    item.addEventListener('click', () => {
        if (isEquipped) {
            clearCostumeData(hero.name);
        } else {
            setCostumeData(hero.name, { name: costume.name, recolorIdx: 0 });
        }
        renderCostumeModal(hero);
        renderGrid();
    });

    return item;
}

function buildRecolorPicker(costume, cd, hero) {
    const isEquipped   = cd?.name === costume.name;
    const currentIdx   = isEquipped ? (cd.recolorIdx ?? 0) : 0;

    const wrapper = document.createElement('div');
    wrapper.className = 'recolor-wrapper';
    wrapper.addEventListener('click', e => e.stopPropagation()); // don't equip/unequip

    const trigger = document.createElement('button');
    trigger.className   = 'recolor-trigger';
    trigger.textContent = currentIdx === 0 ? '◈' : String(currentIdx + 1);
    trigger.title       = 'Recolors';

    const panel = document.createElement('div');
    panel.className = 'recolor-panel hidden';

    // Build option for base + each recolor
    const allOptions = [{ name: costume.name, image: costume.image }, ...costume.recolors];
    allOptions.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className   = 'recolor-opt' + (currentIdx === i ? ' active' : '');
        btn.textContent = String(i + 1);
        btn.title       = opt.name;
        btn.addEventListener('click', () => {
            setCostumeData(hero.name, { name: costume.name, recolorIdx: i });
            panel.classList.add('hidden');
            renderCostumeModal(hero);
            renderGrid();
        });
        panel.appendChild(btn);
    });

    trigger.addEventListener('click', e => {
        e.stopPropagation();
        const wasHidden = panel.classList.contains('hidden');
        document.querySelectorAll('.recolor-panel').forEach(p => p.classList.add('hidden'));
        if (wasHidden) panel.classList.remove('hidden');
    });

    wrapper.append(trigger, panel);
    return wrapper;
}

// Close recolor panels on outside click
document.addEventListener('click', () => {
    document.querySelectorAll('.recolor-panel').forEach(p => p.classList.add('hidden'));
});

// Costume modal listeners
document.getElementById('modal-costume-btn').addEventListener('click', () => {
    const hero = currentHero;
    closeModal();
    openCostumeModal(hero);
});

document.getElementById('costume-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeCostumeModal();
});

document.getElementById('costume-modal-close').addEventListener('click', closeCostumeModal);

document.getElementById('costume-back-btn').addEventListener('click', () => {
    const hero = costumeModalHero;
    closeCostumeModal();
    if (hero) openModal(hero);
});