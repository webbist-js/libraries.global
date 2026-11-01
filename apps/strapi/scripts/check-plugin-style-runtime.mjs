import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const plugins = fileURLToPath(new URL("../src/plugins/", import.meta.url))

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const name = path.join(directory, entry.name)

      return entry.isDirectory() ? files(name) : [name]
    })
  )

  return nested.flat()
}

// A plugin-local styled-components runtime has a different ThemeContext from
// Strapi's provider. Check the actual SDK output, including lazy page chunks.
for (const plugin of await readdir(plugins, { withFileTypes: true })) {
  if (!plugin.isDirectory()) continue
  const root = path.join(plugins, plugin.name)
  if (!existsSync(path.join(root, "admin"))) continue
  const sources = await files(path.join(root, "admin"))
  const usesSharedUI = (
    await Promise.all(
      sources.map(
        async (file) =>
          /\.[jt]sx?$/.test(file) &&
          (await readFile(file, "utf8")).includes("admin/components/PluginUI")
      )
    )
  ).some(Boolean)
  if (!usesSharedUI) continue
  const output = (await files(path.join(root, "dist"))).filter((file) =>
    /\.(?:mjs|js)$/.test(file)
  )
  let externalThemeRuntime = false
  for (const file of output) {
    const source = await readFile(file, "utf8")
    if (source.includes("data-styled-version")) {
      throw new Error(
        `${plugin.name} bundles a private styled-components runtime: ${path.relative(root, file)}`
      )
    }
    externalThemeRuntime ||=
      /(?:from\s*|require\s*\()?["']styled-components["']/.test(source)
  }
  if (!externalThemeRuntime)
    throw new Error(`${plugin.name} has no external styled-components import`)
  console.log(`${plugin.name}: uses the host styling runtime`)
}
