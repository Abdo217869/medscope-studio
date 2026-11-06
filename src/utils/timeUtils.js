/**
 * Format a 24h time string (e.g. "08:00", "14:00") into a compact 12h display string (e.g. "8", "2", "9:30").
 */
export function formatCompactTime(timeStr) {
  if (!timeStr) return '';
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return timeStr;

  let h = parseInt(parts[0], 10);
  const m = parts[1];

  // Convert 24-hour to 12-hour
  if (h > 12) {
    h = h - 12;
  } else if (h === 0) {
    h = 12;
  }

  // Strip :00 minutes
  if (m === '00') {
    return `${h}`;
  }
  return `${h}:${m}`;
}

/**
 * Format a start and end time into the reference layout format: `(8-9:30)` or `(12:30-2)`.
 */
export function formatTimeRange(start, end) {
  if (!start && !end) return '';
  const s = formatCompactTime(start);
  const e = formatCompactTime(end);
  if (!e) return `(${s})`;
  if (!s) return `(${e})`;
  return `(${s}-${e})`;
}

/**
 * Compare two sessions by start time, breaking ties by session number.
 * Recorded sessions always sort last in their day.
 */
export function compareSessions(a, b) {
  const isRecA = a.status === 'recorded';
  const isRecB = b.status === 'recorded';
  if (isRecA && !isRecB) return 1;
  if (!isRecA && isRecB) return -1;

  const startA = a.start || '99:99';
  const startB = b.start || '99:99';
  const timeDiff = startA.localeCompare(startB);
  if (timeDiff !== 0) return timeDiff;

  const numA = typeof a.number === 'number' ? a.number : 0;
  const numB = typeof b.number === 'number' ? b.number : 0;
  return numA - numB;
}

