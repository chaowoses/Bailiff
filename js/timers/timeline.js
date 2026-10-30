import { escapeHtml } from '../shared/dom-utils.js';
import { formatTime } from '../shared/time.js';
import { state, saveTimerSession } from './state.js';
import { getCurrentTimeable, getCurrentParentBlock } from './engine.js';
import { countdown, currentBlockName, timeLabel } from './dom.js';

// The timeline is a flat, append-only log of what happened during the trial.
// Timer actions log themselves (start/pause/stop — see controls.js); flags
// are dropped by hand at any moment without touching the clock. A pause is a
// single *section* rather than a pause + resume pair: it stays open until the
// timer resumes or stops, then records how long it lasted and how it was
// ruled on, so a note on it describes that whole stretch.
//
// Entry shape: { id, type: 'start'|'pause'|'stop'|'flag', at (epoch ms),
// team, blockName, witnessName, clock (timer reading, seconds), note,
// and for pauses: endedAt, ruling }.

const ICON_X = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const SORT_KEY = 'bailiff_timeline_sort';

const TYPE_LABELS = { start: 'Started', pause: 'Paused', stop: 'Stopped', flag: 'Flag' };

const flagBtns = [document.getElementById('flag-btn'), document.getElementById('timeline-flag-btn')];
const flagInputs = [document.getElementById('flag-note-input'), document.getElementById('timeline-flag-input')];
const listEl = document.getElementById('timeline-list');
const countEl = document.getElementById('timeline-count');
const viewTabs = document.querySelectorAll('.view-tab');
const showFlagsEl = document.getElementById('timeline-show-flags');
const navEl = document.getElementById('timeline-nav');
const navToggle = document.getElementById('timeline-nav-toggle');
const sortBtn = document.getElementById('timeline-sort');

// Ascending (oldest first) is the default; descending puts the newest on top.
let sortDesc = false;
try { sortDesc = localStorage.getItem(SORT_KEY) === 'desc'; } catch {}

function renderSortButton() {
    sortBtn.textContent = sortDesc ? '↓ Newest first' : '↑ Oldest first';
}

// Jumps to the end where new entries land: the bottom when ascending, the top when descending.
function scrollToLatest() {
    listEl.scrollTop = sortDesc ? 0 : listEl.scrollHeight;
}
const nowBlockEl = document.getElementById('timeline-now-block');
const nowTimeEl = document.getElementById('timeline-now-time');
const nowLabelEl = document.getElementById('timeline-now-label');

function pad2(n) {
    return String(n).padStart(2, '0');
}

