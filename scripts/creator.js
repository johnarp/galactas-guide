import { getCreators, saveCreator, deleteCreator, getUIPrefs, setUIPrefs } from './state.js';

let roles        = [];
let placeholders = [];
let editingId    = null;
let selectedPlaceholderIdx = null;
let abilities    = []; // abilities being edited in the modal

// ── Creator UI prefs ──────────────────────────────────────────────────────────

let creatorActiveRoles = new Set();
let creatorSearch      = '';
let creatorSortMode    = 'name-asc';
let creatorCardSize    = 'md';

function loadCreatorPrefs() {
    const p = getUIPrefs();
    creatorActiveRoles = new Set(p.creatorActiveRoles ?? []);
    creatorSearch      = p.creatorSearch   ?? '';
    creatorSortMode    = p.creatorSortMode ?? 'name-asc';
    creatorCardSize    = p.creatorCardSize ?? 'md';
}

function saveCreatorPrefs() {
    setUIPrefs({
        creatorActiveRoles : [...creatorActiveRoles],
        creatorSearch,
        creatorSortMode,
        creatorCardSize,
    });
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
    [roles, placeholders] = await Promise.all([
        fetch('../app/roles.json').then(r => r.json()).catch(() => []),
        fetch('../app/creator.json').then(r => r.json()).catch(() => []),
    ]);

    loadCreatorPrefs();
    buildControls();
    buildRolePickers();
    wireModalListeners();
    renderGrid();
}

// ── Controls (reuses tracker CSS classes) ─────────────────────────────────────

let creatorAllBtn     = null;
const creatorRoleBtns = new Map();

function buildControls() {
    const roleFilters = document.getElementById('creator-role-filters');
    roleFilters.innerHTML = '';
    creatorRoleBtns.clear();

    creatorAllBtn = makeFilterBtn('All', null, creatorActiveRoles.size === 0);
    creatorAllBtn.addEventListener('click', () => {
        creatorActiveRoles.clear();
        syncFilterStates();
        saveCreatorPrefs();
        renderGrid();
    });
    roleFilters.appendChild(creatorAllBtn);

    roles.forEach(role => {
        const btn = makeFilterBtn(role.name, role.icon, creatorActiveRoles.has(role.name));
        btn.addEventListener('click', () => {
            creatorActiveRoles.has(role.name)
                ? creatorActiveRoles.delete(role.name)
                : creatorActiveRoles.add(role.name);
            syncFilterStates();
            saveCreatorPrefs();
            renderGrid();
        });
        creatorRoleBtns.set(role.name, btn);
        roleFilters.appendChild(btn);
    });

    const searchEl = document.getElementById('creator-search');
    searchEl.value = creatorSearch;
    searchEl.addEventListener('input', function () {
        creatorSearch = this.value;
        saveCreatorPrefs();
        renderGrid();
    });

    const sizeEl = document.getElementById('creator-size-select');
    sizeEl.value = creatorCardSize;
    sizeEl.addEventListener('change', function () {
        creatorCardSize = this.value;
        saveCreatorPrefs();
        renderGrid();
    });

    const sortEl = document.getElementById('creator-sort-select');
    sortEl.value = creatorSortMode;
    sortEl.addEventListener('change', function () {
        creatorSortMode = this.value;
        saveCreatorPrefs();
        renderGrid();
    });
}

function makeFilterBtn(label, iconSrc, isActive) {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (isActive ? ' active' : '');
    btn.title     = label;
    if (iconSrc) {
        const img = document.createElement('img');
        img.src = iconSrc; img.alt = label;
        btn.appendChild(img);
    } else {
        btn.textContent = label;
    }
    return btn;
}

function syncFilterStates() {
    if (creatorAllBtn) creatorAllBtn.classList.toggle('active', creatorActiveRoles.size === 0);
    creatorRoleBtns.forEach((btn, name) => btn.classList.toggle('active', creatorActiveRoles.has(name)));
}

// ── Filter + sort ─────────────────────────────────────────────────────────────

