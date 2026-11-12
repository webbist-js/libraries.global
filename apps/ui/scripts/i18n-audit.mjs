import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const ts = require("typescript")

const intlRequire = createRequire(require.resolve("next-intl"))
const parserRequire = createRequire(intlRequire.resolve("use-intl"))
const { parse } = parserRequire("@formatjs/icu-messageformat-parser")
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

export function flattenMessages(value, prefix = "", result = {}) {
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string") result[prefix + key] = child
    else flattenMessages(child, `${prefix}${key}.`, result)
  }

  return result
}

function argumentsOf(message) {
  const args = new Set()
  function visit(nodes) {
    for (const node of nodes) {
      if (node.type !== 0) args.add(`${node.type}:${node.value}`)
      if (node.options)
        for (const option of Object.values(node.options)) visit(option.value)
      if (node.children) visit(node.children)
    }
  }
  visit(parse(message))

  return [...args].sort()
}

/** Check key parity, ICU syntax and interpolation/rich-text arguments. */
export function checkMessages(catalogues) {
  const english = flattenMessages(catalogues.en)
  const errors = []
  for (const [locale, catalogue] of Object.entries(catalogues)) {
    const messages = flattenMessages(catalogue)
    for (const key of Object.keys(messages))
      if (!(key in english)) errors.push(`${locale}: unexpected ${key}`)
    for (const [key, source] of Object.entries(english)) {
      if (!(key in messages)) {
        errors.push(`${locale}: missing ${key}`)
        continue
      }
      if (!messages[key].trim()) errors.push(`${locale}: empty ${key}`)
      try {
        if (
          JSON.stringify(argumentsOf(source)) !==
          JSON.stringify(argumentsOf(messages[key]))
        )
          errors.push(`${locale}: ICU arguments differ for ${key}`)
      } catch (error) {
        errors.push(`${locale}: invalid ICU in ${key}: ${error.message}`)
      }
    }
  }

  return errors
}

export const LOCALES = ["en", "cs", "es", "fr", "ja"]
const localesDir = path.join(root, "locales")

function mergeTree(target, source, file, prefix = "") {
  for (const [key, value] of Object.entries(source)) {
    const name = prefix + key
    if (!(key in target)) target[key] = value
    else if (typeof target[key] === "object" && typeof value === "object") {
      target[key] = { ...target[key] }
      mergeTree(target[key], value, file, `${name}.`)
    } else
      throw new Error(`${file}: "${name}" is already defined in another file`)
  }

  return target
}

/** Read each locale's feature files (`locales/<locale>/*.json`). */
export function readCatalogueFiles(directory = localesDir) {
  return Object.fromEntries(
    LOCALES.map((locale) => {
      const dir = path.join(directory, locale)
      const files = fs
        .readdirSync(dir)
        .filter((name) => name.endsWith(".json"))
        .sort()

      return [
        locale,
        Object.fromEntries(
          files.map((name) => [
            name.slice(0, -5),
            JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")),
          ])
        ),
      ]
    })
  )
}

/** Merge feature files into one catalogue per locale, as the app does. */
export function mergeCatalogueFiles(files) {
  return Object.fromEntries(
    Object.entries(files).map(([locale, parts]) => [
      locale,
      Object.entries(parts).reduce(
        (merged, [name, part]) => mergeTree(merged, part, `${locale}/${name}`),
        {}
      ),
    ])
  )
}

/** Every locale has the same feature files, each owning the same messages. */
export function checkCatalogueFiles(files, directory = localesDir) {
  const errors = []
  for (const locale of LOCALES)
    if (fs.existsSync(path.join(directory, `${locale}.json`)))
      errors.push(
        `locales/${locale}.json exists: catalogues are split by feature under locales/${locale}/. Move its messages into those files.`
      )
  const index = fs.readFileSync(path.join(directory, "catalogue.ts"), "utf8")
  const listed = [
    ...index
      .match(/CATALOGUE_FILES = \[([\s\S]*?)\]/)[1]
      .matchAll(/"([^"]+)"/g),
  ].map((match) => match[1])
  for (const [locale, parts] of Object.entries(files)) {
    const names = Object.keys(parts)
    for (const name of listed)
      if (!names.includes(name))
        errors.push(`${locale}: missing feature file ${name}.json`)
    for (const name of names) {
      if (!listed.includes(name))
        errors.push(
          `${locale}: ${name}.json is not listed in CATALOGUE_FILES (locales/catalogue.ts)`
        )
      if (locale === "en" || !files.en[name]) continue
      const english = Object.keys(flattenMessages(files.en[name]))
      const own = new Set(Object.keys(flattenMessages(parts[name])))
      const misplaced = english.filter((key) => !own.has(key))
      if (misplaced.length)
        errors.push(
          `${locale}/${name}.json: ${misplaced.length} message(s) not in the same file as English, e.g. ${misplaced[0]}`
        )
    }
  }

  return errors
}

