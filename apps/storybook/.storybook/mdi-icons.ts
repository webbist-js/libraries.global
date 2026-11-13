import { readdirSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

import type { Plugin } from "vite"

const MODULE_ID = "virtual:storybook-mdi-icons"
const RESOLVED_ID = `\0${MODULE_ID}`
const ICON_NAME = /\bmdi:([a-z\d]+(?:-[a-z\d]+)*)/g
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|json|mdx)$/

type IconSet = {
  prefix: string
  icons: Record<string, unknown>
  aliases?: Record<string, { parent: string }>
  [key: string]: unknown
}

function iconNames(roots: readonly string[]) {
  const names = new Set<string>()
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".next"))
        continue
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(file)
      else if (SOURCE_FILE.test(entry.name))
        for (const match of readFileSync(file, "utf8").matchAll(ICON_NAME))
          if (match[1]) names.add(match[1])
    }
  }
  for (const root of roots) visit(root)

  return names
}

/** The named icons, plus the parents their aliases point at. */
function subset(set: IconSet, names: Set<string>): IconSet {
  const icons: IconSet["icons"] = {}
  const aliases: NonNullable<IconSet["aliases"]> = {}
  const add = (name: string, depth = 0) => {
    if (set.icons[name]) icons[name] = set.icons[name]
    const alias = set.aliases?.[name]
    if (alias && depth < 8) {
      aliases[name] = alias
      add(alias.parent, depth + 1)
    }
  }
  for (const name of names) add(name)

  return { ...set, icons, aliases }
}

/**
 * Registers only the MDI icons the UI and stories name, instead of the whole
 * collection. Every story test renders in a fresh frame that evaluates the
 * preview again, so a full collection was parsed for each story file.
 */
export function mdiIcons(roots: readonly string[]): Plugin {
  const require = createRequire(import.meta.url)

  return {
    name: "storybook-mdi-icons",
    resolveId: (id) => (id === MODULE_ID ? RESOLVED_ID : undefined),
    load(id) {
      if (id !== RESOLVED_ID) return
      const set = JSON.parse(
        readFileSync(require.resolve("@iconify-json/mdi/icons.json"), "utf8")
      ) as IconSet

      return `export default ${JSON.stringify(subset(set, iconNames(roots)))}`
    },
    handleHotUpdate({ server, file }) {
      if (!roots.some((root) => file.startsWith(root))) return
      const module = server.moduleGraph.getModuleById(RESOLVED_ID)
      if (module) server.moduleGraph.invalidateModule(module)
    },
  }
}
