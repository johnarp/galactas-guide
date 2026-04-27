import { exportData, importData, clearAllData, getSettings, setSettings } from './state.js';

// ── Apply saved settings on load ──────────────────────────────────────────────

function applySetting(key, value) {
    if (key === 'theme') {
        document.documentElement.dataset.theme = value === 'galacta' ? '' : value;
        // Update mobile browser chrome colour
        const themeColors = { galacta: '#a612ea', rivals: '#282A31', symbiote: '#131313' };
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = themeColors[value] ?? '#a612ea';
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
    const defaults = { theme: 'galacta', cardBgMode: 'hero', viewMode: 'card', showName: 'on', showProficiency: 'on' };
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
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
        href: url, download: 'galactas-guide-backup.json',
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showNotice('Data exported!', 'success');
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
        setSettings({ viewMode: 'card', showName: 'on', showProficiency: 'on' });
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