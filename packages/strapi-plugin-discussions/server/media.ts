import {
  mkdir,
  opendir,
  readFile,
  realpath,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises"
import path from "node:path"

import sharp from "sharp"

import type { DiscussionConfig, MediaStore } from "./contracts"
import { fail } from "./validation"

export async function sanitiseImage(bytes: Uint8Array, maxBytes: number) {
  if (!bytes.length || bytes.length > maxBytes)
    fail(413, "Discussion image exceeds the size limit")
  try {
    const image = sharp(bytes, {
      limitInputPixels: 20_000_000,
      failOn: "warning",
    })
    const metadata = await image.metadata()
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? ""))
      fail(400, "Use a JPEG, PNG or WebP image")
    const result = await image
      .rotate()
      .resize({
        width: 2048,
        height: 2048,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true })
    if (result.data.length > maxBytes)
      fail(413, "Converted image exceeds the size limit")

    return {
      bytes: result.data,
      width: result.info.width,
      height: result.info.height,
      mime: "image/webp",
    }
  } catch (error: any) {
    if (error.status) throw error

    return fail(400, "The image could not be safely decoded")
  }
}
export function mediaStore(strapi: any, config: DiscussionConfig): MediaStore {
  if (config.mediaStore) return config.mediaStore
  const root = path.resolve(strapi.dirs?.app?.root ?? process.cwd())
  const directory = path.resolve(
    config.mediaDirectory ??
      path.join(root, ".tmp", "discussions-private-media")
  )
  async function file(key: string) {
    if (!/^[a-f0-9-]{36}$/.test(key)) fail(400, "Invalid image storage key")
    await mkdir(directory, { recursive: true, mode: 0o700 })
    const resolved = await realpath(directory)
    const publicPath = path.resolve(root, "public")
    let resolvedPublic = publicPath
    try {
      resolvedPublic = await realpath(publicPath)
    } catch {
      /* A fresh host may not have a public directory. */
    }
    if (
      resolved === resolvedPublic ||
      resolved.startsWith(`${resolvedPublic}${path.sep}`)
    )
      throw new Error("Discussion media storage must be outside public")

    return path.join(resolved, `${key}.webp`)
  }

  return {
    async put(key, bytes) {
      await writeFile(await file(key), bytes, { flag: "wx", mode: 0o600 })
    },
    async get(key) {
      try {
        const filename = await file(key)
        if ((await stat(filename)).size > config.maxImageBytes)
          throw new Error("Stored discussion image exceeds limit")

        return await readFile(filename)
      } catch (error: any) {
        if (error.code === "ENOENT") return null
        throw error
      }
    },
    async prune(retained, olderThan, limit) {
      const resolved = path.dirname(
        await file("00000000-0000-0000-0000-000000000000")
      )
      let visited = 0,
        removed = 0
      for await (const entry of await opendir(resolved)) {
        if (++visited > 10000 || removed >= limit) break
        const key = entry.name.replace(/\.webp$/, "")
        if (
          !entry.isFile() ||
          !/^[a-f0-9-]{36}\.webp$/.test(entry.name) ||
          retained.has(key)
        )
          continue
        const filename = path.join(resolved, entry.name)
        if ((await stat(filename)).mtime < olderThan) {
          await unlink(filename)
          removed++
        }
      }
    },
    async delete(key) {
      try {
        await unlink(await file(key))
      } catch (error: any) {
        if (error.code !== "ENOENT") throw error
      }
    },
  }
}
