import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listRegistrosDesde } from "@/server/registros";
import { listImasAtivos } from "@/server/imas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { AlertTriangle, CalendarClock, Magnet, ListChecks } from "lucide-react";
import { diasUteis6x1Lista, diaKey, turnoAtual, TURNOS, type Turno } from "@/lib/turno";

export const Route = createFileRoute("/_authenticated/pendencias")({
  component: PendenciasPage,
});

type Periodo = "7d" | "30d" | "90d";

const periodoInfo: Record<Periodo, string> = {
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
};

type PendenciaItem = {
  diaKey: string;
  dia: Date;
  turno: Turno;
  imaId: string;
  imaCodigo: string;
  setorNome: string;
};

function formatDia(dia: Date) {
  return dia.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

function PendenciasPage() {
  const [periodo, setPeriodo] = useState<Periodo>("7d");
  const [filtroTurno, setFiltroTurno] = useState<"all" | Turno>("all");

  const desde = useMemo(() => {
    const dias = periodo === "7d" ? 7 : periodo === "30d" ? 30 : 90;
    const d = new Date();
    d.setDate(d.getDate() - (dias - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  }, [periodo]);

  const { data: imasAtivos, isLoading: loadingImas } = useQuery({
    queryKey: ["imas-ativos"],
    queryFn: () => listImasAtivos(),
  });

  const { data: registros, isLoading: loadingRegistros } = useQuery({
    queryKey: ["pendencias-registros", periodo],
    queryFn: () => listRegistrosDesde({ data: { desde: desde.toISOString() } }),
  });

  const isLoading = loadingImas || loadingRegistros;

  const pendencias = useMemo<PendenciaItem[]>(() => {
    if (!imasAtivos || !registros) return [];

    // Ímãs são identificados pelo código (único) — os registros não trazem o id do ímã.
    const feitos = new Set(
      registros.map((r) => `${r.imaCodigo}|${r.turno}|${diaKey(new Date(r.dataHora))}`),
    );

    const hoje = new Date();
    const hojeKey = diaKey(hoje);
    const turnoAtualIdx = TURNOS.indexOf(turnoAtual(hoje));

    const lista: PendenciaItem[] = [];
    for (const dia of diasUteis6x1Lista(desde, hoje)) {
      const dKey = diaKey(dia);
      const isHoje = dKey === hojeKey;
      for (const turno of TURNOS) {
        // Turnos de hoje que ainda não começaram não são pendência.
        if (isHoje && TURNOS.indexOf(turno) > turnoAtualIdx) continue;
        for (const ima of imasAtivos) {
          if (!feitos.has(`${ima.codigo}|${turno}|${dKey}`)) {
            lista.push({
              diaKey: dKey,
              dia,
              turno,
              imaId: ima.id,
              imaCodigo: ima.codigo,
              setorNome: ima.setorNome ?? "—",
            });
          }
        }
      }
    }
    return lista;
  }, [imasAtivos, registros, desde]);

  const pendenciasFiltradas = useMemo(
    () => (filtroTurno === "all" ? pendencias : pendencias.filter((p) => p.turno === filtroTurno)),
    [pendencias, filtroTurno],
  );

  const porIma = useMemo(() => {
    const map = new Map<
      string,
      { imaCodigo: string; setorNome: string; total: number; porTurno: Record<Turno, number> }
    >();
    pendenciasFiltradas.forEach((p) => {
      const cur = map.get(p.imaId) ?? {
        imaCodigo: p.imaCodigo,
        setorNome: p.setorNome,
        total: 0,
        porTurno: { A: 0, B: 0, C: 0 },
      };
      cur.total++;
      cur.porTurno[p.turno]++;
      map.set(p.imaId, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [pendenciasFiltradas]);

  const porTurno = useMemo(() => {
    const map: Record<Turno, { total: number; imas: Set<string> }> = {
      A: { total: 0, imas: new Set() },
      B: { total: 0, imas: new Set() },
      C: { total: 0, imas: new Set() },
    };
    pendenciasFiltradas.forEach((p) => {
      map[p.turno].total++;
      map[p.turno].imas.add(p.imaCodigo);
    });
    return map;
  }, [pendenciasFiltradas]);

  const porDia = useMemo(() => {
    const map = new Map<
      string,
      { dia: Date; total: number; porTurno: Record<Turno, PendenciaItem[]> }
    >();
    pendenciasFiltradas.forEach((p) => {
      const cur = map.get(p.diaKey) ?? {
        dia: p.dia,
        total: 0,
        porTurno: { A: [], B: [], C: [] },
      };
      cur.total++;
      cur.porTurno[p.turno].push(p);
      map.set(p.diaKey, cur);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, v]) => ({ key, ...v }));
  }, [pendenciasFiltradas]);

  const piorTurno = useMemo(() => {
    return TURNOS.reduce((pior, t) => (porTurno[t].total > porTurno[pior].total ? t : pior), "A" as Turno);
  }, [porTurno]);

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
        <div className="flex gap-2">
          <Select value={filtroTurno} onValueChange={(v) => setFiltroTurno(v as "all" | Turno)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Turno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os turnos</SelectItem>
              <SelectItem value="A">Turno A</SelectItem>
              <SelectItem value="B">Turno B</SelectItem>
              <SelectItem value="C">Turno C</SelectItem>
            </SelectContent>
          </Select>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          title="Pendências no período"
          value={pendenciasFiltradas.length}
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          hint={periodoInfo[periodo]}
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
          value={pendenciasFiltradas.length > 0 ? `Turno ${piorTurno}` : "—"}
          icon={<ListChecks className="h-4 w-4" />}
          hint={
            pendenciasFiltradas.length > 0 ? `${porTurno[piorTurno].total} pendências` : "Sem pendências"
          }
        />
        <KpiCard
          title="Dia com mais pendências"
          value={porDia.length > 0 ? formatDia([...porDia].sort((a, b) => b.total - a.total)[0].dia) : "—"}
          icon={<CalendarClock className="h-4 w-4" />}
          hint={
            porDia.length > 0
              ? `${[...porDia].sort((a, b) => b.total - a.total)[0].total} pendências`
              : "Sem pendências"
          }
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
                          {TURNOS.map((t) =>
                            i.porTurno[t] > 0 ? (
                              <Badge key={t} variant="outline">
                                Turno {t}: {i.porTurno[t]}
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
                        <TableHead>Turno A</TableHead>
                        <TableHead>Turno B</TableHead>
                        <TableHead>Turno C</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {porIma.map((i) => (
                        <TableRow key={i.imaCodigo}>
                          <TableCell className="font-medium">{i.imaCodigo}</TableCell>
                          <TableCell>{i.setorNome}</TableCell>
                          {TURNOS.map((t) => (
                            <TableCell key={t}>
                              {i.porTurno[t] > 0 ? (
                                <Badge variant="destructive">{i.porTurno[t]}</Badge>
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
          <div className="grid gap-4 md:grid-cols-3">
            {TURNOS.map((t) => (
              <Card key={t}>
                <CardHeader>
                  <CardTitle>Turno {t}</CardTitle>
                  <CardDescription>{porTurno[t].total} pendências no período</CardDescription>
                </CardHeader>
                <CardContent>
                  {porTurno[t].total === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem pendências.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">
                        {porTurno[t].imas.size} ímã(s) afetado(s)
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {porIma
                          .filter((i) => i.porTurno[t] > 0)
                          .slice(0, 12)
                          .map((i) => (
                            <Badge key={i.imaCodigo} variant="outline">
                              {i.imaCodigo} ({i.porTurno[t]})
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
              <CardDescription>Dias úteis (segunda a sábado) com limpezas em aberto</CardDescription>
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
                        <div className="grid gap-3 sm:grid-cols-3">
                          {TURNOS.map((t) => (
                            <div key={t}>
                              <div className="mb-1 text-xs font-medium text-muted-foreground">
                                Turno {t} ({d.porTurno[t].length})
                              </div>
                              {d.porTurno[t].length === 0 ? (
                                <span className="text-xs text-muted-foreground">
                                  Sem pendências
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {d.porTurno[t].map((p) => (
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