function getFilteredSorted() {
    const q = creatorSearch.trim().toLowerCase();

    let list = getCreators().filter(c => {
        if (creatorActiveRoles.size > 0) {
            const hr = Array.isArray(c.role) ? c.role : [c.role];
            if (!hr.some(r => creatorActiveRoles.has(r))) return false;
        }
        if (q && !c.name.toLowerCase().includes(q)) return false;
        return true;
    });

    list.sort((a, b) => {
        switch (creatorSortMode) {
            case 'name-asc':    return a.name.localeCompare(b.name);
            case 'name-desc':   return b.name.localeCompare(a.name);
            case 'season-asc':  return (a.season ?? 9999) - (b.season ?? 9999);
            case 'season-desc': return (b.season ?? 9999) - (a.season ?? 9999);
            default:            return 0;
        }
    });

    return list;
}

// ── Grid ──────────────────────────────────────────────────────────────────────

function renderGrid() {
    const grid = document.getElementById('creator-grid');
    grid.innerHTML = '';
    grid.dataset.cardSize = creatorCardSize;

    const addCard = document.createElement('div');
    addCard.className = 'creator-add-card';
    addCard.innerHTML = `<span class="creator-add-icon">+</span><span>New Hero</span>`;
    addCard.addEventListener('click', () => openModal(null));
    grid.appendChild(addCard);

    getFilteredSorted().forEach(c => grid.appendChild(buildCreatorCard(c)));
}

function buildCreatorCard(creator) {
    const card = document.createElement('div');
    card.className = 'hero-card';
    card.style.setProperty('--hero-color', creator.color || 'var(--surface)');

    const heroRoles  = Array.isArray(creator.role) ? creator.role : [creator.role];
    const roleBadges = heroRoles.map(r => {
        const ro = roles.find(x => x.name === r);
        return ro ? `<img src="${ro.icon}" alt="${r}">` : '';
    }).join('');

    const inTracker = creator.addedToTracker
        ? `<div class="hero-rank-info" style="color:var(--accent)">✦ In Tracker</div>`
        : '';

    card.innerHTML = `
        <div class="role-badge" aria-hidden="true">${roleBadges}</div>
        <img src="${creator.image    || ''}" class="hero-art"      alt="${creator.name}" loading="lazy">
        <img src="${creator.prestige || creator.image || ''}" class="hero-prestige" alt="${creator.name}" loading="lazy">
        <div class="card-actions">
            <button class="card-action-btn edit"   title="Edit">✎</button>
            <button class="card-action-btn delete" title="Delete">✕</button>
        </div>
        <div class="hero-info">
            <div class="hero-name">${creator.name}</div>
            ${inTracker}
        </div>
    `;

    card.querySelector('.edit').addEventListener('click', e => {
        e.stopPropagation();
        openModal(creator);
    });

    card.querySelector('.delete').addEventListener('click', e => {
        e.stopPropagation();
        if (confirm(`Delete "${creator.name}"? This cannot be undone.`)) {
            deleteCreator(creator.id);
            renderGrid();
        }
    });

    // Click card body to open the view modal
    card.addEventListener('click', () => openViewModal(creator));

    return card;
}

// ── Role pickers (edit modal) ─────────────────────────────────────────────────

function buildRolePickers() {
    const container = document.getElementById('modal-role-pickers');
    container.innerHTML = '';
    roles.forEach(role => {
        const btn = document.createElement('button');
        btn.type         = 'button';
        btn.className    = 'role-check-btn';
        btn.dataset.role = role.name;
        btn.innerHTML    = `<img src="${role.icon}" alt="${role.name}"><span>${role.name}</span>`;
        btn.addEventListener('click', () => btn.classList.toggle('active'));
        container.appendChild(btn);
    });
}

// ── Image picker ──────────────────────────────────────────────────────────────

