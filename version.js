// ===== CHANGELOG =====
// Add a new entry to the START of this list whenever BAILIFF_VERSION is
// bumped. Only the newest entry (index 0) is ever shown to a returning user
// (via the "What's New" popup below) — even if they skipped several
// versions since their last visit.
const CHANGELOG = [
    {
        version: 'v2.6.0',
        date: '08/12/26',
        summary: 'See how long each section actually ran.',
        bullets: [
            'Stopped blocks on the timer page now show an "Elapsed" time alongside the remaining/total display',
            'Elapsed time turns red if a section ran past its allotted time'
        ]
    },
    {
        version: 'v2.5.0',
        date: '08/12/26',
        summary: 'Turn a saved trial into a shareable image.',
        bullets: [
            'New "Image" export format alongside Plain Text and JSON: a docket-style poster with the schedule and progress',
            'Copy the image straight to your clipboard, or download it as a PNG'
        ]
    },
    {
        version: 'v2.4.0',
        date: '08/12/26',
        summary: 'Take your saved trials with you.',
        bullets: [
            'Export any saved trial as a readable summary or a JSON file',
            'Copy an export to your clipboard, or download it as a file',
            "Import trials from a JSON file: drag & drop it in, browse for it, or paste it directly"
        ]
    }
];

const BAILIFF_VERSION = CHANGELOG[0].version;
const LAST_SEEN_VERSION_KEY = 'bailiff_last_seen_version';

function buildChangelogOverlay(entry) {
    const style = document.createElement('style');
    style.textContent = `
        #changelog-overlay .changelog-list {
            text-align: left;
            margin: 0 0 24px 0;
            padding-left: 20px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-size: 0.8rem;
            color: #b0a190;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            line-height: 1.5;
        }
        #changelog-overlay .changelog-list li::marker {
            color: #c9a84c;
        }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay hidden';
    overlay.id = 'changelog-overlay';

    const dateStr = entry.date ? ' (' + entry.date + ')' : '';
    const bulletsHtml = (entry.bullets || []).map(b => '<li>' + b + '</li>').join('');

    overlay.innerHTML = `
        <div class="confirm-dialog">
            <div class="confirm-seal">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 8m0 1a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z" />
                    <path d="M12 8l0 13" />
                    <path d="M19 12l0 7a2 2 0 0 1 -2 2l-10 0a2 2 0 0 1 -2 -2l0 -7" />
                    <path d="M7.5 8a2.5 2.5 0 0 1 0 -5c1.5 0 3 1.5 4.5 5c1.5 -3.5 3 -5 4.5 -5a2.5 2.5 0 0 1 0 5" />
                </svg>
            </div>
            <h3>What's New: ${entry.version}${dateStr}</h3>
            ${entry.summary ? '<p>' + entry.summary + '</p>' : ''}
            ${bulletsHtml ? '<ul class="changelog-list">' + bulletsHtml + '</ul>' : ''}
            <div class="confirm-actions">
                <button class="confirm-btn confirm-save" id="changelog-ok">Got it</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#changelog-ok').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    overlay.classList.remove('hidden');
}

function maybeShowChangelog() {
    const latest = CHANGELOG[0];
    if (!latest || latest.version !== BAILIFF_VERSION) return;

    try {
        const lastSeen = localStorage.getItem(LAST_SEEN_VERSION_KEY);
        localStorage.setItem(LAST_SEEN_VERSION_KEY, BAILIFF_VERSION);
        // First-ever visit, or already seen this version — stay quiet.
        if (lastSeen === null || lastSeen === BAILIFF_VERSION) return;
        buildChangelogOverlay(latest);
    } catch {}
}

document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('version-footer');
    if (el) el.textContent = BAILIFF_VERSION;
    maybeShowChangelog();
});
