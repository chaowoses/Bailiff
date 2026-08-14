export function parseTime(timeStr) {
    const parts = (timeStr || '00:00').split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
}

export function formatTime(seconds) {
    const isNegative = seconds < 0;
    const absSeconds = Math.abs(seconds);
    const mins = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    return `${isNegative ? '-' : ''}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
