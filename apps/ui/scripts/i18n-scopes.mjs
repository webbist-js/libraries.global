/**
 * Generate the client message scopes: which message namespaces each route
 * file must send to the browser.
 *
 * For every page and layout under `src/app/[locale]`, this walks the import
 * graph, follows modules into the client (anything reached from a
 * `"use client"` module) and records the namespaces those client modules use.
 * Server-only copy never enters a scope. `staticUi` is scoped per
 * sub-namespace (`staticUi.atlas`, `staticUi.common`, ...); every other
 * namespace is sent whole.
 *
 * Pages and layouts wrapped in `withMessages(Component, "<route id>")` send
 * only what their ancestors do not. Anything else (the root layout, client
 * pages, error/loading/not-found files) is served by the nearest wrapped
 * layout above it, so a forgotten wrapper costs bytes, never a message.
 *
 *   node scripts/i18n-scopes.mjs            write the manifest
 *   node scripts/i18n-scopes.mjs --check    fail if it is out of date
 *   node scripts/i18n-scopes.mjs --report   print payload per route
 */
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import zlib from "node:zlib"

import { mergeCatalogueFiles, readCatalogueFiles } from "./i18n-audit.mjs"

const require = createRequire(import.meta.url)
const ts = require("typescript")

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const srcDir = path.join(root, "src")
const appDir = path.join(srcDir, "app")
const localeDir = path.join(appDir, "[locale]")

export const MANIFEST = path.join(
  srcDir,
  "i18n",
  "client-scopes.generated.json"
)
export const ROOT_SCOPE = "[locale]/layout"
/** Namespaces large enough to be scoped one level deeper. */
const DEEP = new Set(["staticUi"])
const ROUTE_FILES = new Set([
  "layout",
  "page",
  "template",
  "error",
  "loading",
  "not-found",
  "default",
])
const BINDERS = new Set(["useTranslations", "getTranslations"])

const catalogue = mergeCatalogueFiles(readCatalogueFiles()).en

/** The scope unit that owns a message path, or undefined if it is not one. */
function unitOf(messagePath) {
  const parts = messagePath.split(".")
  const namespace = parts[0]
  if (!(namespace in catalogue)) return
  if (!DEEP.has(namespace)) return namespace
  if (parts.length < 2) return

  return parts[1] in catalogue[namespace]
    ? `${namespace}.${parts[1]}`
    : undefined
}

function exists(messagePath) {
  let node = catalogue
  for (const part of messagePath.split(".")) {
    if (!node || typeof node !== "object" || !(part in node)) return false
    node = node[part]
  }

  return true
}

// ---------------------------------------------------------------------------
// Module graph

const config = ts.parseJsonConfigFileContent(
  ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile).config,
  ts.sys,
  root
)
const resolutionCache = ts.createModuleResolutionCache(
  root,
  (name) => name,
  config.options
)

function resolve(specifier, from) {
  const { resolvedModule } = ts.resolveModuleName(
    specifier,
    from,
    config.options,
    ts.sys,
    resolutionCache
  )
  const file = resolvedModule?.resolvedFileName
  if (!file || resolvedModule.isExternalLibraryImport) return
  if (!file.startsWith(srcDir) || file.endsWith(".d.ts")) return

  return /\.(tsx?|jsx?|mjs)$/.test(file) ? file : undefined
}

const modules = new Map()

function directive(source) {
  for (const statement of source.statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isStringLiteral(statement.expression)
    )
      break
    const text = statement.expression.text
    if (text === "use client" || text === "use server") return text
  }
}

