import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { presetLabels, type Periodo, type PresetPeriodo } from "@/lib/periodo";

const PRESETS: PresetPeriodo[] = ["hoje", "7d", "30d", "90d", "mes", "tudo", "custom"];

export function PeriodoFilter({
  value,
  onChange,
  permitirTudo = false,
}: {
  value: Periodo;
  onChange: (p: Periodo) => void;
  /** Exibe a opção "Todo o período" (sem data inicial). */
  permitirTudo?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Select
        value={value.preset}
        onValueChange={(v) => onChange({ ...value, preset: v as PresetPeriodo })}
      >
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.filter((p) => permitirTudo || p !== "tudo").map((p) => (
            <SelectItem key={p} value={p}>
              {presetLabels[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value.preset === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="Data inicial"
            className="w-full sm:w-40"
            value={value.de}
            max={value.ate || undefined}
            onChange={(e) => onChange({ ...value, de: e.target.value })}
          />
          <span className="text-sm text-muted-foreground">até</span>
          <Input
            type="date"
            aria-label="Data final"
            className="w-full sm:w-40"
            value={value.ate}
            min={value.de || undefined}
            onChange={(e) => onChange({ ...value, ate: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
