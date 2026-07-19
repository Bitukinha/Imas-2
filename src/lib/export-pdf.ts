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