/** Parse a module once: its imports and the message units it can use. */
function moduleInfo(file) {
  const cached = modules.get(file)
  if (cached) return cached
  const text = fs.readFileSync(file, "utf8")
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  // Relative keys ("atlas.method_46") only count where the namespace appears,
  // so `contactModal`'s "atlas.short" is not read as `staticUi.atlas`.
  const relativeTo = [...DEEP].filter((namespace) => text.includes(namespace))
  const imports = new Set()
  const deferred = []
  const units = new Set()
  const unresolved = []
  // Template keys only matter where the namespace is not already whole.
  const dynamicKeys = []
  const partialTranslators = new Set()
  const line = (node) =>
    `${path.relative(root, file)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`

  function addImport(specifier) {
    const target = resolve(specifier, file)
    if (target) imports.add(target)
  }
  function addPath(text) {
    // Bare namespace names only count when bound (see BINDERS below).
    if (!text.includes(".")) return
    const unit = unitOf(text)
    if (unit && exists(text)) units.add(unit)
    // `staticUi` keys are written relative to the namespace: "atlas.method_46".
    for (const namespace of relativeTo) {
      const nested = `${namespace}.${text}`
      if (text.includes(".") && exists(nested)) units.add(unitOf(nested))
    }
  }
  function addPrefix(prefix, node) {
    const parts = prefix.split(".").slice(0, -1)
    for (const candidate of [
      parts,
      ...relativeTo.map((ns) => [ns, ...parts]),
    ]) {
      if (!candidate.length) continue
      const unit = unitOf(candidate.join("."))
      if (unit && (DEEP.has(candidate[0]) ? candidate.length > 1 : true)) {
        units.add(unit)

        return
      }
    }
    const call = node.parent
    if (
      ts.isCallExpression(call) &&
      call.arguments[0] === node &&
      /^t([A-Z]\w*)?(\.(rich|markup|raw|has))?$/.test(
        call.expression.getText(source)
      )
    )
      dynamicKeys.push(node)
  }

  function visit(node) {
    // withDeferredMessages(() => import("./Drawer"), "scope") loads the
    // module and its messages on demand, so neither joins this scope.
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(source) === "withDeferredMessages"
    ) {
      const [loader, scope] = node.arguments
      let target
      ;(function find(child) {
        if (
          ts.isCallExpression(child) &&
          child.expression.kind === ts.SyntaxKind.ImportKeyword &&
          ts.isStringLiteralLike(child.arguments[0])
        )
          target = resolve(child.arguments[0].text, file)
        else ts.forEachChild(child, find)
      })(loader)
      if (target && scope && ts.isStringLiteralLike(scope))
        deferred.push({ scope: scope.text, target })
      else
        unresolved.push(
          `${line(node)} needs withDeferredMessages(() => import("<module>"), "<scope>")`
        )

      return
    }
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause
      const typeOnly =
        clause?.isTypeOnly ||
        (clause &&
          !clause.name &&
          clause.namedBindings &&
          ts.isNamedImports(clause.namedBindings) &&
          clause.namedBindings.elements.length > 0 &&
          clause.namedBindings.elements.every((e) => e.isTypeOnly))
      if (!typeOnly) addImport(node.moduleSpecifier.text)
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      !node.isTypeOnly
    )
      addImport(node.moduleSpecifier.text)
    else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    )
      addImport(node.arguments[0].text)
    else if (
      ts.isCallExpression(node) &&
      BINDERS.has(node.expression.getText(source))
    ) {
      const [argument] = node.arguments
      const namespace =
        argument && ts.isObjectLiteralExpression(argument)
          ? argument.properties.find(
              (p) =>
                ts.isPropertyAssignment(p) &&
                p.name.getText(source) === "namespace"
            )?.initializer
          : argument
      if (
        !namespace ||
        (ts.isStringLiteralLike(namespace) && DEEP.has(namespace.text))
      ) {
        let holder = node.parent
        if (ts.isAwaitExpression(holder)) holder = holder.parent
        if (ts.isVariableDeclaration(holder) && ts.isIdentifier(holder.name))
          partialTranslators.add(holder.name.text)
      }
      if (namespace && ts.isStringLiteralLike(namespace)) {
        const unit = unitOf(namespace.text)
        if (unit) units.add(unit)
        else if (!DEEP.has(namespace.text) && !exists(namespace.text))
          unresolved.push(
            `${line(node)} uses unknown namespace "${namespace.text}"`
          )
      } else if (namespace)
        unresolved.push(`${line(node)} chooses its namespace at run time`)
    } else if (ts.isStringLiteralLike(node)) addPath(node.text)
    else if (ts.isTemplateExpression(node)) addPrefix(node.head.text, node)
    ts.forEachChild(node, visit)
  }
  visit(source)
  for (const node of dynamicKeys) {
    const callee = node.parent.expression.getText(source).split(".")[0]
    if (partialTranslators.has(callee))
      unresolved.push(`${line(node)} builds a message key at run time`)
  }

  const info = { kind: directive(source), imports, units, unresolved, deferred }
  modules.set(file, info)

  return info
}

