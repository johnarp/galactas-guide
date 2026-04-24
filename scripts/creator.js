import { getCreators, saveCreator, deleteCreator } from './state.js';

let roles        = [];
let placeholders = [];  // loaded from app/creator.json
let editingId    = null;
let selectedPlaceholderIdx = null;

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
    [roles, placeholders] = await Promise.all([
        fetch('../app/roles.json').then(r => r.json()).catch(() => []),
        fetch('../app/creator.json').then(r => r.json()).catch(() => []),
    ]);

    buildRolePickers();
    wireModalListeners();
    renderGrid();
}

// ── Grid ──────────────────────────────────────────────────────────────────────

function renderGrid() {
    const grid = document.getElementById('creator-grid');
    grid.innerHTML = '';

    const addCard = document.createElement('div');
    addCard.className = 'creator-add-card';
    addCard.innerHTML = `<span class="creator-add-icon">+</span><span>New Hero</span>`;
    addCard.addEventListener('click', () => openModal(null));
    grid.appendChild(addCard);

    getCreators().forEach(c => grid.appendChild(buildCreatorCard(c)));
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

    return card;
}

// ── Role pickers ──────────────────────────────────────────────────────────────

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

    // Match current image path to a placeholder index
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
        img.src     = p.image;
        img.alt     = `Placeholder ${i + 1}`;
        img.loading = 'lazy';
        opt.appendChild(img);

        opt.addEventListener('click', () => {
            container.querySelectorAll('.image-picker-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            selectedPlaceholderIdx = i;
        });

        container.appendChild(opt);
    });
}

// ── Modal listeners (wired once) ──────────────────────────────────────────────

function wireModalListeners() {
    document.getElementById('creator-color').addEventListener('input', function () {
        document.getElementById('creator-color-display').textContent = this.value.toUpperCase();
    });

    document.getElementById('creator-modal').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeModal();
    });
    document.getElementById('creator-modal-close').addEventListener('click',  closeModal);
    document.getElementById('creator-modal-cancel').addEventListener('click', closeModal);
    document.getElementById('creator-modal-save').addEventListener('click',   saveModal);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

// ── Modal open / close ────────────────────────────────────────────────────────

function openModal(creator) {
    editingId = creator?.id ?? null;

    document.getElementById('creator-modal-title').textContent =
        creator ? `Edit — ${creator.name}` : 'New Hero';

    document.getElementById('creator-name').value = creator?.name ?? '';

    const color = creator?.color ?? '#a612ea';
    document.getElementById('creator-color').value               = color;
    document.getElementById('creator-color-display').textContent = color.toUpperCase();

    document.querySelectorAll('.role-check-btn').forEach(btn => {
        const heroRoles = Array.isArray(creator?.role) ? creator.role : [creator?.role];
        btn.classList.toggle('active', creator ? heroRoles.includes(btn.dataset.role) : false);
    });

    buildImagePicker(creator?.image ?? null);

    document.getElementById('tracker-toggle').checked = creator?.addedToTracker ?? false;

    document.getElementById('creator-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('creator-modal').classList.add('hidden');
    editingId = null;
}

function saveModal() {
    const name  = document.getElementById('creator-name').value.trim();
    const color = document.getElementById('creator-color').value;

    if (!name) { document.getElementById('creator-name').focus(); return; }

    const selectedRoles = [...document.querySelectorAll('.role-check-btn.active')]
        .map(b => b.dataset.role);

    const placeholder = selectedPlaceholderIdx !== null ? placeholders[selectedPlaceholderIdx] : null;

    const creator = {
        id             : editingId ?? crypto.randomUUID(),
        name,
        role           : selectedRoles.length > 0 ? selectedRoles : [],
        color,
        image          : placeholder?.image    ?? '',
        prestige       : placeholder?.prestige ?? placeholder?.image ?? '',
        addedToTracker : document.getElementById('tracker-toggle').checked,
        season         : null,
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

init();