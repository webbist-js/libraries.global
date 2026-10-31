import { readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import ts from "typescript"

const workspace = fileURLToPath(new URL("../", import.meta.url))
const root = path.resolve(workspace, "../..")
const componentRoot = path.join(root, "apps/ui/src/components")
const appRoot = path.join(root, "apps/ui/src/app")
const isComponentSource = (file) =>
  file.startsWith(componentRoot) ||
  (file.startsWith(appRoot) &&
    file.endsWith(".tsx") &&
    !/\/(?:page|layout|loading|error|not-found|template|default|global-error)\.tsx$/.test(
      file
    ))
const repoPath = (file) => path.relative(root, file).split(path.sep).join("/")
async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const result = []
  for (const entry of entries) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...(await filesIn(file)))
    else if (
      /\.[jt]sx?$/.test(file) &&
      !/(?:__tests__|\.(?:test|spec)\.)/.test(file)
    )
      result.push(file)
  }

  return result.sort()
}
const components = [
  ...(await filesIn(componentRoot)),
  ...(await filesIn(appRoot)),
].filter(isComponentSource)
const stories = (await filesIn(path.join(workspace, "stories"))).filter(
  (file) => /\.stories\.[jt]sx?$/.test(file)
)
const configFile = ts.readConfigFile(
  path.join(workspace, "tsconfig.json"),
  ts.sys.readFile
)
const config = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  workspace
)
const program = ts.createProgram([...components, ...stories], {
  ...config.options,
  noEmit: true,
})
const checker = program.getTypeChecker()
const records = new Map()
function declarationOf(symbol) {
  if (!symbol) return null
  const target =
    // eslint-disable-next-line sonarjs/bitwise-operators -- TypeScript SymbolFlags is a bitmask.
    symbol.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(symbol)
      : symbol

  return target.valueDeclaration ?? target.declarations?.[0] ?? null
}
function keyOf(declaration) {
  return `${declaration.getSourceFile().fileName}:${declaration.pos}`
}
for (const file of components) {
  const source = program.getSourceFile(file)
  const module = source && checker.getSymbolAtLocation(source)
  if (!module) continue
  for (const symbol of checker.getExportsOfModule(module)) {
    const declaration = declarationOf(symbol)
    if (
      !declaration ||
      !isComponentSource(declaration.getSourceFile().fileName)
    )
      continue
    const name = symbol.name
    if (
      name !== "default" &&
      (!/^[A-Z][a-zA-Z0-9]+$/.test(name) || /^[A-Z_]+$/.test(name))
    )
      continue
    const type = checker.getTypeAtLocation(declaration)
    const signature = type.getCallSignatures()[0]
    if (
      !signature ||
      !/Element|ReactNode|JSX|^null$/.test(
        checker.typeToString(checker.getReturnTypeOfSignature(signature))
      )
    )
      continue
    const key = keyOf(declaration)
    const record = records.get(key) ?? {
      module: repoPath(declaration.getSourceFile().fileName),
      context: Boolean(
        type.getProperty("Provider") && type.getProperty("Consumer")
      ),
      exports: new Set(),
      stories: new Set(),
      composition: new Set(),
    }
    record.exports.add(name)
    records.set(key, record)
  }
}
const dependencyCache = new Map()
function dependenciesOf(declaration) {
  const key = keyOf(declaration)
  if (dependencyCache.has(key)) return dependencyCache.get(key)
  const result = []
  dependencyCache.set(key, result)
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const child = declarationOf(checker.getSymbolAtLocation(node.tagName))
      if (child && isComponentSource(child.getSourceFile().fileName))
        result.push(child)
    }
    // Renderer slots such as DayPicker's components.DayButton are real children.
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.initializer)) {
      const child = declarationOf(checker.getSymbolAtLocation(node.initializer))
      if (child && records.has(keyOf(child))) result.push(child)
    }
    ts.forEachChild(node, visit)
  }
  visit(declaration)

  return result
}
function recordComposition(declaration, story, seen = new Set()) {
  const key = keyOf(declaration)
  if (seen.has(key)) return
  seen.add(key)
  for (const child of dependenciesOf(declaration)) {
    records.get(keyOf(child))?.composition.add(story)
    recordComposition(child, story, seen)
  }
}
for (const file of stories) {
  const source = program.getSourceFile(file)
  function visit(node) {
    const target =
      ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)
        ? node.tagName
        : ts.isPropertyAssignment(node) &&
            node.name.getText(source) === "component"
          ? node.initializer
          : null
    if (target) {
      const declaration = declarationOf(checker.getSymbolAtLocation(target))
      if (
        declaration &&
        isComponentSource(declaration.getSourceFile().fileName)
      ) {
        records.get(keyOf(declaration))?.stories.add(repoPath(file))
        recordComposition(declaration, repoPath(file))
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}
const exclusions = JSON.parse(
  await readFile(
    path.join(workspace, "audit/component-exclusions.json"),
    "utf8"
  )
)
const rows = [...records.values()]
  .map((row) => {
    const exports = [...row.exports].sort()
    const key = `${row.module}#${exports.find((name) => name !== "default") ?? "default"}`
    const reason =
      exclusions[key] ??
      (row.context
        ? "React context object; exercised by its provider and consumer stories rather than a standalone visual component."
        : "")

    return {
      key,
      module: row.module,
      exports,
      stories: [...row.stories].sort(),
      composition: [...row.composition].sort(),
      status: row.stories.size
        ? "story"
        : row.composition.size
          ? "composition"
          : reason
            ? "nonvisual"
            : "missing",
      reason,
    }
  })
  .sort((a, b) => a.key.localeCompare(b.key))
const obsolete = Object.keys(exclusions).filter(
  (key) => !rows.some((row) => row.key === key)
)
const missing = rows.filter((row) => row.status === "missing")
const cell = (value) => `"${String(value).replaceAll('"', '""')}"`
const csv =
  [
    "component,module,exports,status,stories,composition,reason",
    ...rows.map((row) =>
      [
        row.key,
        row.module,
        row.exports.join("; "),
        row.status,
        row.stories.join("; "),
        row.composition.join("; "),
        row.reason,
      ]
        .map(cell)
        .join(",")
    ),
  ].join("\n") + "\n"
const output = path.join(workspace, "audit/components.csv")
if (process.argv.includes("--check")) {
  if ((await readFile(output, "utf8").catch(() => "")) !== csv) {
    console.error(
      "Stale component coverage: run pnpm --filter @repo/storybook coverage:inventory"
    )
    process.exitCode = 1
  }
  if (missing.length || obsolete.length) {
    console.error(
      `${missing.length} components missing stories; ${obsolete.length} obsolete exclusions.`
    )
    for (const row of missing.slice(0, 20)) console.error(row.key)
    process.exitCode = 1
  }
} else await writeFile(output, csv)
process.stdout.write(
  `${rows.length} distinct exported components: ${rows.filter((row) => row.status === "story").length} with direct stories, ${rows.filter((row) => row.status === "composition").length} in compositions, ${rows.filter((row) => row.status === "nonvisual").length} nonvisual, ${missing.length} missing.\n`
)