/** Units used by client modules reachable from a route file. */
function clientUnits(entry, client = false) {
  const units = new Set()
  const unresolved = new Set()
  const deferred = []
  const seen = new Set()
  const stack = [[entry, client]]
  while (stack.length) {
    const [file, inClient] = stack.pop()
    const info = moduleInfo(file)
    const client = inClient || info.kind === "use client"
    // A server action imported by client code runs on the server.
    if (client && info.kind === "use server") continue
    const key = `${client ? "c" : "s"}${file}`
    if (seen.has(key)) continue
    seen.add(key)
    if (client) {
      for (const unit of info.units) units.add(unit)
      for (const message of info.unresolved) unresolved.add(message)
      deferred.push(...info.deferred)
    }
    for (const target of info.imports) stack.push([target, client])
  }

  return { units, unresolved, deferred }
}

// ---------------------------------------------------------------------------
// Routes

function routeFiles(directory = localeDir) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory())
      return entry.name.startsWith("_") || entry.name === "__tests__"
        ? []
        : routeFiles(full)
    const match = entry.name.match(/^(.+)\.(tsx|ts|jsx|js)$/)

    return match && ROUTE_FILES.has(match[1]) ? [full] : []
  })
}

const routeId = (file) =>
  path
    .relative(appDir, file)
    .replace(/\.(tsx|ts|jsx|js)$/, "")
    .split(path.sep)
    .join("/")

/** The id passed to `withMessages`, if the file wraps its default export. */
function wrappedId(file) {
  const text = fs.readFileSync(file, "utf8")
  const start = text.indexOf("withMessages(")

  return start === -1
    ? undefined
    : text.slice(start).match(/,\s*"([^"]+)"\s*\)/)?.[1]
}

