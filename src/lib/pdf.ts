import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { db, type Party, type Invoice, formatMoney, calcInvoiceTotals, getSettings, pdfSymbol } from "./db";

const TEAL: [number, number, number] = [13, 148, 136];
const RED: [number, number, number] = [220, 38, 38];
const GREEN: [number, number, number] = [22, 163, 74];
const SLATE: [number, number, number] = [71, 85, 105];
const MUTED: [number, number, number] = [120, 120, 120];
const RED_TINT: [number, number, number] = [254, 226, 226];
const GREEN_TINT: [number, number, number] = [220, 252, 231];
const TOTAL_BG: [number, number, number] = [15, 23, 42];

function imgFmt(dataUrl: string): "JPEG" | "PNG" {
  return dataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
}

/** Compact yyyymmdd_hhmmss for unique filenames. */
export function tsSuffix(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export async function generateStatementPDF(
  party: Party,
  businessName: string,
  currencySymbol: string,
  range?: { from: number; to: number },
  opts?: { watermark?: boolean; currency?: string },
) {
  const sym = pdfSymbol(opts?.currency, currencySymbol);
  const cur = opts?.currency;
  const fmt = (n: number) => formatMoney(n, sym, cur);
  const all = (await db.transactions.where("partyId").equals(party.id!).toArray())
    .sort((a, b) => a.createdAt - b.createdAt);
  const txns = range
    ? all.filter(t => t.createdAt >= range.from && t.createdAt <= range.to)
    : all;

  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, w, 10, "F");
  doc.setTextColor(255);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text(businessName, 14, 6.5);
  doc.text("STATEMENT", w - 14, 6.5, { align: "right" });

  // Party photo (top right)
  if (party.photo) {
    try { doc.addImage(party.photo, imgFmt(party.photo), w - 32, 14, 18, 18); }
    catch { /* ignore */ }
  }

  // Centered title
  doc.setTextColor(20);
  doc.setFontSize(20); doc.setFont("helvetica", "bold");
  doc.text(`${party.name} Statement`, w / 2, 24, { align: "center" });

  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTED);
  if (party.phone) doc.text(`Phone: ${party.phone}`, w / 2, 30, { align: "center" });

  const opening = party.openingBalance || 0;
  const firstDate = txns[0]?.createdAt ?? Date.now();
  const lastDate = txns[txns.length - 1]?.createdAt ?? Date.now();
  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
  doc.text(`(${fmtDate(firstDate)} - ${fmtDate(lastDate)})`, w / 2, 35, { align: "center" });

  // Summary cards
  let totalDebit = 0, totalCredit = 0;
  txns.forEach(t => { if (t.type === "debit") totalDebit += t.amount; else totalCredit += t.amount; });
  const net = opening + totalDebit - totalCredit;
  const partyVerb = net > 0 ? `${party.name} will give` : net < 0 ? `${party.name} will get` : "Settled";

  const cardY = 41, cardH = 26;
  const margin = 14, gap = 4;

  const cards: { label: string; value: string; color: [number, number, number]; sub: string }[] = [];
  if (opening !== 0) {
    cards.push({ label: "Opening Balance", value: formatMoney(Math.abs(opening), currencySymbol), color: opening > 0 ? RED : GREEN, sub: `(on ${fmtDate(firstDate)})` });
  }
  cards.push(
    { label: "Total Debit (-)", value: formatMoney(totalDebit, currencySymbol), color: RED, sub: " " },
    { label: "Total Credit (+)", value: formatMoney(totalCredit, currencySymbol), color: GREEN, sub: " " },
    { label: "Net Balance", value: formatMoney(Math.abs(net), currencySymbol), color: net === 0 ? SLATE : net > 0 ? RED : GREEN, sub: net === 0 ? "(settled)" : `(${partyVerb})` },
  );

  const cardW = (w - margin * 2 - gap * (cards.length - 1)) / cards.length;

  doc.setDrawColor(220);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, cardY, w - margin * 2, cardH, 2, 2, "S");

  cards.forEach((c, i) => {
    const x = margin + i * (cardW + gap);
    if (i > 0) {
      doc.setDrawColor(230);
      doc.line(x - gap / 2, cardY + 4, x - gap / 2, cardY + cardH - 4);
    }
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTED);
    doc.text(c.label, x + 2, cardY + 6);
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...c.color);
    doc.text(c.value, x + 2, cardY + 14);
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTED);
    const subLines = doc.splitTextToSize(c.sub, cardW - 2);
    doc.text(subLines, x + 2, cardY + 19);
  });

  // Entries count (above table)
  let y = cardY + cardH + 10;
  doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(20);
  doc.text(`No. of Entries: ${txns.length}`, margin, y);

  const fmtDateTime = (ts: number) => {
    const d = new Date(ts);
    const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `${date}\n${time}`;
  };

  // Table
  let running = opening;
  const body: any[] = txns.map((t, idx) => {
    running += t.type === "debit" ? t.amount : -t.amount;
    const balanceTxt = formatMoney(Math.abs(running), currencySymbol);
    return [
      { content: String(idx + 1), styles: { halign: "center" } },
      { content: fmtDateTime(t.createdAt), styles: { textColor: 60, fontSize: 8 } },
      { content: t.note || (t.type === "credit" ? "Received" : "Given"), styles: { textColor: 30 } },
      {
        content: t.type === "debit" ? formatMoney(t.amount, currencySymbol) : "",
        styles: { fillColor: t.type === "debit" ? RED_TINT : [255, 255, 255], halign: "right", fontStyle: "bold", textColor: 20 },
      },
      {
        content: t.type === "credit" ? formatMoney(t.amount, currencySymbol) : "",
        styles: { fillColor: t.type === "credit" ? GREEN_TINT : [255, 255, 255], halign: "right", fontStyle: "bold", textColor: 20 },
      },
      {
        content: balanceTxt,
        styles: { textColor: running > 0 ? RED : running < 0 ? GREEN : SLATE, halign: "right", fontStyle: "bold" },
      },
    ];
  });

  autoTable(doc, {
    startY: y + 4,
    head: [["#", "Date", "Details", "Debit (-)", "Credit (+)", "Balance"]],
    body,
    showFoot: "lastPage",
    headStyles: { fillColor: [241, 245, 249], textColor: 60, fontSize: 9, fontStyle: "bold", lineColor: [220, 220, 220], lineWidth: 0.2 },
    bodyStyles: { fontSize: 9, lineColor: [230, 230, 230], lineWidth: 0.2, cellPadding: 3 },
    footStyles: { fillColor: [255, 255, 255], textColor: 20, fontStyle: "bold", fontSize: 11, cellPadding: 5, lineColor: [180, 180, 180], lineWidth: 0 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 24 },
      2: { cellWidth: "auto" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
    margin: { left: margin, right: margin },
    theme: "grid",
    foot: [[
      { content: "GRAND TOTAL", colSpan: 3, styles: { halign: "left" } },
      { content: formatMoney(totalDebit, currencySymbol), styles: { halign: "right", textColor: RED } },
      { content: formatMoney(totalCredit, currencySymbol), styles: { halign: "right", textColor: GREEN } },
      { content: formatMoney(Math.abs(net), currencySymbol), styles: { halign: "right", textColor: net > 0 ? RED : net < 0 ? GREEN : SLATE } },
    ]],
    didDrawCell: (data) => {
      // Draw a thick top border across the foot row to visually separate Grand Total.
      if (data.section === "foot" && data.row.index === 0 && data.column.index === 0) {
        const pageW = doc.internal.pageSize.getWidth();
        const yy = data.cell.y;
        doc.setDrawColor(40);
        doc.setLineWidth(0.6);
        doc.line(margin, yy, pageW - margin, yy);
      }
    },
  });

  // Footer
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED);
  const stamp = new Date();
  doc.text(`Generated: ${stamp.toLocaleString()}`, margin, pageH - 8);
  if (opts?.watermark !== false) {
    doc.setFont("helvetica", "italic");
    doc.text("Generated by Hisaab Kitaab", w - margin, pageH - 8, { align: "right" });
  }

  return doc;
}

