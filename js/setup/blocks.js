import { escapeHtml } from '../shared/dom-utils.js';
import { ICON_TRASH, ICON_CHEVRON_UP, ICON_CHEVRON_DOWN, ICON_SCALES, ICON_INFO, ICON_WITNESS } from './icons.js';
import { blockList, editPanel, editNameInput, editTimeInput, editLinkSelect, linkLabel, saveBtn, cancelBtn, timedRulingToggle } from './dom.js';
import { state, saveSetupSession } from './state.js';
import { formatTimeInputValue } from './time-input.js';
// blocks.js and witnesses.js import from each other (this needs
// renderWitnessSection/unlinkWitnessEverywhere, witnesses.js needs
// renderBlocks/closeEditPanel) — safe as a circular ES module import since
// both sides only touch the imports inside event-handler functions, never
// at module-evaluation time.
import { renderWitnessSection, unlinkWitnessEverywhere, isWitnessTimeUneven } from './witnesses.js';

const placeholder = document.createElement("div");
placeholder.className = "block-placeholder";

export function updateLinkVisibility() {
    linkLabel.style.display = timedRulingToggle.checked ? 'flex' : 'none';
}

timedRulingToggle.addEventListener('change', () => {
    timedRulingToggle.closest('.schedule-toggle').classList.toggle('schedule-toggle--active', timedRulingToggle.checked);
    updateLinkVisibility();
    renderBlocks();
    saveSetupSession();
});

export function buildBlockBadges(block) {
    let html = '';
    if (timedRulingToggle.checked) {
        const hasWitnesses = block.witnesses && block.witnesses.length;
        if (hasWitnesses) {
            // Linking lives on the individual witnesses now, not the block's
            // own `.linked` — so the superblock badge reflects that instead.
            const linkedCount = block.witnesses.filter(w => w.linked != null).length;
            if (linkedCount > 0) {
                const label = linkedCount + ' Linked Witness' + (linkedCount !== 1 ? 'es' : '');
                html += `<span class="block-linked-badge">${ICON_SCALES} ${label}<span class="badge-info-icon">${ICON_INFO}</span></span>`;
            }
        } else if (block.linked) {
            const linkedBlock = state.blocks.find(b => b.id === block.linked);
            if (linkedBlock) {
                html += `<span class="block-linked-badge">${ICON_SCALES} ${escapeHtml(linkedBlock.name)}<span class="badge-info-icon">${ICON_INFO}</span></span>`;
            }
        }
    }
    if (block.witnesses && block.witnesses.length) {
        html += `<span class="block-witness-badge">${ICON_WITNESS}${block.witnesses.length}</span>`;
    }
    return html;
}

function blockTimeDisplay(block) {
    return isWitnessTimeUneven(block) ? 'Uneven' : block.time;
}

export function updateBlockTimeDisplay(block) {
    const card = document.querySelector(`.block-card[data-id="${block.id}"]`);
    if (!card) return;
    const timeSpan = card.querySelector('.block-time');
    if (timeSpan) {
        timeSpan.textContent = blockTimeDisplay(block);
        timeSpan.classList.toggle('block-time-uneven', isWitnessTimeUneven(block));
    }
    const nameSpan = card.querySelector('.block-name');
    if (nameSpan) nameSpan.innerHTML = escapeHtml(block.name) + buildBlockBadges(block);
}

function createBlockElement(block, index) {
    const div = document.createElement("div");
    div.className = "block-card";
    div.dataset.id = block.id;
    div.setAttribute("draggable", "true");

    const badgeHtml = buildBlockBadges(block);
    const timeClass = 'block-time' + (isWitnessTimeUneven(block) ? ' block-time-uneven' : '');

    div.innerHTML = `
        <div class="block-main-content" data-index="${index + 1}">
            <span class="block-name">${escapeHtml(block.name)}${badgeHtml}</span>
            <span class="${timeClass}">${escapeHtml(blockTimeDisplay(block))}</span>
        </div>
        <div class="block-controls">
            <button class="block-move block-move-up" title="Move Up"${index === 0 ? ' disabled' : ''}>${ICON_CHEVRON_UP}</button>
            <button class="block-move block-move-down" title="Move Down"${index === state.blocks.length - 1 ? ' disabled' : ''}>${ICON_CHEVRON_DOWN}</button>
            <button class="block-delete" title="Delete Block">${ICON_TRASH}</button>
        </div>`;

    div.addEventListener('dragstart', () => {
        div._dragActive = true;
        closeEditPanel();
        setTimeout(() => div.classList.add('dragging'), 0);
    });

    div.addEventListener('dragend', () => {
        div.classList.remove('dragging');
        if (placeholder.parentNode) {
            placeholder.replaceWith(div);
        }
        placeholder.remove();
        syncArrayOrder();
        setTimeout(() => { div._dragActive = false; }, 0);
    });

    return div;
}

