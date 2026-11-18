// CSV builder. Text cells starting with = + - @ are prefixed to prevent spreadsheet formula injection.
function cell(value) {
  if (value === null || value === undefined) return '';
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers, rows) {
  const lines = [headers.map(cell).join(',')];
  rows.forEach((r) => lines.push(r.map(cell).join(',')));
  return '\uFEFF' + lines.join('\r\n');
}
