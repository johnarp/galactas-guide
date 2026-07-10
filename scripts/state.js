/**
 * state.js — All localStorage read/write lives here.
 * Every page imports from this file; nothing else touches localStorage directly.
 */

const KEY = 'gg';

// ── Core helpers ────────────────────────────────────────────────────────────

export function getState() {
    try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; }
    catch { return {}; }
}

function setState(updater) {
    const next = typeof updater === 'function' ? updater(getState()) : { ...getState(), ...updater };
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
}

// ── Hero tracking ────────────────────────────────────────────────────────────

export const getHeroData = name =>
    getState().heroes?.[name] ?? null;

export const setHeroData = (name, data) =>
    setState(s => ({ ...s, heroes: { ...(s.heroes ?? {}), [name]: data } }));

export const clearHeroData = name =>
    setState(s => {
        const heroes = { ...(s.heroes ?? {}) };
        delete heroes[name];
        return { ...s, heroes };
    });

// ── Favorites ────────────────────────────────────────────────────────────────

export const getFavorites = () => getState().favorites ?? [];

export const toggleFavorite = name =>
    setState(s => {
        const set = new Set(s.favorites ?? []);
        set.has(name) ? set.delete(name) : set.add(name);
        return { ...s, favorites: [...set] };
    });

// ── Profile ──────────────────────────────────────────────────────────────────

export const getProfile = () => getState().profile ?? {};

export const setProfile = data =>
    setState(s => ({ ...s, profile: { ...(s.profile ?? {}), ...data } }));

// ── Import / Export / Clear ──────────────────────────────────────────────────

// export const exportData = () => localStorage.getItem(KEY) ?? '{}';
export const exportData = () => JSON.stringify(getState(), null, 2);

export function importData(json) {
    try {
        JSON.parse(json); // validate before writing
        localStorage.setItem(KEY, json);
        return true;
    } catch {
        return false;
    }
}

export const clearAllData = () => localStorage.removeItem(KEY);
// ── App settings (theme, cardBgMode, etc.) ────────────────────────────────────

export const getSettings = () => getState().settings ?? {};

export const setSettings = data =>
    setState(s => ({ ...s, settings: { ...(s.settings ?? {}), ...data } }));

// ── Creator heroes ────────────────────────────────────────────────────────────

export const getCreators = () => getState().creators ?? [];

export const saveCreator = creator =>
    setState(s => {
        const list = s.creators ?? [];
        const idx  = list.findIndex(c => c.id === creator.id);
        const next = idx >= 0
            ? list.map((c, i) => i === idx ? creator : c)
            : [...list, creator];
        return { ...s, creators: next };
    });

export const deleteCreator = id =>
    setState(s => ({ ...s, creators: (s.creators ?? []).filter(c => c.id !== id) }));

// ── UI Preferences (Search, Filters, Sort) ───────────────────────────────────

export const getUIPrefs = () => getState().uiPrefs ?? {};

export const setUIPrefs = data =>
    setState(s => ({ ...s, uiPrefs: { ...(s.uiPrefs ?? {}), ...data } }));

// ── Icon preferences ──────────────────────────────────────────────────────────

export const getIconPref = name =>
    getState().iconPrefs?.[name] ?? 0;

export const setIconPref = (name, idx) =>
    setState(s => ({ ...s, iconPrefs: { ...(s.iconPrefs ?? {}), [name]: idx } }));
// ── Costume data ──────────────────────────────────────────────────────────────

export const getCostumeData = hero =>
    getState().costumes?.[hero] ?? null;

export const setCostumeData = (hero, data) =>
    setState(s => ({ ...s, costumes: { ...(s.costumes ?? {}), [hero]: data } }));

export const clearCostumeData = hero =>
    setState(s => {
        const c = { ...(s.costumes ?? {}) };
        delete c[hero];
        return { ...s, costumes: c };
    });