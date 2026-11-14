/** Minimal RFC 4180 CSV writer (quotes fields containing comma, quote, or newline). */
function cell(value) {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns, rows) {
  const header = columns.map((column) => cell(column.label)).join(',');
  const body = rows.map((row) => columns.map((column) => cell(row[column.key])).join(','));
  return [header, ...body].join('\r\n') + '\r\n';
}

export function sendCsv(res, filename, columns, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(toCsv(columns, rows));
}
