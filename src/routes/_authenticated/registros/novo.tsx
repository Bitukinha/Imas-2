import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Camera, X } from "lucide-react";
import { turnoAtual, turnoLabel } from "@/lib/turno";
import { listImasAtivos } from "@/server/imas";
import { listUsuariosPorPapel } from "@/server/usuarios";
import { uploadArquivo } from "@/server/arquivos";
import { createRegistro } from "@/server/registros";
import { compressImageToBase64 } from "@/lib/image";

export const Route = createFileRoute("/_authenticated/registros/novo")({
  component: NovoRegistroPage,
});

type StatusOpt = "conforme" | "nao_conforme";

function NovoRegistroPage() {
  const navigate = useNavigate();

  const [turno, setTurno] = useState(turnoAtual());
  const [imaId, setImaId] = useState<string>("");
  const [responsavelId, setResponsavelId] = useState<string>("");
  const [monitorId, setMonitorId] = useState<string>("");
  const [status, setStatus] = useState<StatusOpt>("conforme");
  const [acao, setAcao] = useState("");
  const [obs, setObs] = useState("");
  const [fotoConforme, setFotoConforme] = useState<File | null>(null);
  const [fotoSujo, setFotoSujo] = useState<File | null>(null);
  const [fotoLimpo, setFotoLimpo] = useState<File | null>(null);

  useEffect(() => {
    const id = setInterval(() => setTurno(turnoAtual()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { data: imas } = useQuery({
    queryKey: ["imas-ativos"],
    queryFn: () => listImasAtivos(),
  });

  const { data: responsaveis } = useQuery({
    queryKey: ["responsaveis"],
    queryFn: () => listUsuariosPorPapel({ data: { roles: ["operador", "monitor", "admin"] } }),
  });

  const { data: monitores } = useQuery({
    queryKey: ["monitores"],
    queryFn: () => listUsuariosPorPapel({ data: { roles: ["monitor", "admin"] } }),
  });

  const uploadFoto = async (file: File) => {
    const { base64, contentType } = await compressImageToBase64(file);
    return uploadArquivo({ data: { contentType, dataBase64: base64 } });
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!imaId) throw new Error("Selecione o ímã");
      if (!responsavelId) throw new Error("Selecione o responsável");
      if (status === "conforme" && !fotoConforme) throw new Error("Anexe uma foto do ímã conforme");
      if (status === "nao_conforme") {
        if (!fotoSujo) throw new Error("Anexe a foto do ímã sujo");
        if (!fotoLimpo) throw new Error("Anexe a foto do ímã após a limpeza");
        if (!acao.trim()) throw new Error("Descreva a ação de limpeza tomada");
      }

      const ima = imas?.find((i) => i.id === imaId);
      if (!ima) throw new Error("Ímã inválido");

      const [fotoConfId, fotoSujoId, fotoLimpoId] = await Promise.all([
        fotoConforme ? uploadFoto(fotoConforme) : Promise.resolve(undefined),
        fotoSujo ? uploadFoto(fotoSujo) : Promise.resolve(undefined),
        fotoLimpo ? uploadFoto(fotoLimpo) : Promise.resolve(undefined),
      ]);

      await createRegistro({
        data: {
          turno,
          imaId,
          setorId: ima.setorId,
          responsavelId,
          monitorId: monitorId || undefined,
          status,
          acaoTomada: status === "nao_conforme" ? acao : undefined,
          observacoes: obs || undefined,
          fotoConformeId: fotoConfId,
          fotoSujoId: fotoSujoId,
          fotoLimpoId: fotoLimpoId,
        },
      });
    },
    onSuccess: () => {
      toast.success("Registro salvo");
      navigate({ to: "/registros" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Novo registro de limpeza</h1>
        <p className="text-sm text-muted-foreground">Preencha os dados da verificação do ímã</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Turno atual{" "}
            <Badge className="bg-primary text-primary-foreground">{turnoLabel(turno)}</Badge>
          </CardTitle>
          <CardDescription>Registrado em {new Date().toLocaleString("pt-BR")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Ímã</Label>
            <Select value={imaId} onValueChange={setImaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o ímã" />
              </SelectTrigger>
              <SelectContent>
                {imas?.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.codigo} — {i.setorNome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select value={responsavelId} onValueChange={setResponsavelId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent>
                {responsaveis?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Monitor (opcional)</Label>
            <Select value={monitorId} onValueChange={setMonitorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o monitor" />
              </SelectTrigger>
              <SelectContent>
                {monitores?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Turno</Label>
            <Select value={turno} onValueChange={(v) => setTurno(v as "A" | "B" | "C")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">Turno A (06:00 – 14:20)</SelectItem>
                <SelectItem value="B">Turno B (14:20 – 22:40)</SelectItem>
                <SelectItem value="C">Turno C (22:40 – 06:00)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status da verificação</CardTitle>
          <CardDescription>
            Marque conforme e anexe uma foto, ou não conforme e anexe as evidências e a limpeza.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={status} onValueChange={(v) => setStatus(v as StatusOpt)}>
            <div className="grid gap-3 md:grid-cols-2">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${
                  status === "conforme" ? "border-primary bg-primary/5" : ""
                }`}
              >
                <RadioGroupItem value="conforme" id="conforme" />
                <div>
                  <div className="font-medium">Conforme</div>
                  <div className="text-xs text-muted-foreground">
                    Ímã está limpo. Anexe uma foto de evidência.
                  </div>
                </div>
              </label>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${
                  status === "nao_conforme" ? "border-destructive bg-destructive/5" : ""
                }`}
              >
                <RadioGroupItem value="nao_conforme" id="nc" />
                <div>
                  <div className="font-medium">Não conforme</div>
                  <div className="text-xs text-muted-foreground">
                    Foi necessária limpeza. Anexe foto do sujo e após limpeza.
                  </div>
                </div>
              </label>
            </div>
          </RadioGroup>

          {status === "conforme" ? (
            <FileField
              label="Foto do ímã (conforme)"
              value={fotoConforme}
              onChange={setFotoConforme}
            />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FileField label="Foto do ímã sujo" value={fotoSujo} onChange={setFotoSujo} />
                <FileField label="Foto após limpeza" value={fotoLimpo} onChange={setFotoLimpo} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acao">Ação de limpeza tomada</Label>
                <Textarea
                  id="acao"
                  value={acao}
                  onChange={(e) => setAcao(e.target.value)}
                  placeholder="Descreva o que foi feito para regularizar"
                  rows={3}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="obs">Observações (opcional)</Label>
            <Textarea id="obs" value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => navigate({ to: "/registros" })}
        >
          Cancelar
        </Button>
        <Button
          className="w-full sm:w-auto"
          onClick={() => submit.mutate()}
          disabled={submit.isPending}
        >
          {submit.isPending ? "Salvando..." : "Salvar registro"}
        </Button>
      </div>
    </div>
  );
}

function FileField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: File | null;
  onChange: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = value ? URL.createObjectURL(value) : null;
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {preview ? (
        <div className="relative">
          <img src={preview} alt={label} className="h-40 w-full rounded-lg border object-cover" />
          <Button
            size="icon"
            variant="destructive"
            className="absolute right-2 top-2 h-7 w-7"
            onClick={() => onChange(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition hover:border-primary hover:text-primary"
        >
          <Camera className="h-8 w-8" />
          <span className="text-xs">Tirar foto ou selecionar</span>
          <Upload className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
