// Timezone: Asia/Kolkata (IST = UTC+5:30)
const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Get today's date in IST as YYYY-MM-DD string
 */
export function getTodayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });
}

/**
 * Format a date string or Date object to display format
 * e.g. "23 Aug 2026"
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: IST_TIMEZONE,
  });
}

/**
 * Format a timestamp to time string in IST
 * e.g. "09:00 AM"
 */
export function formatTime(timestamp) {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: IST_TIMEZONE,
  });
}

/**
 * Format timestamp to date + time
 */
export function formatDateTime(timestamp) {
  if (!timestamp) return '—';
  const d = new Date(timestamp);
  return `${formatDate(d)} ${formatTime(d)}`;
}

/**
 * Calculate elapsed time string from a timestamp
 * Returns "HH:MM:SS" format
 */
export function getElapsedTime(startTimestamp) {
  if (!startTimestamp) return '00:00:00';
  const diff = Math.floor((Date.now() - new Date(startTimestamp).getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

/**
 * Format a date for display in DD-MM-YYYY format (business format)
 */
export function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('-');
  return `${day}-${month}-${year}`;
}

/**
 * Format a date for Excel filename YYYY-MM-DD
 */
export function formatDateForFilename(dateStr) {
  return dateStr || getTodayIST();
}

/**
 * Format timestamp to Excel-friendly time (HH:MM)
 */
export function formatTimeForExcel(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: IST_TIMEZONE,
  });
}
