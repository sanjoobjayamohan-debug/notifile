import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { ActivityItem } from '../types';

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Export activities history as CSV
 */
export function exportActivityAsCSV(
  activities: ActivityItem[],
  user?: { email: string; name: string }
): void {
  const headers = [
    'Activity ID',
    'Date',
    'Time',
    'Tool Used',
    'File Name',
    'Original Size (Bytes)',
    'Original Size (Readable)',
    'Result Size (Bytes)',
    'Result Size (Readable)',
    'Space Saved (Bytes)',
    'Credits Charged',
    'Status',
  ];

  const escapeCSV = (str: string | number | undefined): string => {
    if (str === undefined || str === null) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = activities.map((act) => {
    const d = new Date(act.timestamp);
    const dateStr = d.toLocaleDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const orig = act.originalSize || 0;
    const res = act.resultSize || 0;
    const saved = orig > res ? orig - res : 0;
    const charged = act.creditsCharged ?? 0;

    return [
      escapeCSV(act.id),
      escapeCSV(dateStr),
      escapeCSV(timeStr),
      escapeCSV(act.toolName),
      escapeCSV(act.fileName),
      escapeCSV(orig),
      escapeCSV(formatFileSize(orig)),
      escapeCSV(res ? res : '—'),
      escapeCSV(res ? formatFileSize(res) : '—'),
      escapeCSV(saved),
      escapeCSV(`₹${charged.toFixed(2)}`),
      escapeCSV(act.status),
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `notifile_activity_report_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export activities history as a styled PDF report
 */
export async function exportActivityAsPDF(
  activities: ActivityItem[],
  user?: { email: string; name: string },
  creditBalance = 0
): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const totalSavedBytes = activities.reduce((acc, act) => {
    if (act.resultSize && act.originalSize > act.resultSize) {
      return acc + (act.originalSize - act.resultSize);
    }
    return acc;
  }, 0);

  const totalCreditsUsed = activities.reduce((acc, act) => {
    return acc + (act.creditsCharged || 0);
  }, 0);

  const pageSize: [number, number] = [595.28, 841.89]; // A4
  const margin = 40;
  const contentWidth = pageSize[0] - margin * 2;

  let page = pdfDoc.addPage(pageSize);
  let y = pageSize[1] - margin;

  // Header Banner
  page.drawRectangle({
    x: margin,
    y: y - 50,
    width: contentWidth,
    height: 50,
    color: rgb(0.12, 0.38, 0.88), // Notifile Blue
  });

  page.drawText('Notifile PDF Toolkit', {
    x: margin + 16,
    y: y - 24,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText('Activity History & Spending Statement', {
    x: margin + 16,
    y: y - 40,
    size: 10,
    font: fontRegular,
    color: rgb(0.9, 0.95, 1),
  });

  y -= 70;

  // Metadata Box
  page.drawRectangle({
    x: margin,
    y: y - 55,
    width: contentWidth,
    height: 55,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: rgb(0.88, 0.91, 0.94),
    borderWidth: 1,
  });

  const emailText = user?.email || 'david.miller@example.com';
  const dateGenerated = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  page.drawText(`User Account: ${emailText}`, {
    x: margin + 12,
    y: y - 18,
    size: 9,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  page.drawText(`Date Generated: ${dateGenerated}`, {
    x: margin + 12,
    y: y - 32,
    size: 8,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });

  page.drawText(`Credit Balance: ${creditBalance.toLocaleString()} credits`, {
    x: margin + 12,
    y: y - 46,
    size: 8,
    font: fontRegular,
    color: rgb(0.12, 0.38, 0.88),
  });

  page.drawText(`Total Operations: ${activities.length}`, {
    x: margin + 280,
    y: y - 18,
    size: 9,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  page.drawText(`Total Space Saved: ${formatFileSize(totalSavedBytes)}`, {
    x: margin + 280,
    y: y - 32,
    size: 8,
    font: fontRegular,
    color: rgb(0.1, 0.6, 0.3),
  });

  page.drawText(`Credits Used: ${totalCreditsUsed.toLocaleString()}`, {
    x: margin + 280,
    y: y - 46,
    size: 8,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });

  y -= 75;

  // Table Column definitions
  const cols = [
    { label: 'Date/Time', x: margin + 6, width: 80 },
    { label: 'Tool', x: margin + 90, width: 95 },
    { label: 'File Name', x: margin + 190, width: 145 },
    { label: 'Original', x: margin + 340, width: 60 },
    { label: 'Output', x: margin + 405, width: 55 },
    { label: 'Status', x: margin + 465, width: 45 },
  ];

  // Table Header row
  const drawTableHeader = (curPage: typeof page, curY: number) => {
    curPage.drawRectangle({
      x: margin,
      y: curY - 18,
      width: contentWidth,
      height: 18,
      color: rgb(0.93, 0.95, 0.98),
    });

    cols.forEach((col) => {
      curPage.drawText(col.label, {
        x: col.x,
        y: curY - 12,
        size: 8,
        font: fontBold,
        color: rgb(0.2, 0.25, 0.35),
      });
    });
  };

  drawTableHeader(page, y);
  y -= 22;

  // Table Rows
  for (let i = 0; i < activities.length; i++) {
    const act = activities[i];

    // Check if new page is needed
    if (y < margin + 40) {
      page = pdfDoc.addPage(pageSize);
      y = pageSize[1] - margin;
      drawTableHeader(page, y);
      y -= 22;
    }

    const isEven = i % 2 === 0;
    if (isEven) {
      page.drawRectangle({
        x: margin,
        y: y - 16,
        width: contentWidth,
        height: 16,
        color: rgb(0.98, 0.99, 1),
      });
    }

    const d = new Date(act.timestamp);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const toolStr = act.toolName.slice(0, 18);
    const fileStr = act.fileName.length > 24 ? act.fileName.slice(0, 21) + '...' : act.fileName;
    const origStr = formatFileSize(act.originalSize || 0);
    const resStr = act.resultSize ? formatFileSize(act.resultSize) : '—';
    const statusStr = act.status === 'completed' ? 'Done' : 'Failed';

    page.drawText(dateStr, {
      x: cols[0].x,
      y: y - 11,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.35, 0.35, 0.35),
    });

    page.drawText(toolStr, {
      x: cols[1].x,
      y: y - 11,
      size: 7.5,
      font: fontBold,
      color: rgb(0.15, 0.15, 0.15),
    });

    page.drawText(fileStr, {
      x: cols[2].x,
      y: y - 11,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2),
    });

    page.drawText(origStr, {
      x: cols[3].x,
      y: y - 11,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4),
    });

    page.drawText(resStr, {
      x: cols[4].x,
      y: y - 11,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4),
    });

    page.drawText(statusStr, {
      x: cols[5].x,
      y: y - 11,
      size: 7.5,
      font: fontBold,
      color: act.status === 'completed' ? rgb(0.1, 0.6, 0.25) : rgb(0.8, 0.2, 0.2),
    });

    y -= 18;
  }

  // Footer note on last page
  page.drawText(
    'Notifile zero-retention guarantee: Files are processed client-side with no persistent server storage.',
    {
      x: margin,
      y: margin - 15,
      size: 7,
      font: fontRegular,
      color: rgb(0.55, 0.55, 0.55),
    }
  );

  const pdfBytes = await pdfDoc.save();
  // Download file
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `notifile_activity_statement_${new Date().toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
