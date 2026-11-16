/**
 * Small RFC 4180 CSV reader / writer — enough for Goodreads exports and our
 * own library export, without pulling in a dependency.
 *
 * Handles quoted fields, "" escapes, commas and newlines inside quotes, CRLF
 * line endings and a leading byte-order mark.
 */

/** CSV text → array of rows (arrays of strings). Blank lines are dropped. */
export function parseCsv(text) {
  const src = String(text || "").replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/** First row is the header → array of { [header]: value } objects. */
export function parseCsvObjects(text) {
  const [header, ...rows] = parseCsv(text);
  if (!header) return { headers: [], records: [] };
  const headers = header.map((h) => h.trim());
  const records = rows.map((cells) => {
    const rec = {};
    headers.forEach((h, i) => {
      rec[h] = cells[i] ?? "";
    });
    return rec;
  });
  return { headers, records };
}

// Spreadsheet apps run cells that start with these as formulas.
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One cell. `raw: true` writes the value as-is (used for Goodreads-style
 * ="9780…" ISBNs); everything else that would start a formula gets a leading
 * apostrophe, which readFormulaSafe() strips on the way back in.
 */
export function csvCell(value, { raw = false } = {}) {
  let s = value == null ? "" : String(value);
  if (!raw && FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Undo csvCell's formula guard: "'=foo" → "=foo". */
export function readFormulaSafe(value) {
  const s = String(value ?? "");
  return /^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s;
}

/** Rows of cells (strings, or { value, raw }) → CSV text with CRLF endings. */
export function toCsv(rows) {
  return rows
    .map((cells) =>
      cells
        .map((c) =>
          c && typeof c === "object" ? csvCell(c.value, { raw: c.raw }) : csvCell(c)
        )
        .join(",")
    )
    .join("\r\n");
}
