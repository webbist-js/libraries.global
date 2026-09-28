import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

/**
 * Fetch a dataset file once and keep it in the ingest's git-ignored `.cache/`
 * folder, so every run reads the same bytes and the run log can record their
 * checksum. Pass `--file=path` to an ingest to use a copy you already have.
 */

export interface SourceFile {
  url?: string
  file: string
  sha256: string
}

export function sha256Of(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

export async function fetchSourceFile(
  url: string,
  cacheDir: string,
  localFile?: string
): Promise<SourceFile> {
  if (localFile) {
    if (!existsSync(localFile)) throw new Error(`No such file: ${localFile}`)

    return { file: localFile, sha256: sha256Of(localFile) }
  }

  mkdirSync(cacheDir, { recursive: true })
  const file = path.join(cacheDir, path.basename(new URL(url).pathname))

  if (!existsSync(file)) {
    console.log(`Downloading ${url}`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`GET ${url} → ${res.status}`)
    writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  }

  return { url, file, sha256: sha256Of(file) }
}

/** Unzip next to the archive (/usr/bin/unzip) and return the output folder. */
export function unzip(zipFile: string): string {
  const outDir = zipFile.replace(/\.zip$/i, "")
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true })
    execFileSync("/usr/bin/unzip", ["-o", "-q", zipFile, "-d", outDir])
  }

  return outDir
}
