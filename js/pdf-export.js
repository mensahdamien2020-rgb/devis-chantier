const PDFExport = (() => {

  const INK = [32, 30, 26];
  const ORANGE = [225, 90, 15];
  const GREY = [120, 113, 98];
  const LINE = [211, 203, 183];

  async function generate({ company, state, totals }) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const marginX = 16;
    let y = 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...INK);
    doc.text(company.name || "Prestataire", marginX, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...GREY);
    y += 6;
    if (company.trade) { doc.text(company.trade, marginX, y); y += 5; }
    const contactLine = [company.phone, company.city].filter(Boolean).join("  •  ");
    if (contactLine) { doc.text(contactLine, marginX, y); }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...ORANGE);
    doc.text("DEVIS", pageW - marginX, 20, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(`N° ${state.devisNumber}`, pageW - marginX, 27, { align: "right" });
    doc.setTextColor(...GREY);
    doc.text(`Date : ${formatDate(state.client.date)}`, pageW - marginX, 32, { align: "right" });
    doc.text(`Valable ${state.client.validity} jours`, pageW - marginX, 37, { align: "right" });

    y = 46;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.4);
    doc.line(marginX, y, pageW - marginX, y);

    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.text("CLIENT", marginX, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(state.client.name || "-", marginX, y);

    if (state.client.object) {
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...GREY);
      doc.text(`Objet : ${state.client.object}`, marginX, y);
    }

    y += 10;

    const rows = state.lines
      .filter(l => l.designation && ((parseFloat(l.qte) || 0) * (parseFloat(l.pu) || 0)) > 0)
      .map((l, i) => {
        const qte = parseFloat(l.qte) || 0;
        const pu = parseFloat(l.pu) || 0;
        return [
          String(i + 1),
          l.designation,
          l.unite,
          formatNumber(qte),
          formatNumber(pu) + " F",
          formatNumber(qte * pu) + " F"
        ];
      });

    doc.autoTable({
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [["#", "Désignation", "Unité", "Qté", "P.U.", "Total"]],
      body: rows,
      styles: {
        font: "helvetica", fontSize: 9.5, cellPadding: 3,
        lineColor: LINE, lineWidth: 0.2, textColor: INK
      },
      headStyles: {
        fillColor: INK, textColor: [239, 235, 225], fontStyle: "bold", fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        2: { cellWidth: 16, halign: "center" },
        3: { cellWidth: 18, halign: "right" },
        4: { cellWidth: 26, halign: "right" },
        5: { cellWidth: 30, halign: "right", fontStyle: "bold" }
      },
      alternateRowStyles: { fillColor: [247, 245, 239] }
    });

    let finalY = doc.lastAutoTable.finalY + 8;

    const boxW = 70;
    const boxX = pageW - marginX - boxW;

    doc.setFontSize(10);
    doc.setTextColor(...GREY);
    doc.setFont("helvetica", "normal");
    doc.text("Sous-total", boxX, finalY);
    doc.text(formatNumber(totals.subtotal) + " FCFA", pageW - marginX, finalY, { align: "right" });

    if (state.applyTva) {
      finalY += 6;
      doc.text("TVA (18%)", boxX, finalY);
      doc.text(formatNumber(totals.tva) + " FCFA", pageW - marginX, finalY, { align: "right" });
    }

    finalY += 4;
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.5);
    doc.line(boxX, finalY, pageW - marginX, finalY);

    finalY += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text("TOTAL TTC", boxX, finalY);
    doc.setTextColor(...ORANGE);
    doc.setFontSize(15);
    doc.text(formatNumber(totals.total) + " FCFA", pageW - marginX, finalY, { align: "right" });

    if (state.client.note) {
      finalY += 14;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...GREY);
      const noteLines = doc.splitTextToSize(state.client.note, pageW - 2 * marginX);
      doc.text(noteLines, marginX, finalY);
      finalY += noteLines.length * 4.5;
    }

    const pageH = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageH - 18, pageW - marginX, pageH - 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text("Devis généré via Devis Chantier — STAMINA", marginX, pageH - 12);
    doc.text(`${company.name || ""}`, pageW - marginX, pageH - 12, { align: "right" });

    const filename = `Devis_${sanitize(state.client.name)}_${state.devisNumber}.pdf`;
    const blob = doc.output("blob");
    const file = new File([blob], filename, { type: "application/pdf" });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Devis ${state.devisNumber}`,
          text: `Devis pour ${state.client.name}`
        });
        return;
      } catch (e) {
        // l'utilisateur a annulé le partage
      }
    }
    doc.save(filename);
  }

  function formatNumber(n) {
    return Math.round(n || 0).toLocaleString("fr-FR");
  }

  function formatDate(iso) {
    if (!iso) return "-";
    const [yy, mm, dd] = iso.split("-");
    return `${dd}/${mm}/${yy}`;
  }

  function sanitize(str) {
    return (str || "Client").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
  }

  return { generate };
})();