function buildImagePicker(currentImage) {
    const container = document.getElementById('image-picker');
    container.innerHTML = '';

    selectedPlaceholderIdx = placeholders.findIndex(p => p.image === currentImage);
    if (selectedPlaceholderIdx < 0) selectedPlaceholderIdx = null;

    if (placeholders.length === 0) {
        container.innerHTML = '<p style="opacity:0.4;font-size:0.8rem;margin:0">No placeholders in app/creator.json yet.</p>';
        return;
    }

    placeholders.forEach((p, i) => {
        const opt = document.createElement('div');
        opt.className = 'image-picker-option' + (i === selectedPlaceholderIdx ? ' active' : '');
        opt.title     = `Placeholder ${i + 1}`;

        const img = document.createElement('img');
        img.src = p.image; img.alt = `Placeholder ${i + 1}`; img.loading = 'lazy';
        opt.appendChild(img);

        opt.addEventListener('click', () => {
            container.querySelectorAll('.image-picker-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            selectedPlaceholderIdx = i;
        });

        container.appendChild(opt);
    });
}

// ── Abilities editor ──────────────────────────────────────────────────────────

function buildAbilitiesEditor(existing = []) {
    abilities = existing.map(a => ({ ...a }));
    renderAbilitiesEditor();
}

function renderAbilitiesEditor() {
    const container = document.getElementById('abilities-list');
    container.innerHTML = '';

    if (abilities.length === 0) {
        container.innerHTML = '<p class="abilities-empty">No abilities yet.</p>';
        return;
    }

    abilities.forEach((ability, i) => {
        const row = document.createElement('div');
        row.className = 'ability-row';

        row.innerHTML = `
            <div class="ability-reorder">
                <button type="button" class="ability-reorder-btn" data-dir="up"   title="Move up"   ${i === 0                    ? 'disabled' : ''}>↑</button>
                <button type="button" class="ability-reorder-btn" data-dir="down" title="Move down" ${i === abilities.length - 1  ? 'disabled' : ''}>↓</button>
            </div>
            <input type="text" class="ability-input ability-key"  placeholder="Key"         value="${escHtml(ability.key         ?? '')}" maxlength="20">
            <input type="text" class="ability-input ability-name" placeholder="Name"        value="${escHtml(ability.name        ?? '')}" maxlength="48">
            <input type="text" class="ability-input ability-desc" placeholder="Description" value="${escHtml(ability.description ?? '')}" maxlength="200">
            <button type="button" class="ability-delete-btn" title="Remove">✕</button>
        `;

        row.querySelectorAll('.ability-reorder-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const dir = btn.dataset.dir;
                if (dir === 'up'   && i > 0)                   [abilities[i - 1], abilities[i]]     = [abilities[i],     abilities[i - 1]];
                if (dir === 'down' && i < abilities.length - 1) [abilities[i],     abilities[i + 1]] = [abilities[i + 1], abilities[i]];
                renderAbilitiesEditor();
            });
        });

        row.querySelector('.ability-key' ).addEventListener('input', e => { abilities[i].key         = e.target.value; });
        row.querySelector('.ability-name').addEventListener('input', e => { abilities[i].name        = e.target.value; });
        row.querySelector('.ability-desc').addEventListener('input', e => { abilities[i].description = e.target.value; });

        row.querySelector('.ability-delete-btn').addEventListener('click', () => {
            abilities.splice(i, 1);
            renderAbilitiesEditor();
        });

        container.appendChild(row);
    });
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;');
}

// ── Modal listeners (wired once) ──────────────────────────────────────────────

function wireModalListeners() {
    document.getElementById('creator-color').addEventListener('input', function () {
        document.getElementById('creator-color-display').textContent = this.value.toUpperCase();
    });

    // Edit modal
    document.getElementById('creator-modal').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeModal();
    });
    document.getElementById('creator-modal-close').addEventListener('click',  closeModal);
    document.getElementById('creator-modal-cancel').addEventListener('click', closeModal);
    document.getElementById('creator-modal-save').addEventListener('click',   saveModal);

    document.getElementById('ability-add-btn').addEventListener('click', () => {
        abilities.push({ key: '', name: '', description: '' });
        renderAbilitiesEditor();
    });

    // View modal
    document.getElementById('creator-view-modal').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeViewModal();
    });
    document.getElementById('creator-view-close').addEventListener('click', closeViewModal);
    document.getElementById('creator-view-edit').addEventListener('click', () => {
        const id = document.getElementById('creator-view-modal').dataset.creatorId;
        const c  = getCreators().find(x => x.id === id);
        closeViewModal();
        if (c) openModal(c);
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeModal(); closeViewModal(); }
    });
}

// ── Edit modal open / close ───────────────────────────────────────────────────