export function generate() {
  const files = routeFiles()
  const errors = []
  const warnings = new Set()
  const byDir = new Map()
  const routes = new Map()
  const deferredRefs = []
  for (const file of files) {
    const id = routeId(file)
    const kind = path.basename(id)
    const dir = path.dirname(id)
    const isClient = moduleInfo(file).kind === "use client"
    const wrapped = wrappedId(file)
    if (wrapped && wrapped !== id)
      errors.push(
        `${path.relative(root, file)}: withMessages id "${wrapped}" should be "${id}"`
      )
    if (wrapped && isClient)
      errors.push(
        `${path.relative(root, file)}: a client module cannot use withMessages`
      )
    const owner =
      id === ROOT_SCOPE ||
      (Boolean(wrapped) && !isClient && (kind === "page" || kind === "layout"))
    const { units, unresolved, deferred } = clientUnits(file)
    for (const message of unresolved) warnings.add(message)
    deferredRefs.push(...deferred)
    const route = {
      id,
      kind,
      dir,
      file,
      owner,
      units,
      wrapped: Boolean(wrapped),
    }
    routes.set(id, route)
    if (!byDir.has(dir)) byDir.set(dir, [])
    byDir.get(dir).push(route)
    if ((kind === "page" || kind === "layout") && !owner && !isClient)
      warnings.add(
        `${path.relative(root, file)} is not wrapped in withMessages, so its messages load with its parent layout`
      )
  }

  /** The nearest owning layout at or above a directory. */
  function owningLayout(dir) {
    for (let d = dir; ; d = path.posix.dirname(d)) {
      const layout = routes.get(`${d}/layout`)
      if (layout?.owner) return layout
      if (d === "[locale]" || d === ".") break
    }

    return routes.get(ROOT_SCOPE)
  }

  // Needs that a non-owner hands to the layout it renders inside.
  const needs = new Map(
    [...routes.values()].map((r) => [r.id, new Set(r.units)])
  )
  for (const route of routes.values()) {
    if (route.owner) continue
    // A layout's non-owning segment files render inside that layout.
    const host =
      route.kind === "layout"
        ? owningLayout(path.posix.dirname(route.dir))
        : owningLayout(route.dir)
    for (const unit of route.units) needs.get(host.id).add(unit)
  }

  // Ancestors' sends are already in context; each owner sends the rest.
  const scopes = {}
  const ownersByDepth = [...routes.values()]
    .filter((r) => r.owner)
    .sort(
      (a, b) =>
        a.dir.split("/").length - b.dir.split("/").length ||
        (a.kind === "layout" ? -1 : 1)
    )
  const sent = new Map()
  for (const route of ownersByDepth) {
    const inherited = new Set()
    const start =
      route.kind === "layout" ? path.posix.dirname(route.dir) : route.dir
    if (route.id !== ROOT_SCOPE)
      for (let d = start; ; d = path.posix.dirname(d)) {
        const layout = routes.get(`${d}/layout`)
        if (layout?.owner)
          for (const unit of sent.get(layout.id) ?? []) inherited.add(unit)
        if (d === "[locale]" || d === ".") break
      }
    const own = [...needs.get(route.id)].filter((u) => !inherited.has(u)).sort()
    sent.set(route.id, new Set([...inherited, ...own]))
    scopes[route.id] = own
  }

  // Deferred scopes load inside the root layout's messages, wherever they open.
  const deferredScopes = {}
  const deferredTargets = new Map()
  while (deferredRefs.length) {
    const ref = deferredRefs.shift()
    const known = deferredTargets.get(ref.scope)
    if (known && known !== ref.target)
      errors.push(
        `Deferred scope "${ref.scope}" loads two modules: ${path.relative(root, known)} and ${path.relative(root, ref.target)}`
      )
    if (known) continue
    deferredTargets.set(ref.scope, ref.target)
    const { units, unresolved, deferred } = clientUnits(ref.target, true)
    for (const message of unresolved) warnings.add(message)
    deferredRefs.push(...deferred)
    const shell = sent.get(ROOT_SCOPE)
    deferredScopes[ref.scope] = [...units].filter((u) => !shell.has(u)).sort()
    sent.set(`deferred:${ref.scope}`, new Set(units))
  }

  const manifest = {
    $comment:
      "Generated by scripts/i18n-scopes.mjs. Run `pnpm --filter @repo/ui i18n:scopes` after changing which messages a client component uses.",
    scopes: Object.fromEntries(
      Object.entries(scopes).sort(([a], [b]) => a.localeCompare(b))
    ),
    deferred: Object.fromEntries(
      Object.entries(deferredScopes).sort(([a], [b]) => a.localeCompare(b))
    ),
  }

  return { manifest, errors, warnings: [...warnings].sort(), sent, routes }
}

function unitValue(unit) {
  return unit.split(".").reduce((node, part) => node[part], catalogue)
}