export async function downloadStatement(party: Party, businessName: string, symbol: string, range?: { from: number; to: number }) {
  const doc = await generateStatementPDF(party, businessName, symbol, range);
  doc.save(`${party.name.replace(/\s+/g, "_")}_statement.pdf`);
}

export async function generateInvoicePDF(inv: Invoice) {
  const s = await getSettings();
  const sym = pdfSymbol(s.currency, s.currencySymbol);
  const cur = s.currency;
  const fmt = (n: number) => formatMoney(n, sym, cur);
  const { subtotal, tax, total } = calcInvoiceTotals(inv);

  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();

  doc.setFillColor(...TEAL);
  doc.rect(0, 0, w, 32, "F");

  let textX = 14;
  if (s.logo) {
    try { doc.addImage(s.logo, imgFmt(s.logo), 14, 6, 20, 20); textX = 38; }
    catch { /* ignore */ }
  }

  doc.setTextColor(255);
  doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text(s.businessName, textX, 14);
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  if (s.phone) doc.text(s.phone, textX, 21);
  if (s.address) doc.text(s.address, textX, 27);

  doc.setFontSize(22); doc.setFont("helvetica", "bold");
  doc.text("INVOICE", w - 14, 16, { align: "right" });
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  doc.text(inv.number, w - 14, 23, { align: "right" });

  doc.setFontSize(9); doc.setTextColor(120);
  doc.text("BILL TO", 14, 44);
  doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(30);
  doc.text(inv.partyName, 14, 51);

  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(120);
  doc.text(`Date: ${new Date(inv.date).toLocaleDateString()}`, w - 14, 44, { align: "right" });
  if (inv.dueDate) doc.text(`Due: ${new Date(inv.dueDate).toLocaleDateString()}`, w - 14, 50, { align: "right" });
  doc.text(`Status: ${inv.status.toUpperCase()}`, w - 14, 56, { align: "right" });

  autoTable(doc, {
    startY: 64,
    head: [["#", "Item", "Qty", "Price", "Amount"]],
    body: inv.items.map((it, i) => [
      String(i + 1), it.name, String(it.qty),
      formatMoney(it.price, sym), formatMoney(it.qty * it.price, sym),
    ]),
    headStyles: { fillColor: TEAL, textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 250, 248] },
    columnStyles: { 0: { cellWidth: 10 }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });

  let y = (doc as any).lastAutoTable.finalY + 8;
  const rightX = w - 14;
  const labelX = w - 60;
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(80);
  doc.text("Subtotal", labelX, y); doc.text(formatMoney(subtotal, sym), rightX, y, { align: "right" });
  y += 6;
  if (inv.discount > 0) {
    doc.text("Discount", labelX, y); doc.text(`- ${formatMoney(inv.discount, sym)}`, rightX, y, { align: "right" });
    y += 6;
  }
  if (inv.taxPercent > 0) {
    doc.text(`Tax (${inv.taxPercent}%)`, labelX, y); doc.text(formatMoney(tax, sym), rightX, y, { align: "right" });
    y += 6;
  }
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(30);
  doc.text("Total", labelX, y + 2); doc.text(formatMoney(total, sym), rightX, y + 2, { align: "right" });

  if (inv.paidAmount > 0) {
    y += 10;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(80);
    doc.text("Paid", labelX, y); doc.text(formatMoney(inv.paidAmount, sym), rightX, y, { align: "right" });
    y += 6;
    doc.setFont("helvetica", "bold"); doc.setTextColor(total - inv.paidAmount > 0 ? 200 : 30, 0, 0);
    doc.text("Balance Due", labelX, y); doc.text(formatMoney(total - inv.paidAmount, sym), rightX, y, { align: "right" });
  }

  if (inv.notes) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(110);
    doc.text("Notes:", 14, y + 16);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(inv.notes, w - 28);
    doc.text(lines, 14, y + 22);
  }

  if (s.invoiceWatermark !== false) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(140);
    doc.text("Generated by Hisaab Kitaab", 14, 287);
  }

  return doc;
}

export async function downloadInvoice(inv: Invoice) {
  const { saveFile } = await import("./saveFile");
  const doc = await generateInvoicePDF(inv);
  const blob = doc.output("blob");
  await saveFile(`${inv.number}_${tsSuffix()}.pdf`, "application/pdf", blob);
}

export function shareWhatsApp(phone: string | undefined, text: string) {
  const cleaned = (phone || "").replace(/[^\d+]/g, "");
  const url = cleaned
    ? `https://wa.me/${cleaned.replace(/^\+/, "")}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener");
}
