import { getProfile, setProfile, getState, getCreators } from './state.js';

// Global variables for caching asset configuration data
let heroesList = [];
let rolesList = [];

async function init() {
    const profile = getProfile();
    const state = getState();
    const tracked = state.heroes ?? {};
    setupModal();

    // 1. Fetch system JSON files required to paint accurate imagery inside tooltips
    try {
        const [hRes, roRes] = await Promise.all([
            fetch('../app/heroes.json').then(r => r.json()).catch(() => []),
            fetch('../app/roles.json').then(r => r.json()).catch(() => [])
        ]);

        const customHeroes = getCreators().filter(c => c.addedToTracker);
        heroesList = [...hRes, ...customHeroes];
        rolesList = roRes;
    } catch (e) {
        console.error("Failed loading dependencies for profile tooltips:", e);
    }

    // // 2. Name input management
    // const nameInput = document.getElementById('profile-name-input');
    // if (nameInput) {
    //     nameInput.value = profile.name ?? '';
    //     nameInput.addEventListener('input', () => setProfile({ name: nameInput.value }));
    // }

    if (!profile.nameplate) profile.nameplate = "Adam Warlock";
    if (!profile.displayHero) profile.displayHero = "Adam Warlock";
    if (!profile.displayStyle) profile.displayStyle = "image"; // 'image' or 'prestige'

    updateProfileVisuals(profile);
    setupCustomization(profile);

    // 3. Concepts count (Custom creation statistics)
    const concepts = getCreators();
    const conceptsNumEl = document.getElementById('concepts-number');
    if (conceptsNumEl) conceptsNumEl.textContent = concepts.length;

    // 4. Calculate Account Level Metrics (Sum and Average)
    calculateLevelMetrics(tracked);

    // 5. Rank breakdown construction
    try {
        const ranks = await fetch('../app/ranks.json').then(r => r.json());
        buildBreakdown(tracked, ranks);
    } catch {
        document.getElementById('rank-breakdown').innerHTML =
            '<p style="opacity:0.4;font-size:0.85rem">Could not load rank data.</p>';
    }
}

function calculateLevelMetrics(tracked) {
    const levelValues = Object.values(tracked).map(h => parseInt(h.level, 10) || 0);

    // Sum total account level across all matched entries
    const aggregateLevel = levelValues.reduce((sum, current) => sum + current, 0);
    const accountLevelEl = document.getElementById('account-level');
    if (accountLevelEl) {
        accountLevelEl.textContent = `LVL ${aggregateLevel}`;
    }

    // Average hero level computation (rounded cleanly down to nearest single point integer)
    const averageLevelEl = document.getElementById('breakdown-avg');
    if (averageLevelEl) {
        if (levelValues.length > 0) {
            const mathematicalMean = levelValues.reduce((a, b) => a + b, 0) / levelValues.length;
            averageLevelEl.textContent = `Average Hero Level: ${Math.round(mathematicalMean)}`;
        } else {
            averageLevelEl.textContent = `Average Hero Level: 0`;
        }
    }
}