function payload(units) {
  const picked = {}
  for (const unit of units) {
    const parts = unit.split(".")
    let node = picked
    for (const part of parts.slice(0, -1)) node = node[part] ??= {}
    node[parts.at(-1)] = unitValue(unit)
  }
  const text = JSON.stringify(picked)

  return { raw: Buffer.byteLength(text), gzip: zlib.gzipSync(text).length }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { manifest, errors, warnings, sent, routes } = generate()
  const text = JSON.stringify(manifest, null, 2) + "\n"
  for (const warning of warnings) console.warn(`warning: ${warning}`)
  if (errors.length) {
    console.error(errors.join("\n"))
    process.exit(1)
  }
  if (process.argv.includes("--check")) {
    const current = fs.existsSync(MANIFEST)
      ? fs.readFileSync(MANIFEST, "utf8")
      : ""
    if (current !== text) {
      console.error(
        `${path.relative(root, MANIFEST)} is out of date. Run \`pnpm --filter @repo/ui i18n:scopes\`.`
      )
      process.exit(1)
    }
    console.log(
      `Client message scopes are up to date (${Object.keys(manifest.scopes).length} scopes).`
    )
  } else {
    fs.mkdirSync(path.dirname(MANIFEST), { recursive: true })
    fs.writeFileSync(MANIFEST, text)
    console.log(
      `Wrote ${Object.keys(manifest.scopes).length} client message scopes.`
    )
  }
  const whyIndex = process.argv.indexOf("--why")
  if (whyIndex !== -1) {
    // Which client boundaries a route reaches, and the messages each pulls in.
    const target = process.argv[whyIndex + 1]
    const route = routes.get(target)
    if (!route) throw new Error(`Unknown route "${target}"`)
    const boundaries = new Set()
    const seen = new Set()
    const stack = [route.file]
    while (stack.length) {
      const file = stack.pop()
      if (seen.has(file)) continue
      seen.add(file)
      const info = moduleInfo(file)
      if (info.kind === "use client") boundaries.add(file)
      else for (const next of info.imports) stack.push(next)
    }
    const rows = [...boundaries].map((file) => {
      const { units } = clientUnits(file)

      return {
        file: path.relative(root, file),
        units: [...units],
        ...payload(units),
      }
    })
    for (const row of rows.sort((a, b) => b.raw - a.raw))
      console.log(
        `${(row.raw / 1024).toFixed(1).padStart(7)} KiB  ${row.file}\n          ${row.units.sort().join(" ")}`
      )
  }
  if (process.argv.includes("--report")) {
    const full = payload(Object.keys(catalogue))
    const kib = (n) => `${(n / 1024).toFixed(1)} KiB`
    console.log(
      `\nWhole catalogue (en): ${kib(full.raw)} min, ${kib(full.gzip)} gzip`
    )
    const rows = [...routes.values()]
      .filter((r) => r.kind === "page")
      .map((page) => {
        const total = new Set(sent.get(page.id))
        if (!page.owner) {
          // Served entirely by its layouts.
          for (let d = page.dir; ; d = path.posix.dirname(d)) {
            const layout = routes.get(`${d}/layout`)
            if (layout?.owner)
              for (const unit of sent.get(layout.id) ?? []) total.add(unit)
            if (d === "[locale]" || d === ".") break
          }
          for (const unit of sent.get(ROOT_SCOPE)) total.add(unit)
        }

        return { id: page.id, ...payload(total) }
      })
      .sort((a, b) => b.raw - a.raw)
    const shell = payload(sent.get(ROOT_SCOPE))
    console.log(
      `Root layout (every page): ${kib(shell.raw)} min, ${kib(shell.gzip)} gzip`
    )
    for (const [scope, units] of Object.entries(manifest.deferred)) {
      const size = payload(units)
      console.log(
        `Deferred "${scope}" (on open): ${kib(size.raw)} min, ${kib(size.gzip)} gzip`
      )
    }
    console.log("\nFirst load per page, root included (en):")
    for (const row of rows)
      console.log(
        `${kib(row.raw).padStart(10)} ${kib(row.gzip).padStart(10)}  ${row.id}`
      )
  }
}
