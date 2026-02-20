import { jsPDF } from "jspdf";

export function generateReceipt({ tenantName, unit, month, date }) {
  const doc = new jsPDF({ format: "a4", unit: "mm" });

  const margin = 25;
  let y = 30;
  const lineH = 8;

  // ── HEADER ──────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("JOANA SOLÉ SANTACANA", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(" VIUDA DE JOAN SUAU OLIVELLA", margin + 58, y);
  y += lineH;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("PASSEIG MARÍTIM SANT JOAN DE DÉU, 90, 5º 2ª", margin, y); y += lineH;
  doc.text("43820 CALAFELL", margin, y); y += lineH;
  doc.text("DNI: 39618190T", margin, y); y += lineH;
  doc.text("Bertasuau@gmail.com | 630879206", margin, y); y += lineH * 2;

  // ── DIVIDER ──────────────────────────────────────────────
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, 210 - margin, y);
  y += lineH * 1.5;

  // ── TITLE ────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("REBUT DE LLOGUER", margin, y);
  y += lineH * 2;

  // ── BODY TEXT ────────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");

  // Build body with mixed formatting
  const body1 = "Jo, Berta Suau, he rebut del/la senyor/a ";
  const body2 = tenantName;
  const body3 = ", en concepte de ";
  const body4 = "ALQUILER";
  const body5 = " del mes de ";
  const body6 = month;
  const body7 = " de l'immoble ";
  const body8 = unit;
  const body9 = ", en nom de la Senyora Joana Solé Santacana, Titular de la nau.";

  // Word-wrap manually
  const fullText = body1 + body2 + body3 + body4 + body5 + body6 + body7 + body8 + body9;
  const maxWidth = 210 - margin * 2;

  // Render with mixed bold/color segments
  const segments = [
    { text: body1, bold: false, color: [0, 0, 0] },
    { text: body2, bold: true, color: [188, 0, 38] },
    { text: body3, bold: false, color: [0, 0, 0] },
    { text: body4, bold: true, color: [0, 0, 0] },
    { text: body5, bold: false, color: [0, 0, 0] },
    { text: body6, bold: true, color: [188, 0, 38] },
    { text: body7, bold: false, color: [0, 0, 0] },
    { text: body8, bold: true, color: [188, 0, 38] },
    { text: body9, bold: false, color: [0, 0, 0] },
  ];

  // Render segments inline with line wrapping
  let x = margin;
  const lineWidth = 210 - margin * 2;

  for (const seg of segments) {
    doc.setFont("helvetica", seg.bold ? "bold" : "normal");
    doc.setTextColor(seg.color[0], seg.color[1], seg.color[2]);

    const words = seg.text.split(" ");
    for (let i = 0; i < words.length; i++) {
      const word = words[i] + (i < words.length - 1 ? " " : "");
      const wordWidth = doc.getTextWidth(word);
      if (x + wordWidth > margin + lineWidth && x > margin) {
        x = margin;
        y += lineH;
      }
      doc.text(word, x, y);
      x += wordWidth;
    }
  }

  y += lineH * 2.5;

  // ── DATE ─────────────────────────────────────────────────
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Data del rebut:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(188, 0, 38);
  doc.text(" " + date, margin + doc.getTextWidth("Data del rebut:"), y);
  y += lineH * 2.5;

  // ── SIGNATURE ────────────────────────────────────────────
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Firma:", margin, y);
  doc.setFont("helvetica", "bolditalic");
  doc.text(" Berta Suau", margin + doc.getTextWidth("Firma:"), y);

  // ── FOOTER LINE ──────────────────────────────────────────
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, 270, 210 - margin, 270);

  // ── SAVE ─────────────────────────────────────────────────
  const filename = `Rebut_${tenantName.replace(/ /g, "_")}_${month.replace(/ /g, "_")}.pdf`;
  doc.save(filename);
}
