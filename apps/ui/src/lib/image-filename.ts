/** A readable media name; storage keys and ownership remain server controlled. */
export function imageFilename(name: string, type: string): string {
  const extension =
    type === "image/png"
      ? "png"
      : type === "image/webp"
        ? "webp"
        : type === "image/gif"
          ? "gif"
          : "jpg"
  let base = name
    .normalize("NFKC")
    .slice(0, 200)
    .replace(/\.(jpe?g|png|webp|gif)$/i, "")
    .replaceAll(/[^\p{L}\p{N}_ .-]/gu, "-")
    .trim()
  while (base.startsWith(".")) base = base.slice(1).trimStart()
  while (base.endsWith(".")) base = base.slice(0, -1).trimEnd()

  return `${base.slice(0, 100) || "image"}.${extension}`
}
