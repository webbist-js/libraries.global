import { createHash } from "node:crypto"
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import ts from "typescript"

const workspace = fileURLToPath(new URL("../", import.meta.url))
const root = path.resolve(workspace, "../..")
const sourceRoot = path.join(root, "apps/ui/src")
const toRepo = (file) => path.relative(root, file).split(path.sep).join("/")
async function filesIn(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await filesIn(file)))
    else files.push(file)
  }

  return files.sort()
}
const sourceFiles = (await filesIn(sourceRoot)).filter((file) =>
  /\.(?:[cm]?[jt]sx?|css)$/.test(file)
)
const records = new Map()
const repeatedClasses = new Map()
const duplicateJsx = new Map()
const checksum = (text) =>
  createHash("sha256").update(text).digest("hex").slice(0, 12)
for (const file of sourceFiles) {
  const content = await readFile(file, "utf8")
  const name = toRepo(file)
  const isTest = /(?:__tests__|\.(?:test|spec)\.)/.test(name)
  const source = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const imports = []
  const exports = []
  let jsx = false
  let network = false
  let asyncExport = false
  // The recursive visitor captures this file’s AST and accumulators.
  // eslint-disable-next-line unicorn/consistent-function-scoping, sonarjs/cognitive-complexity
  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !node.importClause?.isTypeOnly
    )
      imports.push(node.moduleSpecifier.text)
    if (
      ts.isFunctionDeclaration(node) &&
      node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      if (node.name) exports.push(node.name.text)
      asyncExport ||= node.modifiers.some(
        (mod) => mod.kind === ts.SyntaxKind.AsyncKeyword
      )
    }
    if (
      ts.isExportDeclaration(node) &&
      node.exportClause &&
      ts.isNamedExports(node.exportClause)
    )
      exports.push(
        ...node.exportClause.elements
          .filter((item) => !item.isTypeOnly)
          .map((item) => item.name.text)
      )
    if (
      ts.isVariableStatement(node) &&
      node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)
    )
      exports.push(
        ...node.declarationList.declarations.map((decl) =>
          decl.name.getText(source)
        )
      )
    if (
      ts.isCallExpression(node) &&
      /^(?:fetch|useQuery|useMutation|useHydratedSession|useStaff|useEntitlements|useCapabilities|authClient\.)/.test(
        node.expression.getText(source)
      )
    )
      network = true
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      jsx = true
      if (!isTest) {
        const text = node.getText(source).replaceAll(/\s+/g, " ").trim()
        if (text.length >= 240) {
          const key = checksum(text)
          const group = duplicateJsx.get(key) ?? {
            size: text.length,
            sites: new Set(),
          }
          group.sites.add(
            `${name}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`
          )
          duplicateJsx.set(key, group)
        }
      }
    }
    if (
      !isTest &&
      ts.isJsxAttribute(node) &&
      node.name.getText(source) === "className" &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      node.initializer.text.length >= 100
    ) {
      const classes = node.initializer.text.split(/\s+/).sort().join(" ")
      const sites = repeatedClasses.get(classes) ?? new Set()
      sites.add(name)
      repeatedClasses.set(classes, sites)
    }
    ts.forEachChild(node, visit)
  }
  if (!file.endsWith(".css")) visit(source)
  const relative = path.relative(sourceRoot, file).split(path.sep)
  const layer =
    relative[0] === "components"
      ? relative[1] === "ui"
        ? "primitives"
        : relative[1] === "ds"
          ? "patterns"
          : `feature/${relative[1]}`
      : relative[0]
  const server =
    imports.some(
      (item) =>
        item === "server-only" ||
        item === "next/headers" ||
        /(?:\/server|access-server)$/.test(item)
    ) || asyncExport
  const role = isTest
    ? "test"
    : file.endsWith(".css")
      ? "style"
      : /(?:^|\/)(?:page|layout|loading|error|not-found|template)\.[jt]sx$/.test(
            name
          )
        ? "route"
        : jsx
          ? "component"
          : "support"
  records.set(file, {
    file,
    path: name,
    layer,
    role,
    exports: [...new Set(exports)].sort(),
    imports,
    server,
    network,
    direct: new Set(),
    composed: new Set(),
    hash: checksum(content),
    dependencies: [],
  })
}
function resolveSource(imported, from) {
  const base = imported.startsWith("@/")
    ? path.join(sourceRoot, imported.slice(2))
    : imported.startsWith(".")
      ? path.resolve(path.dirname(from), imported)
      : null
  if (!base) return null

  return (
    [
      base,
      ...[".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"].map(
        (ext) => base + ext
      ),
    ].find((file) => records.has(file)) ?? null
  )
}
for (const record of records.values())
  record.dependencies = record.imports
    .map((item) => resolveSource(item, record.file))
    .filter(Boolean)
