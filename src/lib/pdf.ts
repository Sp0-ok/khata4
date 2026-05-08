import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { db, type Party, type Invoice, formatMoney, calcInvoiceTotals, getSettings } from "./db";

const TEAL: [number, number, number] = [13, 148, 136];
const RED: [number, number, number] = [220, 38, 38];
const GREEN: [number, number, number] = [22, 163, 74];
const SLATE: [number, number, number] = [71, 85, 105];
const MUTED: [number, number, number] = [120, 120, 120];
const RED_TINT: [number, number, number] = [254, 226, 226];
const GREEN_TINT: [number, number, number] = [220, 252, 231];

export async function generateStatementPDF(party: Party, businessName: string, currencySymbol: string) {
  const txns = (await db.transactions.where("partyId").equals(party.id!).toArray())
    .sort((a, b) => a.date - b.date);

  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();

  // ----- Header band -----
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, w, 10, "F");
  doc.setTextColor(255);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text(businessName, 14, 6.5);
  doc.text("STATEMENT", w - 14, 6.5, { align: "right" });

  // ----- Centered title -----
  doc.setTextColor(20);
  doc.setFontSize(20); doc.setFont("helvetica", "bold");
  doc.text(`${party.name} Statement`, w / 2, 24, { align: "center" });

  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTED);
  if (party.phone) doc.text(`Phone Number: ${party.phone}`, w / 2, 30, { align: "center" });

  const opening = party.openingBalance || 0;
  const firstDate = txns[0]?.date ?? Date.now();
  const lastDate = txns[txns.length - 1]?.date ?? Date.now();
  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
  doc.text(`(${fmtDate(firstDate)} - ${fmtDate(lastDate)})`, w / 2, 35, { align: "center" });

  // ----- Summary cards -----
  let totalDebit = 0, totalCredit = 0;
  txns.forEach(t => { if (t.type === "debit") totalDebit += t.amount; else totalCredit += t.amount; });
  const net = opening + totalDebit - totalCredit;
  const partyVerb = net > 0 ? `${party.name} will give` : net < 0 ? `${party.name} will get` : "Settled";

  const cardY = 41, cardH = 26;
  const margin = 14, gap = 4;
  const cardW = (w - margin * 2 - gap * 4) / 5;

  doc.setDrawColor(220);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, cardY, w - margin * 2, cardH, 2, 2, "S");

  const cards: { label: string; value: string; color: [number, number, number]; sub: string }[] = [
    { label: "Opening Balance", value: formatMoney(Math.abs(opening), currencySymbol), color: opening === 0 ? SLATE : opening > 0 ? RED : GREEN, sub: opening === 0 ? "(settled)" : `(on ${fmtDate(firstDate)})` },
    { label: "Total Debit (-)", value: formatMoney(totalDebit, currencySymbol), color: RED, sub: " " },
    { label: "Total Credit (+)", value: formatMoney(totalCredit, currencySymbol), color: GREEN, sub: " " },
    { label: "Net Balance", value: formatMoney(Math.abs(net), currencySymbol), color: net === 0 ? SLATE : net > 0 ? RED : GREEN, sub: net === 0 ? "(settled)" : `(${partyVerb})` },
    { label: "Running Balance", value: formatMoney(Math.abs(net), currencySymbol), color: net === 0 ? SLATE : net > 0 ? RED : GREEN, sub: `(on ${fmtDate(lastDate)})` },
  ];

  cards.forEach((c, i) => {
    const x = margin + i * (cardW + gap) + (i > 0 ? 0 : 0);
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

  // ----- Entries count -----
  let y = cardY + cardH + 8;
  doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(20);
  doc.text(`No. of Entries: ${txns.length} (All)`, margin, y);

  // ----- Table -----
  let running = opening;
  const body: any[] = [];
  // Opening row
  body.push([
    { content: fmtDate(firstDate), styles: { fontStyle: "bold" } },
    "", "",
    { content: `(Opening Balance: ${formatMoney(opening, currencySymbol)})`, styles: { textColor: MUTED, halign: "right" } },
    "",
  ]);

  txns.forEach((t, idx) => {
    running += t.type === "debit" ? t.amount : -t.amount;
    const balanceTxt = running === 0
      ? formatMoney(0, currencySymbol)
      : running > 0
        ? `${formatMoney(Math.abs(running), currencySymbol)} dr`
        : `${formatMoney(Math.abs(running), currencySymbol)} cr`;
    body.push([
      String(idx + 1),
      fmtDate(t.date),
      t.note || (t.type === "credit" ? "Received" : "Given"),
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
    ]);
  });

  autoTable(doc, {
    startY: y + 4,
    head: [["#", "Date", "Details", "Debit (-)", "Credit (+)", "Balance"]],
    body,
    headStyles: { fillColor: [241, 245, 249], textColor: 60, fontSize: 9, fontStyle: "bold", lineColor: [220, 220, 220], lineWidth: 0.2 },
    bodyStyles: { fontSize: 9, lineColor: [230, 230, 230], lineWidth: 0.2, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 22 },
      2: { cellWidth: "auto" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
    margin: { left: margin, right: margin },
    theme: "grid",
    foot: [[
      { content: "Grand Total", colSpan: 3, styles: { halign: "left", fontStyle: "bold", fillColor: [241, 245, 249], textColor: 20 } },
      { content: formatMoney(totalDebit, currencySymbol), styles: { halign: "right", fontStyle: "bold", fillColor: [241, 245, 249], textColor: 20 } },
      { content: formatMoney(totalCredit, currencySymbol), styles: { halign: "right", fontStyle: "bold", fillColor: [241, 245, 249], textColor: 20 } },
      { content: net === 0 ? formatMoney(0, currencySymbol) : `${formatMoney(Math.abs(net), currencySymbol)} ${net > 0 ? "dr" : "cr"}`, styles: { halign: "right", fontStyle: "bold", fillColor: [241, 245, 249], textColor: 20 } },
    ]],
  });

  // ----- Footer -----
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED);
  const stamp = new Date();
  doc.text(`Report Generated: ${stamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} | ${fmtDate(stamp.getTime())}`, margin, pageH - 8);
  doc.text("Hisaab Kitaab", w - margin, pageH - 8, { align: "right" });

  return doc;
}

export async function downloadStatement(party: Party, businessName: string, symbol: string) {
  const doc = await generateStatementPDF(party, businessName, symbol);
  doc.save(`${party.name.replace(/\s+/g, "_")}_statement.pdf`);
}

export async function generateInvoicePDF(inv: Invoice) {
  const s = await getSettings();
  const sym = s.currencySymbol;
  const { subtotal, tax, total } = calcInvoiceTotals(inv);

  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, w, 32, "F");

  let textX = 14;
  if (s.logo) {
    try {
      const fmt = s.logo.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
      doc.addImage(s.logo, fmt, 14, 6, 20, 20);
      textX = 38;
    } catch { /* ignore bad logo */ }
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

  // Bill to
  doc.setTextColor(30);
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

  doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(140);
  doc.text("Generated by Hisaab Kitaab", 14, 287);

  return doc;
}

export async function downloadInvoice(inv: Invoice) {
  const doc = await generateInvoicePDF(inv);
  doc.save(`${inv.number}.pdf`);
}

export function shareWhatsApp(phone: string | undefined, text: string) {
  const cleaned = (phone || "").replace(/[^\d+]/g, "");
  const url = cleaned
    ? `https://wa.me/${cleaned.replace(/^\+/, "")}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener");
}
