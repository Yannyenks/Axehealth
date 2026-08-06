// Générateur CSV minimal — pas de dépendance externe. Échappe guillemets et
// virgules ; les valeurs contenant un saut de ligne ou une virgule sont
// entourées de guillemets doubles conformément à RFC 4180.
function escapeCsvValue(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(rows: Record<string, unknown>[], columns: { key: string; header: string }[]): string {
  const headerLine = columns.map((c) => escapeCsvValue(c.header)).join(",");
  const lines = rows.map((row) => columns.map((c) => escapeCsvValue(row[c.key])).join(","));
  return [headerLine, ...lines].join("\r\n");
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