function buildBreakdown(tracked, ranks) {
    const container = document.getElementById('rank-breakdown');
    container.innerHTML = '';

    // Step A: Map out layout counts and arrays tracking exactly who belongs to which rank
    const counts = {};
    const rankIdentityMap = {};

    ranks.forEach(r => {
        counts[r.title] = 0;
        rankIdentityMap[r.title] = [];
    });

    Object.entries(tracked).forEach(([heroKeyName, trackingRecord]) => {
        if (trackingRecord.rank && counts[trackingRecord.rank] !== undefined) {
            counts[trackingRecord.rank] += 1;
            rankIdentityMap[trackingRecord.rank].push(heroKeyName);
        }
    });

    const maxCount = Math.max(1, ...Object.values(counts));

    // Step B: Loop design elements onto the UI breakdown board
    ranks.forEach(rank => {
        const count = counts[rank.title] ?? 0;
        const pct = (count / maxCount) * 100;
        const associatedHeroes = rankIdentityMap[rank.title];

        // Unique ID reference keying layout dropdown areas accurately
        const standardizedSlug = rank.title.toLowerCase().replace(/[^a-z0-9]/g, '-');

        const row = document.createElement('div');
        row.className = 'rank-row-container'; // New wrapping container structural component
        row.innerHTML = `
            <div class="rank-row">
                <img src="${rank.icon}" alt="${rank.title}" class="rank-row-icon">
                <span class="rank-row-name">${rank.title}</span>
                <div class="rank-bar-track">
                    <div class="rank-bar-fill" style="--rank-color: ${rank.color ?? 'var(--primary)'}; width: 0%"></div>
                </div>
                <span class="rank-row-count${count > 0 ? ' has-heroes' : ''}" 
                      data-target="panel-${standardizedSlug}" 
                      role="${count > 0 ? 'button' : 'text'}">
                    ${count > 0 ? count : '—'}
                </span>
            </div>
            <div class="rank-heroes-drawer hidden" id="panel-${standardizedSlug}">
                <div class="drawer-grid-list"></div>
            </div>
        `;
        container.appendChild(row);

        // Step C: If heroes populate this rank row, build their avatar nodes inside the toggleable sub-grid
        if (count > 0) {
            const drawerGridList = row.querySelector('.drawer-grid-list');
            associatedHeroes.sort((a, b) => a.localeCompare(b)).forEach(heroName => {
                const systemicHeroData = heroesList.find(h => h.name === heroName);
                // Graceful fallback to default asset directory pattern or custom object links
                const absoluteAvatarImg = systemicHeroData ? (systemicHeroData.icon || systemicHeroData.image) : `../assets/heroes/${heroName.toLowerCase().replace(/\s+/g, '-')}/icon.png`;

                const thumbNode = document.createElement('div');
                thumbNode.className = 'drawer-hero-avatar-thumb';
                thumbNode.title = heroName;
                thumbNode.innerHTML = `<img src="${absoluteAvatarImg}" alt="${heroName}" onerror="this.src='../assets/heroes/default-icon.png'">`;
                drawerGridList.appendChild(thumbNode);
            });

            // Handle clicking numbers on mobile/desktop screens cleanly
            const clickTrigger = row.querySelector('.rank-row-count');
            clickTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetId = clickTrigger.dataset.target;
                const activeDrawer = document.getElementById(targetId);

                if (activeDrawer) {
                    const isClosed = activeDrawer.classList.contains('hidden');

                    // Close all open drawers on the profile layout page to keep views compact
                    document.querySelectorAll('.rank-heroes-drawer').forEach(d => d.classList.add('hidden'));
                    document.querySelectorAll('.rank-row-count').forEach(c => c.classList.remove('drawer-active'));

                    if (isClosed) {
                        activeDrawer.classList.remove('hidden');
                        clickTrigger.classList.add('drawer-active');
                    }
                }
            });
        }

        // Animate progress filling animations safely
        requestAnimationFrame(() =>
            requestAnimationFrame(() => {
                const fillBar = row.querySelector('.rank-bar-fill');
                if (fillBar) fillBar.style.width = `${pct}%`;
            })
        );
    });
}

function setupModal() {
    const levelBadge = document.getElementById('account-level');
    const modal = document.getElementById('level-modal');
    const closeBtn = document.getElementById('close-level-modal');

    if (!levelBadge || !modal) return;

    // Open modal on badge click
    levelBadge.addEventListener('click', () => {
        modal.classList.remove('hidden');
    });

    // Close on 'X' click
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }

    // Close if the user clicks the dark background overlay
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
}

function updateProfileVisuals(profile) {
    // Update Name
    const nameDisplay = document.getElementById('profile-display-name');
    if (nameDisplay) nameDisplay.textContent = profile.name || 'Player';

    // Update Nameplate
    const nameplateEl = document.getElementById('current-nameplate');
    const nameplateHeroData = heroesList.find(h => h.name === profile.nameplate);
    if (nameplateEl && nameplateHeroData && nameplateHeroData.nameplate) {
        nameplateEl.style.backgroundImage = `url('${nameplateHeroData.nameplate}')`;
    }

    // Update Display Hero Image
    const displayHeroEl = document.getElementById('profile-display-hero');
    const displayHeroData = heroesList.find(h => h.name === profile.displayHero);
    if (displayHeroEl && displayHeroData) {
        // Fallback to base image if prestige doesn't exist for a custom hero
        const imgPath = (profile.displayStyle === 'prestige' && displayHeroData.prestige)
            ? displayHeroData.prestige
            : displayHeroData.image;
        displayHeroEl.src = imgPath;
    }
}

