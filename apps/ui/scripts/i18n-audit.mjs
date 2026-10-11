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
    function visit(node) {
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
  const catalogues = Object.fromEntries(
    ["en", "cs", "fr"].map((locale) => [
      locale,
      JSON.parse(
        fs.readFileSync(path.join(root, "locales", `${locale}.json`), "utf8")
      ),
    ])
  )
  const errors = checkMessages(catalogues)
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
