export type DocumentPreviewKind = "pdf" | "image" | "other";

export function guessDocKind(
  mimeType: string | undefined,
  fileName: string | undefined,
): DocumentPreviewKind {
  const mt = (mimeType || "").toLowerCase();
  const fn = (fileName || "").toLowerCase();
  if (mt.includes("pdf") || fn.endsWith(".pdf")) return "pdf";
  if (mt.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp|svg)$/.test(fn)) return "image";
  return "other";
}
