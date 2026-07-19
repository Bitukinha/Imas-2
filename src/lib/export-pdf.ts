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

type Turno = "A" | "B" | "C";

type DashboardExportData = {
  periodoTitulo: string;
  periodoArquivo: string;
  diasUteis: number;
  stats: {
    total: number;
    conformes: number;
    naoConformes: number;
    acoes: number;
    pctConforme: number;
    aderencia: number;
    esperados: number;
    porSetor: { nome: string; conforme: number; nao_conforme: number }[];
    topNaoConformes: { codigo: string; nao_conforme: number }[];
  };
  rankingTurnos: {
    turno: Turno;
    total: number;
    conforme: number;
    nao_conforme: number;
    pctConforme: number;
    aderencia: number;
  }[];
  ultimasNaoConformidades: {
    dataHora: string | Date;
    turno: string;
    imaCodigo: string | null;
    setorNome: string | null;
    acaoTomada: string | null;
  }[];
};

function tableFinalY(doc: import("jspdf").jsPDF, fallback: number): number {
  return (
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback
  );
}

function ensureSpace(doc: import("jspdf").jsPDF, y: number, needed = 60): number {
  if (y + needed <= 780) return y;
  doc.addPage();
  return 50;
}

export async function exportDashboardPdf(data: DashboardExportData) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const marginX = 40;

  doc.setFontSize(16);
  doc.text("Dashboard de limpeza de ímãs — Nutrimilho", marginX, 40);
  doc.setFontSize(10);
  doc.text(
    `${data.periodoTitulo} · ${data.diasUteis} dias úteis · Gerado em ${new Date().toLocaleString("pt-BR")}`,
    marginX,
    56,
  );

  const tableMargin = { left: marginX, right: marginX };
  const headStyles = { fillColor: [46, 125, 70] as [number, number, number] };

  autoTable(doc, {
    startY: 70,
    head: [["Total de registros", "Conformidade", "Não conformidades", "Aderência 6x1"]],
    body: [
      [
        `${data.stats.total} (esperado ${data.stats.esperados})`,
        `${data.stats.pctConforme}% (${data.stats.conformes} conforme / ${data.stats.naoConformes} não conforme)`,
        `${data.stats.naoConformes} (${data.stats.acoes} ações corretivas)`,
        `${data.stats.aderencia}%`,
      ],
    ],
    styles: { fontSize: 9 },
    headStyles,
    margin: tableMargin,
  });
  let y = tableFinalY(doc, 90) + 24;

  y = ensureSpace(doc, y, 120);
  doc.setFontSize(11);
  doc.text("Conformidade e aderência por turno", marginX, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [["Turno", "Conforme", "Não conforme", "% Conformidade", "% Aderência"]],
    body: data.rankingTurnos.map((r) => [
      `Turno ${r.turno}`,
      String(r.conforme),
      String(r.nao_conforme),
      `${r.pctConforme}%`,
      `${r.aderencia}%`,
    ]),
    styles: { fontSize: 9 },
    headStyles,
    margin: tableMargin,
  });
  y = tableFinalY(doc, y) + 24;

  if (data.stats.porSetor.length > 0) {
    y = ensureSpace(doc, y, 120);
    doc.setFontSize(11);
    doc.text("Conformidade por setor", marginX, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [["Setor", "Conforme", "Não conforme"]],
      body: data.stats.porSetor.map((s) => [s.nome, String(s.conforme), String(s.nao_conforme)]),
      styles: { fontSize: 9 },
      headStyles,
      margin: tableMargin,
    });
    y = tableFinalY(doc, y) + 24;
  }

  if (data.stats.topNaoConformes.length > 0) {
    y = ensureSpace(doc, y, 120);
    doc.setFontSize(11);
    doc.text("Top ímãs com não conformidade", marginX, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [["Ímã", "Ocorrências de não conformidade"]],
      body: data.stats.topNaoConformes.map((i) => [i.codigo, String(i.nao_conforme)]),
      styles: { fontSize: 9 },
      headStyles,
      margin: tableMargin,
    });
    y = tableFinalY(doc, y) + 24;
  }

  if (data.ultimasNaoConformidades.length > 0) {
    y = ensureSpace(doc, y, 120);
    doc.setFontSize(11);
    doc.text("Últimas não conformidades", marginX, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [["Data/Hora", "Turno", "Ímã", "Setor", "Ação tomada"]],
      body: data.ultimasNaoConformidades.map((r) => [
        new Date(r.dataHora).toLocaleString("pt-BR"),
        `Turno ${r.turno}`,
        r.imaCodigo ?? "—",
        r.setorNome ?? "—",
        r.acaoTomada ?? "—",
      ]),
      styles: { fontSize: 9 },
      headStyles,
      margin: tableMargin,
    });
  }

  doc.save(`dashboard-${data.periodoArquivo}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
