import { getProfile, setProfile, getState, getCreators } from './state.js';

async function init() {
    const profile = getProfile();
    const state   = getState();
    const tracked = state.heroes ?? {};

    // Name input
    const nameInput = document.getElementById('profile-name-input');
    nameInput.value = profile.name ?? '';
    nameInput.addEventListener('input', () => setProfile({ name: nameInput.value }));

    // Concepts count
    const concepts = getCreators();
    document.getElementById('concepts-number').textContent = concepts.length;

    // Rank breakdown
    try {
        const ranks = await fetch('../app/ranks.json').then(r => r.json());
        buildBreakdown(tracked, ranks);
    } catch {
        document.getElementById('rank-breakdown').innerHTML =
            '<p style="opacity:0.4;font-size:0.85rem">Could not load rank data.</p>';
    }
}

function buildBreakdown(tracked, ranks) {
    const container = document.getElementById('rank-breakdown');
    container.innerHTML = '';

    // Count heroes per rank
    const counts = {};
    Object.values(tracked).forEach(d => {
        if (d.rank) counts[d.rank] = (counts[d.rank] ?? 0) + 1;
    });

    const maxCount = Math.max(1, ...Object.values(counts));

    ranks.forEach(rank => {
        const count = counts[rank.title] ?? 0;
        const pct   = (count / maxCount) * 100;

        const row = document.createElement('div');
        row.className = 'rank-row';
        row.innerHTML = `
            <img src="${rank.icon}" alt="${rank.title}" class="rank-row-icon">
            <span class="rank-row-name">${rank.title}</span>
            <div class="rank-bar-track">
                <div class="rank-bar-fill" style="--rank-color: ${rank.color ?? 'var(--primary)'}; width: 0%"></div>
            </div>
            <span class="rank-row-count${count > 0 ? ' has-heroes' : ''}">${count > 0 ? count : '—'}</span>
        `;
        container.appendChild(row);

        // Animate bar in after paint
        requestAnimationFrame(() =>
            requestAnimationFrame(() => {
                row.querySelector('.rank-bar-fill').style.width = `${pct}%`;
            })
        );
    });
}

init();