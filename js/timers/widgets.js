import { escapeHtml } from '../shared/dom-utils.js';
import { formatTime, parseTime } from '../shared/time.js';
import { ICON_LINK } from '../shared/icons.js';
import { leftWidgets, rightWidgets } from './dom.js';
import { state } from './state.js';
import { getCurrentTimeable, getBlockRemaining } from './engine.js';
// widgets.js and controls.js import from each other (widgets.js needs
// selectBlock to wire up widget clicks; controls.js needs renderWidgets
// after every timer action) — safe as a circular ES module import since
// both sides only touch the imports inside event-handler/interval
// callbacks, never at module-evaluation time.
import { selectBlock } from './controls.js';

const ICON_CHEVRON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="widget-expand-svg"><path d="M6 9l6 6l6 -6"/></svg>`;

function widgetTimeClass(remaining) {
    let cls = 'widget-remaining';
    if (remaining < 0) cls += ' negative';
    else if (remaining <= 10) cls += ' critical';
    else if (remaining <= 30) cls += ' warning';
    return cls;
}

// Shows "Elapsed" whenever any time has actually been used against the
// budget — not gated on whether the item was ever independently started or
// stopped, since a linked ruling deduction can eat into a block/witness
// that was never itself put on the clock.
function widgetElapsedHtml(item, remaining, onTheClock) {
    if (onTheClock) return '';
    const total = parseTime(item.time);
    if (remaining >= total) return '';
    const elapsedSecs = total - remaining;
    const overtime = remaining < 0;
    return `<div class="widget-elapsed${overtime ? ' overtime' : ''}">Elapsed: ${formatTime(elapsedSecs)}</div>`;
}

export function renderWidgets() {
    leftWidgets.innerHTML = '';
    rightWidgets.innerHTML = '';

    // Resolved once per render (not per widget) since it can default
    // currentWitnessId as a side effect — repeating that inside the loop
    // below would be wasteful and, worse, order-dependent.
    const currentEntity = (state.currentBlockId != null && state.currentTeam != null) ? getCurrentTimeable() : null;

    ['left', 'right'].forEach(team => {
        state.blocks[team].forEach(block => {
            const witnesses = block.witnesses || [];
            const hasWitnesses = witnesses.length > 0;
            const isBlockActive = block.id === state.currentBlockId && block.team === state.currentTeam;

            const widget = document.createElement('div');
            widget.className = 'block-widget';

            if (hasWitnesses) {
                widget.classList.add('has-witnesses');
                const stopwatchMode = state.witnessMode === 'stopwatch';
                const expandKey = team + ':' + block.id;
                // Linked witnesses need to be visible, not buried behind a
                // collapsed superblock header — force-expand any block that
                // has at least one when Timed Ruling Mode is on, same as an
                // active block always does.
                const hasLinkedWitness = state.timedRulingMode && witnesses.some(w => w.linked != null);
                const expanded = isBlockActive || state.expandedBlocks.has(expandKey) || hasLinkedWitness;
                if (expanded) widget.classList.add('expanded');

                // No timer ever runs on the block itself — the header is a
                // read-only rollup that just expands/collapses the witness
                // list; only witness rows select. Timed Ruling Mode links
                // witnesses directly (both modes) rather than the block, so
                // the block header itself never gets a linked-highlight.
                if (isBlockActive) widget.classList.add('active-parent');

                const remaining = getBlockRemaining(block);

                let witnessRowsHtml = '';
                witnesses.forEach(w => {
                    const isWitnessActive = isBlockActive && w.id === state.currentWitnessId;
                    const rowClasses = ['witness-widget-row'];
                    if (isWitnessActive) rowClasses.push('active');
                    if (currentEntity && currentEntity.linked === w.id && block.team !== state.currentTeam) {
                        rowClasses.push('linked-highlight');
                    }
                    const wLinkIcon = w.linked && state.timedRulingMode ? `<span class="link-icon">${ICON_LINK}</span>` : '';

                    if (stopwatchMode) {
                        const wElapsed = w.elapsedSeconds || 0;
                        witnessRowsHtml += `
                            <div class="${rowClasses.join(' ')}" data-witness-id="${w.id}">
                                <div class="widget-name">${wLinkIcon}${escapeHtml(w.name)}</div>
                                <div class="widget-times">
                                    <span class="widget-remaining widget-stopwatch">${formatTime(wElapsed)}</span>
                                    <span class="widget-total">Stopwatch</span>
                                </div>
                            </div>
                        `;
                    } else {
                        if (w.remainingSeconds !== null && w.remainingSeconds <= 0) rowClasses.push('completed');

                        const wRemaining = w.remainingSeconds !== null ? w.remainingSeconds : parseTime(w.time);
                        const wOnTheClock = isWitnessActive && (state.isRunning || state.isPaused);

                        witnessRowsHtml += `
                            <div class="${rowClasses.join(' ')}" data-witness-id="${w.id}">
                                <div class="widget-name">${wLinkIcon}${escapeHtml(w.name)}</div>
                                <div class="widget-times">
                                    <span class="${widgetTimeClass(wRemaining)}">${formatTime(wRemaining)}</span>
                                    <span class="widget-total">${escapeHtml(w.time)}</span>
                                </div>
                                ${widgetElapsedHtml(w, wRemaining, wOnTheClock)}
                            </div>
                        `;
                    }
                });

                widget.innerHTML = `
                    <div class="widget-block-header">
                        <div class="widget-name">${escapeHtml(block.name)}<span class="widget-expand-icon">${ICON_CHEVRON}</span></div>
                        <div class="widget-times">
                            <span class="${widgetTimeClass(remaining)}">${formatTime(remaining)}</span>
                            <span class="widget-total">${escapeHtml(block.time)}</span>
                        </div>
                        ${widgetElapsedHtml(block, remaining, false)}
                    </div>
                    <div class="witness-widget-list">${witnessRowsHtml}</div>
                `;

                widget.querySelector('.widget-block-header').addEventListener('click', () => {
                    if (state.expandedBlocks.has(expandKey)) state.expandedBlocks.delete(expandKey);
                    else state.expandedBlocks.add(expandKey);
                    renderWidgets();
                });

                widget.querySelectorAll('.witness-widget-row').forEach(row => {
                    row.addEventListener('click', (e) => {
                        e.stopPropagation();
                        selectBlock(block.id, block.team, parseInt(row.dataset.witnessId));
                    });
                });
            } else {
                if (isBlockActive) widget.classList.add('active');

                if (currentEntity && currentEntity.linked === block.id && block.team !== state.currentTeam) {
                    widget.classList.add('linked-highlight');
                }

                if (block.remainingSeconds !== null && block.remainingSeconds <= 0) {
                    widget.classList.add('completed');
                }

                const remaining = block.remainingSeconds !== null ? block.remainingSeconds : parseTime(block.time);
                const linkIcon = block.linked && state.timedRulingMode ? `<span class="link-icon">${ICON_LINK}</span>` : '';
                const onTheClock = isBlockActive && (state.isRunning || state.isPaused);

                widget.innerHTML = `
                    <div class="widget-name">${linkIcon}${escapeHtml(block.name)}</div>
                    <div class="widget-times">
                        <span class="${widgetTimeClass(remaining)}">${formatTime(remaining)}</span>
                        <span class="widget-total">${escapeHtml(block.time)}</span>
                    </div>
                    ${widgetElapsedHtml(block, remaining, onTheClock)}
                `;

                widget.addEventListener('click', () => selectBlock(block.id, block.team));
            }

            if (team === 'left') {
                leftWidgets.appendChild(widget);
            } else {
                rightWidgets.appendChild(widget);
            }
        });
    });
}