function formatClockSeconds(ms) {
    const d = new Date(ms);
    let h = d.getHours() % 12;
    if (h === 0) h = 12;
    return `${pad2(h)}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
}

function formatHms(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
}

const SIDES = {
    left: { label: 'Plaintiff / Prosecution', name: () => state.leftTeamName },
    right: { label: 'Defense', name: () => state.rightTeamName }
};

// Filter values, narrowest last: "team" (that whole side), "team\tblock"
// (every witness in the block), "team\tblock\twitness" (just that witness).
const SEP = '\t';

function matchesFilter(ev, filter) {
    if (!filter) return true;
    const [team, block, witness] = filter.split(SEP);
    if (ev.team !== team) return false;
    if (block === undefined) return true;
    if (ev.blockName !== block) return false;
    return witness === undefined || ev.witnessName === witness;
}

const attr = (text) => escapeHtml(text).replace(/"/g, '&quot;');

let activeFilter = '';

// The side menu lists each side that has entries, then its blocks and their
// witnesses in order of first appearance, with a count on each. Counts follow
// the Show flags toggle so they match what the list would show.
function renderNav(showFlags) {
    const tree = { left: new Map(), right: new Map() };
    state.timeline.forEach(ev => {
        if (!tree[ev.team]) return;
        if (!tree[ev.team].has(ev.blockName)) tree[ev.team].set(ev.blockName, new Set());
        if (ev.witnessName) tree[ev.team].get(ev.blockName).add(ev.witnessName);
    });

    const values = new Set(['']);
    const count = (value) => state.timeline.filter(ev => (showFlags || ev.type !== 'flag') && matchesFilter(ev, value)).length;
    const item = (value, label, cls) => {
        values.add(value);
        return `<button type="button" class="tl-nav-item ${cls}${value === activeFilter ? ' selected' : ''}" data-value="${attr(value)}">` +
            `<span class="tl-nav-label">${escapeHtml(label)}</span><span class="tl-nav-count">${count(value)}</span></button>`;
    };

    let html = item('', 'All entries', 'tl-nav-all');
    ['left', 'right'].forEach(team => {
        if (!tree[team].size) return;
        html += `<div class="tl-nav-side"><div class="tl-nav-side-label">${SIDES[team].label}</div>` +
            item(team, SIDES[team].name(), 'tl-nav-team');
        tree[team].forEach((witnesses, block) => {
            const blockValue = team + SEP + block;
            html += item(blockValue, block, 'tl-nav-block');
            witnesses.forEach(w => { html += item(blockValue + SEP + w, w, 'tl-nav-witness'); });
        });
        html += '</div>';
    });

    // A filter whose entries are all gone (e.g. flags deleted) falls back to everything.
    if (!values.has(activeFilter)) {
        activeFilter = '';
        return renderNav(showFlags);
    }
    navEl.innerHTML = html;
}

navEl.addEventListener('click', (e) => {
    const item = e.target.closest('.tl-nav-item');
    if (!item) return;
    activeFilter = item.dataset.value;
    renderTimeline();
});

navToggle.addEventListener('click', () => {
    document.getElementById('timeline-view').classList.toggle('nav-open');
});

function openPause() {
    for (let i = state.timeline.length - 1; i >= 0; i--) {
        const ev = state.timeline[i];
        if (ev.type === 'pause' && ev.endedAt == null) return ev;
    }
    return null;
}

function makeEvent(type) {
    const block = getCurrentParentBlock();
    const entity = block ? getCurrentTimeable() : null;
    const hasWitness = block && block.witnesses && block.witnesses.length > 0;
    return {
        id: 'ev-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        type,
        at: Date.now(),
        team: block ? state.currentTeam : null,
        blockName: block ? block.name : '',
        witnessName: hasWitness && entity ? entity.name : '',
        clock: block ? state.timeRemaining : null,
        note: ''
    };
}

export function logEvent(type, extra) {
    const ev = Object.assign(makeEvent(type), extra);
    state.timeline.push(ev);
    renderTimeline();
    saveTimerSession();
    return ev;
}

// `ruling` describes how the pause ended (e.g. "Resumed", "Sustained
// (deducted)"); no-op if no pause is open, so callers can call it freely.
export function closePause(ruling) {
    const pause = openPause();
    if (!pause) return;
    pause.endedAt = Date.now();
    pause.ruling = ruling;
    renderTimeline();
    saveTimerSession();
}

// Drops a bookmark at the current instant. Never touches the timer.
export function dropFlag(note) {
    return logEvent('flag', { note: (note || '').trim() });
}

function entryHtml(ev) {
    const isPause = ev.type === 'pause';
    const open = isPause && ev.endedAt == null;

    let trialOffset = '';
    if (state.startTime) {
        trialOffset = `<span class="tl-offset" title="Elapsed since trial start time">T+${formatHms((ev.at - state.startTime) / 1000)}</span>`;
    }

    let detail = '';
    if (isPause) {
        const secs = ((open ? Date.now() : ev.endedAt) - ev.at) / 1000;
        detail = `<span class="tl-duration" data-pause-id="${ev.id}">${open ? 'Paused for ' : 'Lasted '}${formatTime(Math.floor(secs))}</span>` +
            (open ? '' : `<span class="tl-ruling">${escapeHtml(ev.ruling || 'Resumed')}</span>`);
    }

    const clock = ev.clock != null ? `<span class="tl-clock" title="Timer reading">${formatTime(Math.round(ev.clock))}</span>` : '';
    const remove = ev.type === 'flag'
        ? `<button class="tl-delete" data-delete="${ev.id}" title="Delete flag" aria-label="Delete flag">${ICON_X}</button>`
        : '<span class="tl-delete-spacer"></span>';

    return `
        <li class="tl-entry tl-${ev.type}${open ? ' tl-open' : ''}" data-id="${ev.id}">
            <div class="tl-marker"></div>
            <div class="tl-body">
                <div class="tl-info">
                <div class="tl-head">
                    <span class="tl-type">${TYPE_LABELS[ev.type]}</span>
                    <span class="tl-time">${formatClockSeconds(ev.at)}</span>
                    ${trialOffset}
                    ${clock}
                    ${detail}
                </div>
                </div>
                <input type="text" class="tl-note" data-note="${ev.id}" value="${escapeHtml(ev.note || '').replace(/"/g, '&quot;')}"
                    placeholder="${isPause ? 'Add a note to this pause (e.g. hearsay objection)' : 'Add a note'}" autocomplete="off">
                ${remove}
            </div>
        </li>`;
}

// New entries land at the bottom (or the top when sorted newest first); if
// the list was already scrolled to that end it stays pinned there to follow along.
export function renderTimeline() {
    if (!listEl) return;
    const pinned = sortDesc ? listEl.scrollTop < 40 : listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 40;

    // Re-rendering replaces the inputs, so carry focus and caret over —
    // otherwise an event firing mid-note would eat the user's typing target.
    const active = document.activeElement;
    const focusId = active && active.dataset ? active.dataset.note : null;
    const caret = focusId ? [active.selectionStart, active.selectionEnd] : null;

    const showFlags = showFlagsEl.checked;
    renderNav(showFlags);
    const visible = state.timeline.filter(ev =>
        (showFlags || ev.type !== 'flag') && matchesFilter(ev, activeFilter));
    const filtered = !showFlags || activeFilter;
    countEl.textContent = state.timeline.length
        ? (filtered ? `${visible.length} of ${state.timeline.length} shown` : `${state.timeline.length} logged`)
        : '';
    if (!visible.length) {
        listEl.innerHTML = state.timeline.length
            ? '<li class="tl-empty">No entries match the current filters.</li>'
            : '<li class="tl-empty">Nothing logged yet. Starting, pausing and stopping the timer is recorded here automatically; drop a flag any time to bookmark a moment.</li>';
        return;
    }
    // A mini heading marks each change of side, block or witness from the
    // entry above it (in whichever direction the list is sorted); chips
    // themselves carry no names.
    let prevBlock = null;
    const ordered = sortDesc ? visible.slice().reverse() : visible;
    listEl.innerHTML = ordered.map(ev => {
        let heading = '';
        const blockKey = SIDES[ev.team] ? [ev.team, ev.blockName, ev.witnessName].join(SEP) : null;
        if (blockKey && blockKey !== prevBlock) {
            heading = `<li class="tl-heading tl-heading-${ev.team}"><span class="tl-heading-side">${SIDES[ev.team].label}</span>` +
                `<span class="tl-heading-team">${escapeHtml(SIDES[ev.team].name())}</span>` +
                `<span class="tl-heading-block">${escapeHtml(ev.blockName)}</span>` +
                (ev.witnessName ? `<span class="tl-heading-witness">${escapeHtml(ev.witnessName)}</span>` : '') + '</li>';
        }
        prevBlock = blockKey;
        return heading + entryHtml(ev);
    }).join('');

    if (focusId) {
        const input = listEl.querySelector(`[data-note="${focusId}"]`);
        if (input) {
            input.focus();
            input.setSelectionRange(caret[0], caret[1]);
        }
    }
    if (pinned && !focusId) scrollToLatest();
}

// Cheap per-second refresh of the one thing that changes on its own: the
// running length of an open pause. Avoids a full re-render mid-typing.
function tickOpenPause() {
    const pause = openPause();
    if (!pause) return;
    const el = listEl.querySelector(`[data-pause-id="${pause.id}"]`);
    if (el) el.textContent = 'Paused for ' + formatTime(Math.floor((Date.now() - pause.at) / 1000));
}

function setView(view) {
    document.body.dataset.view = view;
    viewTabs.forEach(tab => tab.classList.toggle('active', tab.dataset.view === view));
    if (view === 'timeline') {
        renderTimeline();
        scrollToLatest();
        syncNow();
    }
}

viewTabs.forEach(tab => tab.addEventListener('click', () => setView(tab.dataset.view)));

flagBtns.forEach((btn, i) => {
    const input = flagInputs[i];
    const drop = () => {
        dropFlag(input.value);
        input.value = '';
        // Keep the bench free for the next action; on the timeline tab the
        // note field stays focused so several flags can be dropped in a row.
        if (btn.id === 'flag-btn') btn.blur(); else input.focus();
    };
    btn.addEventListener('click', drop);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            drop();
        }
    });
});

listEl.addEventListener('input', (e) => {
    const id = e.target.dataset.note;
    if (!id) return;
    const ev = state.timeline.find(x => x.id === id);
    if (!ev) return;
    ev.note = e.target.value;
    saveTimerSession();
});

listEl.addEventListener('click', (e) => {
    const id = e.target.dataset.delete;
    if (!id) return;
    state.timeline = state.timeline.filter(x => x.id !== id);
    renderTimeline();
    saveTimerSession();
});

showFlagsEl.addEventListener('change', renderTimeline);
sortBtn.addEventListener('click', () => {
    sortDesc = !sortDesc;
    try { localStorage.setItem(SORT_KEY, sortDesc ? 'desc' : 'asc'); } catch {}
    renderSortButton();
    renderTimeline();
    scrollToLatest();
});
renderSortButton();

// Mirrors the bench's block name and clock so they stay visible here; the
// countdown itself is driven by controls.js, this only copies what it shows.
function syncNow() {
    if (document.body.dataset.view !== 'timeline') return;
    nowBlockEl.textContent = currentBlockName.textContent;
    nowTimeEl.textContent = countdown.textContent;
    nowTimeEl.className = 'timeline-now-time ' + countdown.className.replace('countdown', '').trim();
    nowLabelEl.textContent = timeLabel.textContent;
}

setInterval(syncNow, 50);
// Fast enough that the length of an open pause never visibly lags behind the
// wall clock; only one text node is touched per tick.
setInterval(tickOpenPause, 100);

// A pause can't survive a page reload (its timer is gone), so close any left
// open by the previous page instead of letting it count up forever.
closePause('Interrupted (page reloaded)');
renderTimeline();
