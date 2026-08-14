// ===== DELETE CONFIRMATION =====
let pendingDelete = null;
let pendingRestore = null;

export function showDeleteConfirm(title, text, onConfirm, confirmLabel, onCancel, confirmClass) {
    document.getElementById('delete-confirm-title').textContent = title;
    document.getElementById('delete-confirm-text').textContent = text;
    const btn = document.getElementById('delete-confirm-confirm');
    btn.textContent = confirmLabel || 'Delete';
    btn.className = 'confirm-btn ' + (confirmClass || 'confirm-leave');
    pendingDelete = onConfirm;
    pendingRestore = onCancel || null;
    document.getElementById('delete-confirm-overlay').classList.remove('hidden');
}

document.getElementById('delete-confirm-cancel').addEventListener('click', () => {
    if (pendingRestore) pendingRestore();
    pendingDelete = null;
    pendingRestore = null;
    document.getElementById('delete-confirm-overlay').classList.add('hidden');
});

document.getElementById('delete-confirm-confirm').addEventListener('click', () => {
    if (pendingDelete) pendingDelete();
    pendingDelete = null;
    pendingRestore = null;
    document.getElementById('delete-confirm-overlay').classList.add('hidden');
});

document.getElementById('delete-confirm-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('delete-confirm-overlay')) {
        if (pendingRestore) pendingRestore();
        pendingDelete = null;
        pendingRestore = null;
        document.getElementById('delete-confirm-overlay').classList.add('hidden');
    }
});
