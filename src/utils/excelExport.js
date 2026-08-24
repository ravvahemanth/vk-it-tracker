import * as XLSX from 'xlsx';
import { formatDate, formatTimeForExcel, formatDateForFilename } from './dateTime';

/**
 * Generate and download Excel report for admin
 */
export function exportToExcel(sessions, date) {
  if (!sessions || sessions.length === 0) {
    alert('No sessions found for the selected filters.');
    return;
  }

  const workbook = XLSX.utils.book_new();
  const dateStr = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  // ============================================================
  // Sheet 1: Detailed Sessions
  // ============================================================
  const sessionRows = sessions.map(s => ({
    'Date': s.work_date ? s.work_date.split('-').reverse().join('-') : '',
    'Employee': s.profiles?.full_name || s.employee_id,
    'Session Number': s.session_number,
    'Starting Form Number': s.starting_form_number,
    'Ending Form Number': s.ending_form_number ?? '',
    'Total Forms': s.total_forms ?? '',
    'Start Time': formatTimeForExcel(s.start_time),
    'End Time': formatTimeForExcel(s.end_time),
    'Duration (hrs)': s.start_time && s.end_time
      ? ((new Date(s.end_time) - new Date(s.start_time)) / 3600000).toFixed(2)
      : '',
    'Status': s.status.charAt(0).toUpperCase() + s.status.slice(1),
  }));

  const ws1 = XLSX.utils.json_to_sheet(sessionRows);

  // Set column widths
  ws1['!cols'] = [
    { wch: 12 }, // Date
    { wch: 18 }, // Employee
    { wch: 8 },  // Session #
    { wch: 20 }, // Starting Form
    { wch: 18 }, // Ending Form
    { wch: 12 }, // Total Forms
    { wch: 12 }, // Start Time
    { wch: 12 }, // End Time
    { wch: 14 }, // Duration
    { wch: 12 }, // Status
  ];

  XLSX.utils.book_append_sheet(workbook, ws1, 'Sessions');

  // ============================================================
  // Sheet 2: Daily Summary by Employee
  // ============================================================
  const summaryMap = {};
  sessions.forEach(s => {
    if (s.status !== 'completed') return;
    const name = s.profiles?.full_name || s.employee_id;
    if (!summaryMap[name]) {
      summaryMap[name] = { sessions: 0, totalForms: 0 };
    }
    summaryMap[name].sessions += 1;
    summaryMap[name].totalForms += s.total_forms || 0;
  });

  const summaryRows = Object.entries(summaryMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, data]) => ({
      'Employee': name,
      'Sessions Completed': data.sessions,
      'Total Forms': data.totalForms,
    }));

  // Add grand total row
  const grandTotal = summaryRows.reduce((sum, r) => sum + r['Total Forms'], 0);
  const grandSessions = summaryRows.reduce((sum, r) => sum + r['Sessions Completed'], 0);
  summaryRows.push({
    'Employee': 'GRAND TOTAL',
    'Sessions Completed': grandSessions,
    'Total Forms': grandTotal,
  });

  const ws2 = XLSX.utils.json_to_sheet(summaryRows);
  ws2['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 12 }];

  XLSX.utils.book_append_sheet(workbook, ws2, 'Daily Summary');

  // ============================================================
  // Generate and download
  // ============================================================
  const filename = `VK_IT_Attendance_${formatDateForFilename(dateStr)}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
