import { exportData, importData, clearAllData, getSettings, setSettings, getProfile } from './state.js';

// ── Apply saved settings on load ──────────────────────────────────────────────

function applySetting(key, value) {
    if (key === 'theme') {
        document.documentElement.dataset.theme = value === 'galacta' ? '' : value;
        // Update mobile browser chrome colour
        const themeColors = { galacta: '#a612ea', rivals: '#FFFF00', symbiote: '#ffffff', xmen: '#e6ea12' };
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = themeColors[value] ?? '#a612ea';
    }
    if (key === 'showHoverImage') {
        document.documentElement.dataset.hoverImage = value;
    }
}

function loadSettings() {
    const s = getSettings();
    // Sync option buttons to current state
    document.querySelectorAll('.option-btn').forEach(btn => {
        const { setting, value } = btn.dataset;
        btn.classList.toggle('active', (s[setting] ?? getDefaultSetting(setting)) === value);
    });
}

function getDefaultSetting(key) {
    const defaults = { theme: 'galacta', cardBgMode: 'hero', viewMode: 'card', showName: 'on', showProficiency: 'on', showHoverImage: 'on', showCostumes: 'on', showRoleIcons: 'on' };
    return defaults[key] ?? null;
}

// ── Option buttons ────────────────────────────────────────────────────────────

document.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const { setting, value } = btn.dataset;
        // Deactivate siblings in same group
        document.querySelectorAll(`.option-btn[data-setting="${setting}"]`)
            .forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setSettings({ [setting]: value });
        applySetting(setting, value);
    });
});

// ── Export ────────────────────────────────────────────────────────────────────

document.getElementById('export-btn').addEventListener('click', () => {
    // 1. Retrieve name
    const profile = getProfile();
    const rawName = profile.name || '';
    // 2. Sanitize name
    const safeName = rawName.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '_') || 'backup';
    const fileName = `galactas-guide-${safeName}.json`;
    // 3. Inject clean name into download
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
        href: url,
        download: fileName,
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showNotice('Data exported', 'success')
});

// ── Import ────────────────────────────────────────────────────────────────────

document.getElementById('import-file').addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const ok = importData(e.target.result);
        showNotice(
            ok ? 'Data imported successfully!' : 'Invalid file — import failed.',
            ok ? 'success' : 'error',
        );
        if (ok) { this.value = ''; loadSettings(); }
    };
    reader.readAsText(file);
});

// ── Clear ─────────────────────────────────────────────────────────────────────

document.getElementById('clear-btn').addEventListener('click', () => {
    if (confirm('Clear ALL saved data? This cannot be undone.')) {
        clearAllData();
        setSettings({ viewMode: 'card', showName: 'on', showProficiency: 'on', showHoverImage: 'on', showCostumes: 'on', showRoleIcons: 'on' });
        document.documentElement.dataset.theme = '';
        showNotice('All data cleared.', 'success');
        loadSettings();
    }
});

// ── Notice helper ─────────────────────────────────────────────────────────────

function showNotice(message, type) {
    const el = document.getElementById('notice');
    el.textContent = message;
    el.className   = `notice ${type}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3500);
}

loadSettings();

// ── Costume catalog ───────────────────────────────────────────────────────────
 
let catalogData = null; // cached after first fetch
 
async function openCatalog() {
    const modal = document.getElementById('costume-catalog-modal');
    modal.classList.remove('hidden');
 
    if (catalogData) return; // already built
 
    try {
        const [costumes, rarities] = await Promise.all([
            fetch('../app/costumes.json').then(r => r.json()),
            fetch('../app/rarities.json').then(r => r.json()),
        ]);
        catalogData = { costumes, rarities };
        buildCatalog(costumes, rarities);
    } catch {
        document.getElementById('costume-catalog-list').innerHTML =
            '<p style="opacity:0.4;font-size:0.85rem">Could not load costume data.</p>';
    }
}
 
function buildCatalog(costumes, rarities) {
    // Subtitle: total count
    const heroCount = new Set(costumes.map(c => c.hero)).size;
    document.getElementById('catalog-subtitle').textContent =
        `${costumes.length} Costume${costumes.length !== 1 ? 's' : ''} across ${heroCount} Hero${heroCount !== 1 ? 'es' : ''}`;
 
    // Group by hero (preserving order from JSON)
    const groups = {};
    costumes.forEach(c => {
        if (!groups[c.hero]) groups[c.hero] = [];
        groups[c.hero].push(c);
    });
 
    const container = document.getElementById('costume-catalog-list');
    container.innerHTML = '';
 
    Object.entries(groups).forEach(([hero, list]) => {
        const group = document.createElement('div');
        group.className = 'catalog-group';
 
        const heading = document.createElement('div');
        heading.className = 'catalog-hero-name';
        heading.textContent = `${hero}`;
        group.appendChild(heading);
 
        list.forEach(costume => {
            const rarity = rarities.find(r => r.name === costume.rarity);
            const row    = document.createElement('div');
            row.className = 'catalog-item';
 
            row.innerHTML = `
                ${costume.icon
                    ? `<img src="${costume.icon}" alt="${costume.name}" class="catalog-icon">`
                    : `<div class="catalog-icon-placeholder"></div>`}
                <span class="catalog-name">${costume.name}</span>
                <span class="catalog-rarity" style="color:${rarity?.color ?? 'inherit'}">
                    ${rarity?.icon ? `<img src="${rarity.icon}" alt="" class="rarity-icon">` : ''}
                    ${costume.rarity}
                </span>
            `;
            group.appendChild(row);
        });
 
        container.appendChild(group);
    });
}
 
document.getElementById('costume-catalog-btn').addEventListener('click', openCatalog);
 
document.getElementById('costume-catalog-close').addEventListener('click', () => {
    document.getElementById('costume-catalog-modal').classList.add('hidden');
});
 
document.getElementById('costume-catalog-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget)
        document.getElementById('costume-catalog-modal').classList.add('hidden');
});