const excluded = /(?:__tests__|\.test\.|\.d\.ts$|\/test\/)/
function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name)

    return entry.isDirectory()
      ? sourceFiles(full)
      : /\.tsx?$/.test(full) && !excluded.test(full)
        ? [full]
        : []
  })
}

/** Candidates are review evidence, not a claim that every literal needs translating. */
export function staticContentInventory() {
  const rows = []
  const labels = new Set([
    "placeholder",
    "aria-label",
    "title",
    "alt",
    "label",
    "description",
    "heading",
    "lead",
    "section",
    "submitLabel",
    "emptyText",
    "hint",
    "text",
    "message",
    "error",
  ])
  for (const file of sourceFiles(path.join(root, "src"))) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true
    )
    const translatorFactories = new Set([
      "useTranslations",
      "getTranslations",
      "createTranslator",
    ])
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement)) continue
      const bindings = statement.importClause?.namedBindings
      if (!bindings || !ts.isNamedImports(bindings)) continue
      for (const specifier of bindings.elements) {
        if (
          translatorFactories.has(
            specifier.propertyName?.text ?? specifier.name.text
          )
        )
          translatorFactories.add(specifier.name.text)
      }
    }
    const translators = new Set()
    function collectTranslators(node) {
      if (ts.isVariableDeclaration(node) && node.initializer) {
        const initializer = ts.isAwaitExpression(node.initializer)
          ? node.initializer.expression
          : node.initializer
        if (
          ts.isCallExpression(initializer) &&
          translatorFactories.has(initializer.expression.getText(source))
        )
          translators.add(node.name.getText(source))
      }
      ts.forEachChild(node, collectTranslators)
    }
    collectTranslators(source)
    function isTranslationKey(node) {
      const parent = node.parent
      if (
        !parent ||
        !ts.isCallExpression(parent) ||
        parent.arguments[0] !== node
      )
        return false
      const expression = ts.isPropertyAccessExpression(parent.expression)
        ? parent.expression.expression
        : parent.expression

      return translators.has(expression.getText(source))
    }
    function visit(node) {
      if (isTranslationKey(node)) return
      let text, kind
      if (ts.isJsxText(node)) {
        text = node.text.trim().replaceAll(/\s+/g, " ")
        kind = "jsx"
      } else if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateExpression(node)
      ) {
        const literalText = ts.isTemplateExpression(node)
          ? node.getText(source).slice(1, -1)
          : node.text
        const parent = node.parent
        if (
          ts.isJsxAttribute(parent) &&
          labels.has(parent.name.getText(source))
        ) {
          text = literalText
          kind = "attribute"
        } else if (
          ts.isPropertyAssignment(parent) &&
          labels.has(parent.name.getText(source).replaceAll('"', ""))
        ) {
          text = literalText
          kind = "display-property"
        } else if (
          ts.isCallExpression(parent) &&
          /^toast\.(error|success|info|warning|message|loading)$/.test(
            parent.expression.getText(source)
          )
        ) {
          text = literalText
          kind = "toast"
        } else {
          let ancestor = parent
          while (
            ancestor &&
            !ts.isStatement(ancestor) &&
            !ts.isJsxExpression(ancestor) &&
            !ts.isJsxAttribute(ancestor)
          )
            ancestor = ancestor.parent
          if (
            ancestor &&
            ts.isJsxExpression(ancestor) &&
            (!ts.isJsxAttribute(ancestor.parent) ||
              labels.has(ancestor.parent.name.getText(source)))
          ) {
            text = literalText
            kind = "jsx-expression"
          }
        }
      }
      if (
        text &&
        /[A-Za-z]{2}/.test(text) &&
        !/^(?:[a-z_]+$|[a-z]+:[a-z-]+$|https?:\/\/|\/)/.test(text)
      ) {
        rows.push({
          file: path.relative(root, file),
          line:
            source.getLineAndCharacterOfPosition(node.getStart(source)).line +
            1,
          kind,
          text,
        })
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }

  return rows
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const files = readCatalogueFiles()
  const catalogues = mergeCatalogueFiles(files)
  const errors = [...checkCatalogueFiles(files), ...checkMessages(catalogues)]
  if (errors.length) {
    console.error(errors.join("\n"))
    process.exitCode = 1
  } else
    console.log(
      `Message parity and ICU valid: ${Object.keys(flattenMessages(catalogues.en)).length} messages × ${Object.keys(catalogues).length} locales.`
    )
  if (!process.argv.includes("--check")) {
    const rows = staticContentInventory()
    const outputIndex = process.argv.indexOf("--output")
    if (outputIndex !== -1) {
      const output = path.resolve(process.argv[outputIndex + 1])
      fs.mkdirSync(path.dirname(output), { recursive: true })
      fs.writeFileSync(output, JSON.stringify(rows, null, 2) + "\n")
    }
    console.log(
      `Static text candidates remaining: ${rows.length} across ${new Set(rows.map((r) => r.file)).size} files.`
    )
  }
}
