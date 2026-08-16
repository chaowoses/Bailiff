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

// Same as formatTime but with millisecond precision, for the main bench
// countdown display only — every other display (widgets, secondary timer,
// etc.) stays whole-seconds via formatTime.
export function formatTimeMs(seconds) {
    const isNegative = seconds < 0;
    const absSeconds = Math.abs(seconds);
    const mins = Math.floor(absSeconds / 60);
    const secs = Math.floor(absSeconds % 60);
    const ms = Math.floor((absSeconds - Math.floor(absSeconds)) * 1000);
    return `${isNegative ? '-' : ''}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}
