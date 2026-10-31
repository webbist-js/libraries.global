import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { ESLint } from "eslint"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const baselinePath = path.join(root, "qa/lint/warnings.json")
const baseline = JSON.parse(await fs.readFile(baselinePath, "utf8"))
const workspaces = []
for (const directory of ["apps", "packages"]) {
  for (const entry of await fs.readdir(path.join(root, directory), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue
    const relative = `${directory}/${entry.name}`
    try {
      const pkg = JSON.parse(
        await fs.readFile(path.join(root, relative, "package.json"), "utf8")
      )
      if (pkg.scripts?.lint) workspaces.push(relative)
    } catch (error) {
      if (error.code !== "ENOENT") throw error
    }
  }
}
workspaces.push("qa/tests/playwright")
const current = {}
let errors = 0
let warnings = 0
for (const directory of workspaces) {
  const engine = new ESLint({
    cwd: path.join(root, directory),
    overrideConfigFile: path.join(
      root,
      ["apps/ui", "apps/storybook"].includes(directory)
        ? `${directory}/eslint.config.mjs`
        : "eslint.config.mjs"
    ),
  })
  const files = await engine.lintFiles(["**/*.{js,ts,jsx,tsx,cjs,mjs}"])
  for (const file of files) {
    const relative = path
      .relative(root, file.filePath)
      .split(path.sep)
      .join("/")
    const counts = {}
    for (const message of file.messages) {
      if (message.severity === 2) {
        errors++
        console.error(
          `${relative}:${message.line}:${message.column} ${message.ruleId ?? "parse"}: ${message.message}`
        )
      } else if (message.severity === 1) {
        warnings++
        const rule = message.ruleId ?? "configuration"
        counts[rule] = (counts[rule] ?? 0) + 1
      }
    }
    if (Object.keys(counts).length) current[relative] = counts
    for (const [rule, count] of Object.entries(counts)) {
      const allowed = baseline.files[relative]?.[rule] ?? 0
      if (count > allowed) {
        errors++
        console.error(
          `${relative}: ${rule}: ${count} warnings exceeds the reviewed baseline of ${allowed}`
        )
      }
    }
  }
  console.log(`Checked ${directory}`)
}
if (errors) {
  console.error(
    `Lint ratchet failed: ${errors} errors or warning increases. Existing warnings: ${warnings}.`
  )
  process.exitCode = 1
} else {
  if (process.argv.includes("--tighten")) {
    const files = Object.fromEntries(
      Object.keys(current)
        .sort()
        .map((file) => [
          file,
          Object.fromEntries(
            Object.entries(current[file]).sort(([a], [b]) => a.localeCompare(b))
          ),
        ])
    )
    await fs.writeFile(
      baselinePath,
      JSON.stringify({ version: 1, files }, null, 2) + "\n"
    )
  }
  console.log(
    `Lint ratchet passed: no errors or warning increases (${warnings} existing warnings).`
  )
}