// These seams are replaced in Storybook's Vite config, so don't count their app imports.
const seams = new Set(["apps/ui/src/lib/env-vars.ts"])
function reachable(file, seen = new Set()) {
  if (seen.has(file)) return seen
  seen.add(file)
  const record = records.get(file)
  if (record && !seams.has(record.path))
    for (const dependency of record.dependencies) reachable(dependency, seen)

  return seen
}
const stories = (await filesIn(path.join(workspace, "stories"))).filter(
  (file) => /\.stories\.[jt]sx?$/.test(file)
)
let storyCount = 0
for (const story of stories) {
  const content = await readFile(story, "utf8")
  const source = ts.createSourceFile(
    story,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  for (const statement of source.statements) {
    if (
      ts.isVariableStatement(statement) &&
      statement.modifiers?.some(
        (mod) => mod.kind === ts.SyntaxKind.ExportKeyword
      )
    )
      storyCount += statement.declarationList.declarations.length
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.importClause?.isTypeOnly
    )
      continue
    const target = resolveSource(statement.moduleSpecifier.text, story)
    if (!target) continue
    records.get(target).direct.add(toRepo(story))
    for (const dependency of reachable(target))
      if (dependency !== target)
        records.get(dependency).composed.add(toRepo(story))
  }
}
for (const record of records.values()) {
  const dependencies = [...reachable(record.file)]
    .map((file) => records.get(file))
    .filter(Boolean)
  record.boundaries = [
    dependencies.some((item) => item.server) ? "server" : null,
    dependencies.some((item) => item.network) ? "network/session" : null,
  ].filter(Boolean)
  record.status = ["style", "test", "support"].includes(record.role)
    ? record.role
    : record.direct.size
      ? "story-import"
      : record.composed.size
        ? "composition-import"
        : record.boundaries.length
          ? "needs-fixtures-or-extraction"
          : "needs-story"
}
const csvCell = (value) => `"${String(value).replaceAll('"', '""')}"`
const csv =
  [
    "path,layer,role,coverage,exported_symbols,story_modules,composition_modules,boundary_signals,source_sha256_prefix",
    ...[...records.values()].map((record) =>
      [
        record.path,
        record.layer,
        record.role,
        record.status,
        record.exports.join("; "),
        [...record.direct].join("; "),
        [...record.composed].join("; "),
        record.boundaries.join("; "),
        record.hash,
      ]
        .map(csvCell)
        .join(",")
    ),
  ].join("\n") + "\n"
