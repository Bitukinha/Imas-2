import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listRegistrosDesde } from "@/server/registros";
import { countImasAtivos } from "@/server/imas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { exportDashboardPdf } from "@/lib/export-pdf";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { CheckCircle2, AlertTriangle, Activity, TrendingUp, FileDown } from "lucide-react";
import { diasUteis6x1, turnoLabel, type Turno } from "@/lib/turno";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type Periodo = "7d" | "30d" | "90d";

const periodoLabel: Record<Periodo, string> = {
  "7d": "ultimos-7-dias",
  "30d": "ultimos-30-dias",
  "90d": "ultimos-90-dias",
};

function DashboardPage() {
  const [periodo, setPeriodo] = useState<Periodo>("30d");
  const [exportando, setExportando] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  const handleExportPdf = async () => {
    if (!pdfRef.current) return;
    setExportando(true);
    try {
      await exportDashboardPdf(pdfRef.current, periodoLabel[periodo]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar PDF");
    } finally {
      setExportando(false);
    }
  };

  const desde = useMemo(() => {
    const dias = periodo === "7d" ? 7 : periodo === "30d" ? 30 : 90;
    const d = new Date();
    d.setDate(d.getDate() - dias);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [periodo]);

  const { data: registros, isLoading } = useQuery({
    queryKey: ["dashboard-registros", periodo],
    queryFn: () => listRegistrosDesde({ data: { desde: desde.toISOString() } }),
  });

  const { data: imasCount } = useQuery({
    queryKey: ["imas-count"],
    queryFn: () => countImasAtivos(),
  });

  const stats = useMemo(() => {
    const total = registros?.length ?? 0;
    const conformes = registros?.filter((r) => r.status === "conforme").length ?? 0;
    const naoConformes = total - conformes;
    const acoes = registros?.filter((r) => r.acaoTomada).length ?? 0;
    const pctConforme = total > 0 ? Math.round((conformes / total) * 100) : 0;

    const turnos: Record<Turno, { conforme: number; nao_conforme: number; total: number }> = {
      A: { conforme: 0, nao_conforme: 0, total: 0 },
      B: { conforme: 0, nao_conforme: 0, total: 0 },
      C: { conforme: 0, nao_conforme: 0, total: 0 },
    };
    registros?.forEach((r) => {
      const t = r.turno as Turno;
      turnos[t].total++;
      if (r.status === "conforme") turnos[t].conforme++;
      else turnos[t].nao_conforme++;
    });

    const setorMap = new Map<string, { nome: string; conforme: number; nao_conforme: number }>();
    registros?.forEach((r) => {
      const nome = r.setorNome ?? "—";
      const cur = setorMap.get(nome) ?? { nome, conforme: 0, nao_conforme: 0 };
      if (r.status === "conforme") cur.conforme++;
      else cur.nao_conforme++;
      setorMap.set(nome, cur);
    });
    const porSetor = Array.from(setorMap.values());

    const imaMap = new Map<string, { codigo: string; nao_conforme: number }>();
    registros
      ?.filter((r) => r.status === "nao_conforme")
      .forEach((r) => {
        const codigo = r.imaCodigo ?? "—";
        const cur = imaMap.get(codigo) ?? { codigo, nao_conforme: 0 };
        cur.nao_conforme++;
        imaMap.set(codigo, cur);
      });
    const topNaoConformes = Array.from(imaMap.values())
      .sort((a, b) => b.nao_conforme - a.nao_conforme)
      .slice(0, 6);

    // Aderência: registros esperados = imas ativos * 3 turnos * dias úteis 6x1
    const diasUteis = diasUteis6x1(desde, new Date());
    const esperados = (imasCount ?? 0) * 3 * diasUteis;
    const aderencia = esperados > 0 ? Math.min(100, Math.round((total / esperados) * 100)) : 0;

    const aderenciaPorTurno: {
      turno: Turno;
      aderencia: number;
      realizados: number;
      esperados: number;
    }[] = (["A", "B", "C"] as Turno[]).map((t) => {
      const esp = (imasCount ?? 0) * diasUteis;
      const real = turnos[t].total;
      return {
        turno: t,
        realizados: real,
        esperados: esp,
        aderencia: esp > 0 ? Math.min(100, Math.round((real / esp) * 100)) : 0,
      };
    });

    return {
      total,
      conformes,
      naoConformes,
      acoes,
      pctConforme,
      turnos,
      porSetor,
      topNaoConformes,
      aderencia,
      aderenciaPorTurno,
      diasUteis,
      esperados,
    };
  }, [registros, imasCount, desde]);

  const rankingTurnos = useMemo(() => {
    return (["A", "B", "C"] as Turno[])
      .map((t) => {
        const dados = stats.turnos[t];
        const pct = dados.total > 0 ? Math.round((dados.conforme / dados.total) * 100) : 0;
        return {
          turno: t,
          ...dados,
          pctConforme: pct,
          aderencia: stats.aderenciaPorTurno.find((a) => a.turno === t)?.aderencia ?? 0,
        };
      })
      .sort((a, b) => b.pctConforme - a.pctConforme);
  }, [stats]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral da limpeza de ímãs — {stats.diasUteis} dias úteis no período
          </p>
        </div>
        <div className="flex gap-2">
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
          <Button variant="outline" onClick={handleExportPdf} disabled={exportando}>
            <FileDown className="mr-2 h-4 w-4" />
            {exportando ? "Exportando..." : "Exportar PDF"}
          </Button>
        </div>
      </div>

      {/* CONTEÚDO EXPORTÁVEL EM PDF */}
      <div ref={pdfRef} className="space-y-6">
        {/* KPI CARDS */}
        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard
            title="Total de registros"
            value={stats.total}
            icon={<Activity className="h-4 w-4" />}
            hint={`Esperado: ${stats.esperados}`}
          />
          <KpiCard
            title="Conformidade"
            value={`${stats.pctConforme}%`}
            icon={<CheckCircle2 className="h-4 w-4 text-success" />}
            hint={`${stats.conformes} conforme / ${stats.naoConformes} não conforme`}
            accent="success"
          />
          <KpiCard
            title="Não conformidades"
            value={stats.naoConformes}
            icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
            hint={`${stats.acoes} ações corretivas registradas`}
            accent={stats.naoConformes > 0 ? "destructive" : undefined}
          />
          <KpiCard
            title="Aderência 6x1"
            value={`${stats.aderencia}%`}
            icon={<TrendingUp className="h-4 w-4" />}
            hint={`${stats.total} / ${stats.esperados} previstos`}
            accent={
              stats.aderencia >= 90 ? "success" : stats.aderencia >= 70 ? undefined : "destructive"
            }
          />
        </div>

        {/* CHARTS */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Conformidade por turno</CardTitle>
              <CardDescription>Conforme vs. Não conforme em cada turno</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={(["A", "B", "C"] as Turno[]).map((t) => ({
                    turno: `Turno ${t}`,
                    Conforme: stats.turnos[t].conforme,
                    "Não conforme": stats.turnos[t].nao_conforme,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="turno" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Conforme" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                  <Bar
                    dataKey="Não conforme"
                    fill="var(--color-destructive)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Aderência por turno</CardTitle>
              <CardDescription>Registros realizados vs. esperados na escala 6x1</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={stats.aderenciaPorTurno.map((a) => ({
                    turno: `Turno ${a.turno}`,
                    Aderência: a.aderencia,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="turno" />
                  <YAxis domain={[0, 100]} unit="%" />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="Aderência" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Por setor</CardTitle>
              <CardDescription>Conformidade agregada por setor</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.porSetor} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="nome" width={100} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="conforme" stackId="a" name="Conforme" fill="var(--color-success)" />
                  <Bar
                    dataKey="nao_conforme"
                    stackId="a"
                    name="Não conforme"
                    fill="var(--color-destructive)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top ímãs com não conformidade</CardTitle>
              <CardDescription>Ímãs que mais tiveram ocorrências</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.topNaoConformes.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                  Nenhuma não conformidade no período.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={stats.topNaoConformes}
                      dataKey="nao_conforme"
                      nameKey="codigo"
                      outerRadius={100}
                      label
                    >
                      {stats.topNaoConformes.map((_, i) => (
                        <Cell key={i} fill={`var(--color-chart-${(i % 5) + 1})`} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RANKING */}
        <Card>
          <CardHeader>
            <CardTitle>Ranking de turnos</CardTitle>
            <CardDescription>Melhor e pior turno por conformidade</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {rankingTurnos.map((r, i) => (
              <div
                key={r.turno}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant={i === 0 ? "default" : i === 2 ? "destructive" : "secondary"}
                    className="h-8 w-8 justify-center rounded-full p-0"
                  >
                    {i + 1}
                  </Badge>
                  <div>
                    <div className="font-medium">{turnoLabel(r.turno)}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.total} registros — {r.conforme} conforme, {r.nao_conforme} não conforme
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 text-right">
                  <div>
                    <div className="text-xs text-muted-foreground">Conformidade</div>
                    <div className="text-lg font-semibold">{r.pctConforme}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Aderência</div>
                    <div className="text-lg font-semibold">{r.aderencia}%</div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Últimas não conformidades */}
        <Card>
          <CardHeader>
            <CardTitle>Últimas não conformidades</CardTitle>
            <CardDescription>Ocorrências recentes com ação corretiva</CardDescription>
          </CardHeader>
          <CardContent>
            {registros?.filter((r) => r.status === "nao_conforme").slice(0, 5).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem registros de não conformidade.</p>
            ) : (
              <div className="space-y-2">
                {registros
                  ?.filter((r) => r.status === "nao_conforme")
                  .slice(0, 5)
                  .map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm"
                    >
                      <div>
                        <div className="font-medium">
                          {r.imaCodigo} — {r.setorNome}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(r.dataHora).toLocaleString("pt-BR")} · Turno {r.turno}
                        </div>
                        {r.acaoTomada && (
                          <div className="mt-1 text-xs">
                            <span className="font-medium">Ação:</span> {r.acaoTomada}
                          </div>
                        )}
                      </div>
                      <Badge variant="destructive">Não conforme</Badge>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
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
