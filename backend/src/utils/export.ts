import { Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { stringify } from 'csv-stringify/sync';

export type Row = Record<string, string | number | null | undefined>;
export interface Sheet { name: string; rows: Row[] }

const safeCell = (v: unknown) => {
  // Neutralise spreadsheet formula injection (=, +, -, @) in user-controlled text.
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return `'${v}`;
  return v ?? '';
};

export function sendCsv(res: Response, filename: string, rows: Row[]) {
  const cols = rows[0] ? Object.keys(rows[0]) : [];
  const body = stringify(rows.map((r) => cols.map((c) => safeCell(r[c]))), { header: true, columns: cols });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  res.send('\ufeff' + body); // BOM so Excel reads Khmer (UTF-8) correctly
}

export async function sendXlsx(res: Response, filename: string, sheets: Sheet[]) {
  const wb = new ExcelJS.Workbook();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 30));
    const cols = s.rows[0] ? Object.keys(s.rows[0]) : [];
    ws.columns = cols.map((c) => ({ header: c, key: c, width: Math.max(12, c.length + 4) }));
    ws.getRow(1).font = { bold: true };
    s.rows.forEach((r) => ws.addRow(Object.fromEntries(cols.map((c) => [c, safeCell(r[c])]))));
  }
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}

/** Simple tabular PDF. Note: the built-in PDF fonts cannot draw Khmer glyphs; Khmer text is
 *  only fully supported in CSV/Excel exports (documented limitation). Latin text is used in PDF. */
export function sendPdf(res: Response, filename: string, title: string, subtitle: string, rows: Row[], max = 400) {
  const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
  doc.pipe(res);
  doc.fontSize(18).text(title);
  doc.fontSize(9).fillColor('#555').text(subtitle).moveDown();
  const cols = rows[0] ? Object.keys(rows[0]) : [];
  const w = (doc.page.width - 72) / Math.max(cols.length, 1);
  const line = (vals: string[], bold = false) => {
    if (doc.y > doc.page.height - 60) doc.addPage();
    const y = doc.y;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor('#000');
    vals.forEach((v, i) => doc.text(String(v ?? '').replace(/[^\x20-\x7E]/g, '?'), 36 + i * w, y, { width: w - 4, height: 11, ellipsis: true }));
    doc.y = y + 13;
  };
  line(cols, true);
  rows.slice(0, max).forEach((r) => line(cols.map((c) => String(r[c] ?? ''))));
  if (rows.length > max) doc.moveDown().text(`… ${rows.length - max} more rows. Use the Excel/CSV export for the full data.`);
  doc.end();
}

export async function sendExport(res: Response, format: string, name: string, title: string, subtitle: string, sheets: Sheet[]) {
  if (format === 'xlsx') return sendXlsx(res, name, sheets);
  if (format === 'pdf') return sendPdf(res, name, title, subtitle, sheets[0].rows);
  return sendCsv(res, name, sheets[sheets.length > 1 ? 1 : 0].rows);
}