function openModal(creator) {
    editingId = creator?.id ?? null;

    document.getElementById('creator-modal-title').textContent =
        creator ? `Edit — ${creator.name}` : 'New Hero';

    document.getElementById('creator-name').value   = creator?.name   ?? '';
    document.getElementById('creator-season').value = creator?.season != null ? creator.season : '';

    const color = creator?.color ?? '#a612ea';
    document.getElementById('creator-color').value               = color;
    document.getElementById('creator-color-display').textContent = color.toUpperCase();

    document.querySelectorAll('.role-check-btn').forEach(btn => {
        const heroRoles = Array.isArray(creator?.role) ? creator.role : [creator?.role];
        btn.classList.toggle('active', creator ? heroRoles.includes(btn.dataset.role) : false);
    });

    buildImagePicker(creator?.image ?? null);
    buildAbilitiesEditor(creator?.abilities ?? []);

    document.getElementById('tracker-toggle').checked = creator?.addedToTracker ?? false;

    document.getElementById('creator-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('creator-modal').classList.add('hidden');
    editingId = null;
    abilities = [];
}

function saveModal() {
    const name      = document.getElementById('creator-name').value.trim();
    const color     = document.getElementById('creator-color').value;
    const rawSeason = document.getElementById('creator-season').value.trim();
    const season    = rawSeason !== '' ? parseFloat(rawSeason) : null;

    if (!name) { document.getElementById('creator-name').focus(); return; }

    const selectedRoles = [...document.querySelectorAll('.role-check-btn.active')]
        .map(b => b.dataset.role);

    const placeholder = selectedPlaceholderIdx !== null ? placeholders[selectedPlaceholderIdx] : null;

    const savedAbilities = abilities.filter(a =>
        (a.key ?? '').trim() || (a.name ?? '').trim() || (a.description ?? '').trim()
    );

    const creator = {
        id             : editingId ?? crypto.randomUUID(),
        name,
        role           : selectedRoles.length > 0 ? selectedRoles : [],
        color,
        image          : placeholder?.image    ?? '',
        prestige       : placeholder?.prestige ?? placeholder?.image ?? '',
        addedToTracker : document.getElementById('tracker-toggle').checked,
        season         : season !== null && !isNaN(season) ? season : null,
        abilities      : savedAbilities,
        isCustom       : true,
    };

    if (editingId) {
        const existing = getCreators().find(c => c.id === editingId);
        if (existing) creator.created = existing.created;
    } else {
        creator.created = Date.now();
    }

    saveCreator(creator);
    closeModal();
    renderGrid();
}

// ── View modal ────────────────────────────────────────────────────────────────

function openViewModal(creator) {
    const modal = document.getElementById('creator-view-modal');
    modal.dataset.creatorId = creator.id;

    // Banner
    document.getElementById('creator-view-banner').style.setProperty('--hero-color', creator.color ?? '#200630');
    const artEl = document.getElementById('creator-view-art');
    artEl.src = creator.image || '';
    artEl.alt = creator.name;

    document.getElementById('creator-view-name').textContent = creator.name;

    // Roles
    const heroRoles = Array.isArray(creator.role) ? creator.role : [creator.role];
    document.getElementById('creator-view-roles').innerHTML = heroRoles.map(r => {
        const ro = roles.find(x => x.name === r);
        return ro
            ? `<span class="creator-view-role-badge"><img src="${ro.icon}" alt="${r}"><span>${r}</span></span>`
            : '';
    }).join('');

    // Season
    const seasonEl = document.getElementById('creator-view-season');
    if (creator.season != null) {
        seasonEl.textContent = `Season ${creator.season}`;
        seasonEl.classList.remove('hidden');
    } else {
        seasonEl.classList.add('hidden');
    }

    // Abilities
    const hasAbilities = Array.isArray(creator.abilities) && creator.abilities.length > 0;
    document.getElementById('creator-view-abilities').classList.toggle('hidden', !hasAbilities);
    document.getElementById('creator-view-abilities-empty').classList.toggle('hidden', hasAbilities);

    if (hasAbilities) {
        document.getElementById('creator-view-abilities-list').innerHTML =
            creator.abilities.map(a => `
                <tr class="view-ability-row">
                    <td class="view-ability-key">${escHtml(a.key ?? '')}</td>
                    <td class="view-ability-name">${escHtml(a.name ?? '')}</td>
                    <td class="view-ability-desc">${escHtml(a.description ?? '')}</td>
                </tr>
            `).join('');
    }

    modal.classList.remove('hidden');
}

function closeViewModal() {
    document.getElementById('creator-view-modal').classList.add('hidden');
}

init();