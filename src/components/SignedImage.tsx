import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import { getArquivo } from "@/server/arquivos";

export function SignedImage({ path, className }: { path: string | null; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    getArquivo({ data: { id: path } })
      .then((arquivo) => {
        if (!alive) return;
        if (!arquivo) setError(true);
        else setUrl(`data:${arquivo.contentType};base64,${arquivo.dataBase64}`);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [path]);

  if (!path || error) {
    return (
      <div
        className={
          "flex items-center justify-center bg-muted text-muted-foreground " + (className ?? "")
        }
      >
        <ImageIcon className="h-6 w-6" />
      </div>
    );
  }
  if (!url) {
    return <div className={"animate-pulse bg-muted " + (className ?? "")} />;
  }
  return <img src={url} alt="" className={className} />;
}
