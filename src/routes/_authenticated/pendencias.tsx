import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { listRegistrosPeriodo } from "@/server/registros";
import { listImasAtivos } from "@/server/imas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, CalendarClock, FileDown, Magnet, ListChecks } from "lucide-react";
import { PeriodoFilter } from "@/components/PeriodoFilter";
import { periodoInicial, resolverPeriodo, type Periodo } from "@/lib/periodo";
import {
  calcularPendencias,
  fimBuscaRegistros,
  SLOTS,
  slotLabel,
  useAgora,
  type PendenciaItem,
  type Slot,
} from "@/lib/pendencias";
import { diaKey } from "@/lib/turno";
import { exportPendenciasPdf } from "@/lib/export-pdf";

export const Route = createFileRoute("/_authenticated/pendencias")({
  component: PendenciasPage,
});

function formatDia(dia: Date) {
  return dia.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

const vazioPorSlot = (): Record<Slot, number> => ({ A: 0, B: 0, C: 0, D: 0 });

function PendenciasPage() {
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoInicial("7d"));
  const [filtroSlot, setFiltroSlot] = useState<"all" | Slot>("all");
  const [exportando, setExportando] = useState(false);
  const agora = useAgora();
  const hojeKey = diaKey(agora);

  // Recalcula quando muda o dia, para "Hoje"/"Últimos N dias" acompanharem a data atual.
  const resolvido = useMemo(
    () => resolverPeriodo(periodo, agora),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodo, hojeKey],
  );
  const inicio = resolvido.inicio ?? new Date(0);

  const { data: imasAtivos, isLoading: loadingImas } = useQuery({
    queryKey: ["imas-ativos"],
    queryFn: () => listImasAtivos(),
  });

  const { data: registros, isLoading: loadingRegistros } = useQuery({
    queryKey: ["pendencias-registros", inicio.toISOString(), resolvido.fim.toISOString()],
    queryFn: () =>
      listRegistrosPeriodo({
        data: { de: inicio.toISOString(), ate: fimBuscaRegistros(resolvido.fim).toISOString() },
      }),
  });

  const isLoading = loadingImas || loadingRegistros;
  const temDiarios = imasAtivos?.some((i) => i.frequencia === "diaria") ?? false;
  const slotsVisiveis = SLOTS.filter((s) => s !== "D" || temDiarios);

  const pendencias = useMemo<PendenciaItem[]>(() => {
    if (!imasAtivos || !registros) return [];
    return calcularPendencias(imasAtivos, registros, inicio, resolvido.fim, agora).pendencias;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imasAtivos, registros, resolvido]);

  const pendenciasFiltradas = useMemo(
    () => (filtroSlot === "all" ? pendencias : pendencias.filter((p) => p.slot === filtroSlot)),
    [pendencias, filtroSlot],
  );

  const porIma = useMemo(() => {
    const map = new Map<
      string,
      { imaCodigo: string; setorNome: string; total: number; porSlot: Record<Slot, number> }
    >();
    pendenciasFiltradas.forEach((p) => {
      const cur = map.get(p.imaId) ?? {
        imaCodigo: p.imaCodigo,
        setorNome: p.setorNome,
        total: 0,
        porSlot: vazioPorSlot(),
      };
      cur.total++;
      cur.porSlot[p.slot]++;
      map.set(p.imaId, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [pendenciasFiltradas]);

  const porSlot = useMemo(() => {
    const map = Object.fromEntries(
      SLOTS.map((s) => [s, { total: 0, imas: new Set<string>() }]),
    ) as Record<Slot, { total: number; imas: Set<string> }>;
    pendenciasFiltradas.forEach((p) => {
      map[p.slot].total++;
      map[p.slot].imas.add(p.imaCodigo);
    });
    return map;
  }, [pendenciasFiltradas]);

  const porDia = useMemo(() => {
    const map = new Map<
      string,
      { dia: Date; total: number; porSlot: Record<Slot, PendenciaItem[]> }
    >();
    pendenciasFiltradas.forEach((p) => {
      const cur = map.get(p.diaKey) ?? {
        dia: p.dia,
        total: 0,
        porSlot: { A: [], B: [], C: [], D: [] },
      };
      cur.total++;
      cur.porSlot[p.slot].push(p);
      map.set(p.diaKey, cur);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, v]) => ({ key, ...v }));
  }, [pendenciasFiltradas]);

  const piorSlot = useMemo(
    () => slotsVisiveis.reduce((pior, s) => (porSlot[s].total > porSlot[pior].total ? s : pior)),
    [porSlot, slotsVisiveis],
  );
  const piorDia = porDia.length > 0 ? [...porDia].sort((a, b) => b.total - a.total)[0] : null;

  const handleExportPdf = async () => {
    setExportando(true);
    try {
      await exportPendenciasPdf({
        periodoTitulo: resolvido.titulo,
        periodoArquivo: resolvido.arquivo,
        filtroTitulo: filtroSlot === "all" ? "Todos os turnos" : slotLabel(filtroSlot),
        slots: slotsVisiveis,
        porIma,
        pendencias: [...pendenciasFiltradas].sort(
          (a, b) => b.diaKey.localeCompare(a.diaKey) || a.slot.localeCompare(b.slot),
        ),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar PDF");
    } finally {
      setExportando(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pendências</h1>
          <p className="text-sm text-muted-foreground">
            Limpezas ainda não registradas, por ímã, turno e dia
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Select value={filtroSlot} onValueChange={(v) => setFiltroSlot(v as "all" | Slot)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Turno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os turnos</SelectItem>
              {slotsVisiveis.map((s) => (
                <SelectItem key={s} value={s}>
                  {slotLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <PeriodoFilter value={periodo} onChange={setPeriodo} />
          <Button variant="outline" onClick={handleExportPdf} disabled={exportando}>
            <FileDown className="mr-2 h-4 w-4" />
            {exportando ? "Exportando..." : "Exportar PDF"}
          </Button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          title="Pendências no período"
          value={pendenciasFiltradas.length}
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          hint={resolvido.titulo}
          accent={pendenciasFiltradas.length > 0 ? "destructive" : undefined}
        />
        <KpiCard
          title="Ímãs com pendência"
          value={porIma.length}
          icon={<Magnet className="h-4 w-4" />}
          hint={`de ${imasAtivos?.length ?? 0} ímãs ativos`}
        />
        <KpiCard
          title="Turno mais crítico"
          value={pendenciasFiltradas.length > 0 ? slotLabel(piorSlot) : "—"}
          icon={<ListChecks className="h-4 w-4" />}
          hint={
            pendenciasFiltradas.length > 0
              ? `${porSlot[piorSlot].total} pendências`
              : "Sem pendências"
          }
        />
        <KpiCard
          title="Dia com mais pendências"
          value={piorDia ? formatDia(piorDia.dia) : "—"}
          icon={<CalendarClock className="h-4 w-4" />}
          hint={piorDia ? `${piorDia.total} pendências` : "Sem pendências"}
        />
      </div>

      <Tabs defaultValue="ima">
        <TabsList>
          <TabsTrigger value="ima">Por ímã</TabsTrigger>
          <TabsTrigger value="turno">Por turno</TabsTrigger>
          <TabsTrigger value="dia">Por dia</TabsTrigger>
        </TabsList>

        {/* POR ÍMÃ */}
        <TabsContent value="ima">
          <Card>
            <CardHeader>
              <CardTitle>Pendências por ímã</CardTitle>
              <CardDescription>Ímãs com limpezas não registradas no período</CardDescription>
            </CardHeader>
            <CardContent>
              {porIma.length === 0 ? (
                <EmptyState />
              ) : (
                <>
                  <div className="space-y-3 md:hidden">
                    {porIma.map((i) => (
                      <div key={i.imaCodigo} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium">{i.imaCodigo}</div>
                            <div className="text-xs text-muted-foreground">{i.setorNome}</div>
                          </div>
                          <Badge variant="destructive">{i.total}</Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {slotsVisiveis.map((s) =>
                            i.porSlot[s] > 0 ? (
                              <Badge key={s} variant="outline">
                                {slotLabel(s)}: {i.porSlot[s]}
                              </Badge>
                            ) : null,
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Table className="hidden md:table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ímã</TableHead>
                        <TableHead>Setor</TableHead>
                        {slotsVisiveis.map((s) => (
                          <TableHead key={s}>{slotLabel(s)}</TableHead>
                        ))}
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {porIma.map((i) => (
                        <TableRow key={i.imaCodigo}>
                          <TableCell className="font-medium">{i.imaCodigo}</TableCell>
                          <TableCell>{i.setorNome}</TableCell>
                          {slotsVisiveis.map((s) => (
                            <TableCell key={s}>
                              {i.porSlot[s] > 0 ? (
                                <Badge variant="destructive">{i.porSlot[s]}</Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-semibold">{i.total}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* POR TURNO */}
        <TabsContent value="turno">
          <div
            className={`grid gap-4 ${slotsVisiveis.length === 4 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3"}`}
          >
            {slotsVisiveis.map((s) => (
              <Card key={s}>
                <CardHeader>
                  <CardTitle>{slotLabel(s)}</CardTitle>
                  <CardDescription>
                    {porSlot[s].total} pendências no período
                    {s === "D" && " · 1 limpeza por dia, seg a sáb"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {porSlot[s].total === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem pendências.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">
                        {porSlot[s].imas.size} ímã(s) afetado(s)
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {porIma
                          .filter((i) => i.porSlot[s] > 0)
                          .slice(0, 12)
                          .map((i) => (
                            <Badge key={i.imaCodigo} variant="outline">
                              {i.imaCodigo} ({i.porSlot[s]})
                            </Badge>
                          ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* POR DIA */}
        <TabsContent value="dia">
          <Card>
            <CardHeader>
              <CardTitle>Pendências por dia</CardTitle>
              <CardDescription>
                Dias úteis (segunda a sábado) com limpezas em aberto
              </CardDescription>
            </CardHeader>
            <CardContent>
              {porDia.length === 0 ? (
                <EmptyState />
              ) : (
                <Accordion type="multiple" className="w-full">
                  {porDia.map((d) => (
                    <AccordionItem key={d.key} value={d.key}>
                      <AccordionTrigger>
                        <div className="flex flex-1 items-center justify-between pr-4">
                          <span className="capitalize">{formatDia(d.dia)}</span>
                          <Badge variant="destructive">{d.total} pendências</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div
                          className={`grid gap-3 ${slotsVisiveis.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}
                        >
                          {slotsVisiveis.map((s) => (
                            <div key={s}>
                              <div className="mb-1 text-xs font-medium text-muted-foreground">
                                {slotLabel(s)} ({d.porSlot[s].length})
                              </div>
                              {d.porSlot[s].length === 0 ? (
                                <span className="text-xs text-muted-foreground">
                                  Sem pendências
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {d.porSlot[s].map((p) => (
                                    <Badge key={p.imaId} variant="outline">
                                      {p.imaCodigo}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      Nenhuma pendência no período selecionado.
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon,
  hint,
  accent,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  hint?: string;
  accent?: "success" | "destructive";
}) {
  const accentColor =
    accent === "success"
      ? "text-success"
      : accent === "destructive"
        ? "text-destructive"
        : "text-foreground";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{title}</div>
          <div className="rounded-md bg-muted p-1.5">{icon}</div>
        </div>
        <div className={`mt-2 text-2xl font-bold ${accentColor}`}>{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
