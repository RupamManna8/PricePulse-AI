export function triggerDownload(filename: string, content: string, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function toCsv(rows: Array<Record<string, string | number | boolean | null | undefined>>) {
  if (!rows.length) {
    return '';
  }

  const headers = Object.keys(rows[0]);
  const escapeCell = (value: string | number | boolean | null | undefined) => {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((header) => escapeCell(row[header])).join(','));
  });

  return lines.join('\n');
}

export function toTsv(rows: Array<Record<string, string | number | boolean | null | undefined>>) {
  if (!rows.length) {
    return '';
  }

  const headers = Object.keys(rows[0]);
  const escapeCell = (value: string | number | boolean | null | undefined) => {
    const text = value === null || value === undefined ? '' : String(value);
    return text.replace(/\t/g, ' ').replace(/\n/g, ' ');
  };

  const lines = [headers.join('\t')];
  rows.forEach((row) => {
    lines.push(headers.map((header) => escapeCell(row[header])).join('\t'));
  });

  return lines.join('\n');
}