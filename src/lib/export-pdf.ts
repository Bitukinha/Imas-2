import { getArquivo } from "@/server/arquivos";

type RegistroRow = {
  dataHora: string | Date;
  turno: string;
  imaCodigo: string | null;
  setorNome: string | null;
  responsavelNome: string | null;
  monitorNome: string | null;
  status: string;
  acaoTomada: string | null;
  observacoes: string | null;
};

type RegistroDetalhe = RegistroRow & {
  fotoConformeId: string | null;
  fotoSujoId: string | null;
  fotoLimpoId: string | null;
};

export async function exportRegistrosPdf(registros: RegistroRow[]) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(14);
  doc.text("Registros de limpeza de ímãs — Nutrimilho", 14, 15);
  doc.setFontSize(10);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, 21);

  autoTable(doc, {
    startY: 26,
    head: [
      [
        "Data/Hora",
        "Turno",
        "Ímã",
        "Setor",
        "Responsável",
        "Monitor",
        "Status",
        "Ação/Observações",
      ],
    ],
    body: registros.map((r) => [
      new Date(r.dataHora).toLocaleString("pt-BR"),
      `Turno ${r.turno}`,
      r.imaCodigo ?? "—",
      r.setorNome ?? "—",
      r.responsavelNome ?? "—",
      r.monitorNome ?? "—",
      r.status === "conforme" ? "Conforme" : "Não conforme",
      [r.acaoTomada, r.observacoes].filter(Boolean).join(" / ") || "—",
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [46, 125, 70] },
  });

  doc.save(`registros-limpeza-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function exportRegistroDetalhePdf(detalhe: RegistroDetalhe) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const marginX = 40;
  const pageWidth = 555;
  let y = 50;

  doc.setFontSize(16);
  doc.text("Registro de limpeza — Nutrimilho", marginX, y);
  y += 24;

  doc.setFontSize(10);
  const fields: [string, string][] = [
    ["Data/Hora", new Date(detalhe.dataHora).toLocaleString("pt-BR")],
    ["Turno", `Turno ${detalhe.turno}`],
    ["Ímã", detalhe.imaCodigo ?? "—"],
    ["Setor", detalhe.setorNome ?? "—"],
    ["Responsável", detalhe.responsavelNome ?? "—"],
    ["Monitor", detalhe.monitorNome ?? "—"],
    ["Status", detalhe.status === "conforme" ? "Conforme" : "Não conforme"],
  ];
  for (const [label, value] of fields) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, marginX, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, marginX + 100, y);
    y += 16;
  }

  if (detalhe.acaoTomada) {
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Ação tomada:", marginX, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(detalhe.acaoTomada, pageWidth - marginX);
    doc.text(lines, marginX, y);
    y += lines.length * 12 + 6;
  }

  if (detalhe.observacoes) {
    doc.setFont("helvetica", "bold");
    doc.text("Observações:", marginX, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(detalhe.observacoes, pageWidth - marginX);
    doc.text(lines, marginX, y);
    y += lines.length * 12 + 6;
  }

  const fotosComId: { title: string; id: string | null }[] = [
    { title: "Conforme", id: detalhe.fotoConformeId },
    { title: "Ímã sujo", id: detalhe.fotoSujoId },
    { title: "Após limpeza", id: detalhe.fotoLimpoId },
  ];
  const fotos = fotosComId.filter((f): f is { title: string; id: string } => !!f.id);

  if (fotos.length > 0) {
    const imgW = 240;
    const imgH = 180;
    if (y + imgH + 20 > 780) {
      doc.addPage();
      y = 50;
    } else {
      y += 14;
    }
    let x = marginX;
    for (const foto of fotos) {
      const arquivo = await getArquivo({ data: { id: foto.id } });
      if (!arquivo) continue;
      if (x + imgW > pageWidth) {
        x = marginX;
        y += imgH + 30;
      }
      doc.setFont("helvetica", "bold");
      doc.text(foto.title, x, y);
      doc.addImage(
        `data:${arquivo.contentType};base64,${arquivo.dataBase64}`,
        "JPEG",
        x,
        y + 6,
        imgW,
        imgH,
      );
      x += imgW + 20;
    }
  }

  doc.save(`registro-${new Date(detalhe.dataHora).toISOString().slice(0, 10)}.pdf`);
}

export async function exportDashboardPdf(container: HTMLElement, periodoLabel: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  await new Promise<void>((resolve, reject) => {
    doc
      .html(container, {
        x: 20,
        y: 20,
        width: 555,
        windowWidth: container.scrollWidth,
        callback: (finishedDoc) => {
          finishedDoc.save(
            `dashboard-${periodoLabel}-${new Date().toISOString().slice(0, 10)}.pdf`,
          );
          resolve();
        },
      })
      .catch(reject);
  });
}