function updateBlockIndices() {
    const cards = blockList.querySelectorAll('.block-card:not(.removing)');
    cards.forEach((card, i) => {
        const content = card.querySelector('.block-main-content');
        if (content) content.dataset.index = i + 1;

        const upBtn = card.querySelector('.block-move-up');
        const downBtn = card.querySelector('.block-move-down');
        if (upBtn) upBtn.disabled = i === 0;
        if (downBtn) downBtn.disabled = i === cards.length - 1;
    });
}

editTimeInput.addEventListener('input', () => formatTimeInputValue(editTimeInput));

export function openEditPanel(id) {
    if (state.currentEditingId === id) return closeEditPanel();
    const block = state.blocks.find(b => b.id === id);
    const card = document.querySelector(`.block-card[data-id="${id}"]`);

    state.currentEditingId = id;
    editNameInput.value = block.name;
    editTimeInput.value = block.time;

    editLinkSelect.innerHTML = '<option value="">None</option>';
    state.blocks.forEach(b => {
        if (b.id !== id) {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.name;
            if (block.linked === b.id) opt.selected = true;
            editLinkSelect.appendChild(opt);
        }
    });

    updateLinkVisibility();
    card.after(editPanel);
    editPanel.classList.remove("hidden");
    renderWitnessSection(block);
}

function saveBlockChanges() {
    const block = state.blocks.find(b => b.id === state.currentEditingId);
    if (!block) return;

    block.name = editNameInput.value;
    block.time = editTimeInput.value.length < 3 ? "01:00" : editTimeInput.value;
    const linkValue = editLinkSelect.value ? parseInt(editLinkSelect.value) : null;
    block.linked = linkValue !== null && state.blocks.some(b => b.id === linkValue) ? linkValue : null;

    renderBlocks();
    closeEditPanel();
}

export function closeEditPanel() {
    editPanel.classList.add("hidden");
    state.currentEditingId = null;
}

function adjacentBlockCard(card, direction) {
    let el = direction === -1 ? card.previousElementSibling : card.nextElementSibling;
    while (el && !el.classList.contains('block-card')) {
        el = direction === -1 ? el.previousElementSibling : el.nextElementSibling;
    }
    return el;
}

// Swaps two adjacent cards in place and FLIP-animates the shift, so an
// arrow click on mobile visibly slides the block into its new spot instead
// of the whole list silently re-rendering.
function animateBlockSwap(card, sibling, direction) {
    const cardBefore = card.getBoundingClientRect().top;
    const siblingBefore = sibling.getBoundingClientRect().top;

    if (direction === -1) blockList.insertBefore(card, sibling);
    else blockList.insertBefore(sibling, card);

    updateBlockIndices();
    saveSetupSession();

    [[card, cardBefore], [sibling, siblingBefore]].forEach(([el, before]) => {
        const delta = before - el.getBoundingClientRect().top;
        if (!delta) return;
        el.style.transition = 'none';
        el.style.transform = `translateY(${delta}px)`;
        requestAnimationFrame(() => {
            el.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
            el.style.transform = '';
            el.addEventListener('transitionend', () => {
                el.style.transition = '';
            }, { once: true });
        });
    });
}

function moveBlock(id, direction) {
    const index = state.blocks.findIndex(b => b.id === id);
    if (index === -1) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= state.blocks.length) return;

    if (state.currentEditingId === id) closeEditPanel();
    [state.blocks[index], state.blocks[newIndex]] = [state.blocks[newIndex], state.blocks[index]];

    const card = blockList.querySelector(`.block-card[data-id="${id}"]`);
    const sibling = card && adjacentBlockCard(card, direction);
    if (card && sibling) {
        animateBlockSwap(card, sibling, direction);
    } else {
        renderBlocks();
    }
}

