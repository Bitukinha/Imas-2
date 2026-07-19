// Fotos de celular costumam vir com vários MB; sem compressão o payload
// (base64, ~33% maior) estoura o limite de request body do Vercel (4.5MB).
export async function compressImageToBase64(
  file: File,
  maxDimension = 1600,
  quality = 0.75,
): Promise<{ base64: string; contentType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao comprimir imagem"))),
      "image/jpeg",
      quality,
    );
  });

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  return { base64, contentType: "image/jpeg" };
}