function setupCustomization(profile) {
    const modal = document.getElementById('customize-modal');
    const openBtn = document.getElementById('open-customize-btn');
    const closeBtn = document.getElementById('close-customize-modal');

    const nameInput = document.getElementById('modal-name-input');
    const nameplateGrid = document.getElementById('nameplate-grid');
    const displayGrid = document.getElementById('display-hero-grid');
    const styleContainer = document.getElementById('style-selector-container');
    const styleBase = document.getElementById('style-base');
    const stylePrestige = document.getElementById('style-prestige');

    if (!modal || !openBtn) return;

    // Sort heroes alphabetically to make finding them easier
    const sortedHeroes = [...heroesList].sort((a, b) => a.name.localeCompare(b.name));

    // 1. Build Nameplate Grid (Only heroes with nameplates)
    nameplateGrid.innerHTML = '';
    sortedHeroes.forEach(hero => {
        if (!hero.nameplate) return;
        const img = document.createElement('img');
        img.src = hero.icon;
        img.title = hero.name;
        if (hero.name === profile.nameplate) img.classList.add('selected-icon');

        img.addEventListener('click', () => {
            nameplateGrid.querySelectorAll('img').forEach(el => el.classList.remove('selected-icon'));
            img.classList.add('selected-icon');
            profile.nameplate = hero.name;
            setProfile({ nameplate: hero.name });
            updateProfileVisuals(profile);
        });
        nameplateGrid.appendChild(img);
    });

    // 2. Build Display Hero Grid
    displayGrid.innerHTML = '';
    sortedHeroes.forEach(hero => {
        if (!hero.image) return;
        const img = document.createElement('img');
        img.src = hero.icon;
        img.title = hero.name;
        if (hero.name === profile.displayHero) img.classList.add('selected-icon');

        img.addEventListener('click', () => {
            displayGrid.querySelectorAll('img').forEach(el => el.classList.remove('selected-icon'));
            img.classList.add('selected-icon');

            profile.displayHero = hero.name;
            setProfile({ displayHero: hero.name });

            // Show style selector for chosen hero
            updateStyleSelector(hero, profile);
            updateProfileVisuals(profile);
        });
        displayGrid.appendChild(img);
    });

    // 3. Handle Prestige vs Base Style Clicks
    [styleBase, stylePrestige].forEach(card => {
        card.addEventListener('click', () => {
            const styleType = card.dataset.style;
            profile.displayStyle = styleType;
            setProfile({ displayStyle: styleType });

            // Update UI selections
            styleBase.classList.remove('selected-style');
            stylePrestige.classList.remove('selected-style');
            card.classList.add('selected-style');

            updateProfileVisuals(profile);
        });
    });

    function updateStyleSelector(heroData, currentProfile) {
        styleContainer.classList.remove('hidden');

        // Populate the images in the style cards
        styleBase.querySelector('img').src = heroData.image;

        const prestigeImg = stylePrestige.querySelector('img');
        if (heroData.prestige) {
            prestigeImg.src = heroData.prestige;
            stylePrestige.style.display = 'block';
        } else {
            stylePrestige.style.display = 'none'; // Hide if hero has no prestige art
            currentProfile.displayStyle = 'image'; // Force base if no prestige
        }

        // Highlight the currently active style
        styleBase.classList.remove('selected-style');
        stylePrestige.classList.remove('selected-style');
        if (currentProfile.displayStyle === 'prestige' && heroData.prestige) {
            stylePrestige.classList.add('selected-style');
        } else {
            styleBase.classList.add('selected-style');
        }
    }

    // 4. Modal Open/Close Logic
    openBtn.addEventListener('click', () => {
        nameInput.value = profile.name || '';

        // Pre-load the style selector for the currently equipped hero
        const currentHeroData = heroesList.find(h => h.name === profile.displayHero);
        if (currentHeroData) updateStyleSelector(currentHeroData, profile);

        modal.classList.remove('hidden');
    });

    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });

    // 5. Name Input Live Update
    nameInput.addEventListener('input', (e) => {
        const newName = e.target.value;
        profile.name = newName;
        setProfile({ name: newName });
        updateProfileVisuals(profile);
    });
}

init();