function deleteBlock(id) {
    const card = document.querySelector(`.block-card[data-id="${id}"]`);
    if (!card) return;

    if (state.currentEditingId === id) closeEditPanel();

    card.classList.add("removing");
    setTimeout(() => {
        card.remove();
        const block = state.blocks.find(b => b.id === id);
        // Any witness elsewhere that was copied from this block and links
        // back to one of its witnesses shouldn't be left pointing at nothing.
        if (block && block.witnesses) {
            block.witnesses.forEach(w => unlinkWitnessEverywhere(w.id));
        }
        state.blocks = state.blocks.filter(b => b.id !== id);
        state.blocks.forEach(b => { if (b.linked === id) b.linked = null; });
        syncArrayOrder();
    }, 400);
}

export function renderBlocks() {
    // #block-edit-panel gets inserted as a sibling of the cards (via
    // `card.after(editPanel)` in openEditPanel), so it lives inside
    // blockList while open — wiping blockList.innerHTML would silently
    // destroy it out from under an in-progress edit (e.g. toggling Timed
    // Ruling Mode while a block is open). Detach it first, then reopen the
    // same block afterward so editing state survives the re-render.
    const wasEditingId = state.currentEditingId;
    if (editPanel.parentNode === blockList) editPanel.remove();

    blockList.innerHTML = '';
    state.blocks.forEach((b, i) => blockList.appendChild(createBlockElement(b, i)));

    if (wasEditingId != null && state.blocks.some(b => b.id === wasEditingId)) {
        state.currentEditingId = null;
        openEditPanel(wasEditingId);
    }
    saveSetupSession();
}

blockList.addEventListener("click", e => {
    const card = e.target.closest(".block-card");
    if (!card || e.target.closest('#block-edit-panel') || card.classList.contains('removing')) return;
    if (card._dragActive) return;
    if (e.target.closest('.badge-info-icon')) return;

    const deleteBtn = e.target.closest(".block-delete");
    const moveUpBtn = e.target.closest(".block-move-up");
    const moveDownBtn = e.target.closest(".block-move-down");
    if (deleteBtn) {
        deleteBlock(parseInt(card.dataset.id));
    } else if (moveUpBtn) {
        if (!moveUpBtn.disabled) moveBlock(parseInt(card.dataset.id), -1);
    } else if (moveDownBtn) {
        if (!moveDownBtn.disabled) moveBlock(parseInt(card.dataset.id), 1);
    } else {
        openEditPanel(parseInt(card.dataset.id));
    }
});

document.getElementById("add-block-btn").addEventListener("click", () => {
    const newB = { id: state.nextId++, name: "New Block", time: "01:00", linked: null, witnesses: [] };
    state.blocks.push(newB);
    blockList.appendChild(createBlockElement(newB, state.blocks.length - 1));
    updateBlockIndices();
    saveSetupSession();
});

saveBtn.addEventListener("click", saveBlockChanges);
cancelBtn.addEventListener("click", closeEditPanel);

blockList.addEventListener('drop', e => e.preventDefault());

blockList.addEventListener('dragover', e => {
    e.preventDefault();
    const dragging = document.querySelector('.dragging');
    if (!dragging) return;

    const afterElement = getDragAfterElement(blockList, e.clientY);
    const isAtEnd = afterElement == null && dragging === blockList.lastElementChild;
    const isBeforeSelf = afterElement === dragging;
    const isAfterSelf = afterElement === dragging.nextElementSibling;

    if (isAtEnd || isBeforeSelf || isAfterSelf) {
        placeholder.remove();
    } else {
        if (afterElement == null) {
            blockList.appendChild(placeholder);
        } else {
            blockList.insertBefore(placeholder, afterElement);
        }
    }
});

function getDragAfterElement(container, y) {
    const draggables = [...container.querySelectorAll('.block-card:not(.dragging):not(.block-placeholder):not(.removing)')];
    return draggables.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        return offset < 0 && offset > closest.offset ? { offset, element: child } : closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function syncArrayOrder() {
    state.blocks = [...blockList.querySelectorAll('.block-card:not(.removing)')].map(c =>
        state.blocks.find(b => b.id === parseInt(c.dataset.id))
    );
    updateBlockIndices();
    saveSetupSession();
}