const groups = new Map()
for (const record of records.values()) {
  const group = groups.get(record.layer) ?? {
    files: 0,
    visual: 0,
    direct: 0,
    composition: 0,
    fixtures: 0,
  }
  group.files++
  if (["component", "route"].includes(record.role)) {
    group.visual++
    if (record.direct.size) group.direct++
    else if (record.composed.size) group.composition++
    else if (record.boundaries.length) group.fixtures++
  }
  groups.set(record.layer, group)
}
const visual = [...records.values()].filter((record) =>
  ["component", "route"].includes(record.role)
)
const summary = `# UI inventory\n\nGenerated by \`pnpm storybook:inventory\`. Do not edit this file or inventory.csv by hand.\n\nScanned every TS/TSX/JS/JSX/CSS file under apps/ui/src: **${records.size} files**, including **${visual.length} component/route files**. The catalogue has **${stories.length} CSF modules** and **${storyCount} named stories**.\n\nThis is a structural inventory, not a claim that every UI has been visually reviewed. A story import records a module relationship, not coverage of every export or state. Composition imports can include unused exports, conditional branches and runtime seams. Boundary signals are conservative static hints; they are not proof that a module is browser-safe. Tests, CSS and supporting modules stay in the inventory so nothing silently disappears.\n\n| Area | Files | Components/routes | Story imports | Composition imports only | Uncovered with boundary signals |\n| --- | ---: | ---: | ---: | ---: | ---: |\n${[
  ...groups.entries(),
]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(
    ([area, g]) =>
      `| ${area} | ${g.files} | ${g.visual} | ${g.direct} | ${g.composition} | ${g.fixtures} |`
  )
  .join(
    "\n"
  )}\n\nThe CSV lists each file, its exported symbols, story importers, boundary signals and content hash. A changed hash invalidates the prior source snapshot. Use it with the handwritten pattern-library audit; do not merge components based on import counts or repeated class strings alone.\n`
const duplicated = [...duplicateJsx.entries()]
  .filter(
    ([, group]) =>
      new Set([...group.sites].map((site) => site.split(":")[0])).size > 1
  )
  .sort((a, b) => b[1].size * b[1].sites.size - a[1].size * a[1].sites.size)
  .slice(0, 20)
const classes = [...repeatedClasses.entries()]
  .filter(([, sites]) => sites.size > 1)
  .sort((a, b) => b[1].size * b[0].length - a[1].size * a[0].length)
  .slice(0, 20)
const findings = `# Structural duplication signals\n\nGenerated by \`pnpm storybook:inventory\`. These are review candidates, not automatic refactoring instructions. JSX comparison normalizes whitespace only; class comparison sorts literal tokens. Dynamic classes and semantic near-duplicates need a human review. Only the top 20 groups in each category are shown.\n\n## Repeated JSX subtrees\n\n${
  duplicated
    .map(
      ([key, group]) =>
        `- ${key} (${group.size} characters): ${[...group.sites]
          .sort()
          .map((site) => `\`${site}\``)
          .join(", ")}`
    )
    .join("\n") || "No exact cross-file matches above the threshold."
}\n\n## Repeated long class lists\n\n${classes
  .map(
    ([list, sites]) =>
      `- \`${list}\`\n  ${[...sites]
        .sort()
        .map((site) => `\`${site}\``)
        .join(", ")}`
  )
  .join("\n\n")}\n`
await mkdir(path.join(workspace, "audit"), { recursive: true })
let stale = false
for (const [name, content] of [
  ["inventory.csv", csv],
  ["coverage.md", summary],
  ["structural-findings.md", findings],
]) {
  const output = path.join(workspace, "audit", name)
  if (process.argv.includes("--check")) {
    const previous = await readFile(output, "utf8").catch(() => "")
    if (previous !== content) {
      console.error(
        `Stale Storybook audit: ${name}. Run pnpm storybook:inventory.`
      )
      stale = true
    }
  } else await writeFile(output, content)
}
if (stale) process.exitCode = 1
else
  process.stdout.write(
    `${records.size} UI files inventoried; ${stories.length} CSF modules; ${storyCount} stories.\n`
  )

// A Docs entry can silently replace a same-ID story (for example Reference).
// Verify the actual deployable index as well as the source catalogue.
if (process.argv.includes("--check-build")) {
  const index = JSON.parse(
    await readFile(path.join(workspace, "dist/index.json"), "utf8")
  )
  const builtStories = Object.values(index.entries).filter(
    (entry) => entry.type === "story"
  )
  if (builtStories.length !== storyCount) {
    console.error(
      `Built catalogue has ${builtStories.length} stories, but source declares ${storyCount}. Check duplicate story/Docs IDs, including exports named Reference.`
    )
    process.exitCode = 1
  } else
    process.stdout.write(
      `${builtStories.length} stories present in the static index.\n`
    )
}
