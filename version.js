const BAILIFF_VERSION = 'v2.3.0';

document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('version-footer');
    if (el) el.textContent = BAILIFF_VERSION;
});
