/** Offline editorial compiler. No environment, credentials, fetch or CMS writes. */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

const here = new URL("./", import.meta.url)
export const manifest = JSON.parse(readFileSync(new URL("manifest.json", here)))
const text = (value) => ({ type: "text", text: value })

export function inline(value) {
  const children = []
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g
  let cursor = 0
  for (const match of value.matchAll(pattern)) {
    if (match.index > cursor)
      children.push(text(value.slice(cursor, match.index)))
    assert.match(
      match[2],
      /^(https:\/\/|\/(?!\/))/,
      "Unsafe or unresolved link"
    )
    children.push({
      type: "link",
      url: match[2],
      children: [text(match[1])],
    })
    cursor = match.index + match[0].length
  }
  if (cursor < value.length) children.push(text(value.slice(cursor)))
  return children.length ? children : [text("")]
}

export function compileArticle(entry) {
  const source = readFileSync(new URL(entry.file, here), "utf8")
  assert.ok(!/[<>`]/.test(source), "Only reviewed plain Markdown is supported")
  const chunks = source.trim().split(/\n\s*\n/)
  assert.match(chunks[0], /^# [^\n]+$/, "One article title is required")
  const title = chunks.shift().slice(2)
  const summary = chunks.shift()
  assert.ok(summary && !summary.startsWith("#"), "Summary is required")
  const body = []
  let nodes = []
  const flush = () => {
    if (nodes.length)
      body.push({ __component: "content.rich-text", body: nodes })
    nodes = []
  }
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i].replace(/\n/g, " ")
    const image = /^!\[([^\]]+)\]\(([^)]+)\)$/.exec(chunk)
    if (image) {
      flush()
      const assetEntry = Object.entries(manifest.assets).find(
        ([, asset]) => asset.file === image[2]
      )
      assert.ok(assetEntry, "Image must have manifest provenance")
      const [imageAsset, asset] = assetEntry
      assert.equal(
        image[1],
        asset.alternativeText,
        "Image alt differs from manifest"
      )
      assert.equal(
        chunks[++i],
        asset.caption,
        "Image caption differs from manifest"
      )
      assert.ok(readFileSync(new URL(asset.file, here)).length > 0)
      body.push({
        __component: "content.image-block",
        imageAsset,
        alternativeText: asset.alternativeText,
        caption: asset.caption,
        fullWidth: true,
      })
    } else if (chunk.startsWith("## ")) {
      nodes.push({
        type: "heading",
        level: 2,
        children: inline(chunk.slice(3)),
      })
    } else {
      assert.ok(
        !/^(#|!\[|[-*] |\d+\. )/.test(chunk),
        "Unsupported block syntax"
      )
      nodes.push({ type: "paragraph", children: inline(chunk) })
    }
  }
  flush()
  return {
    ...entry,
    locale: manifest.locale,
    title,
    summary,
    readingTimeMinutes: Math.max(
      1,
      Math.ceil(source.split(/\s+/).length / 200)
    ),
    body,
  }
}

/** Resolve review-only references; caller owns production reads and safe writes. */
export function buildArticlePayload(
  article,
  { sectionDocumentId, assetIds = {} } = {}
) {
  const body = article.body.map((block) => {
    if (block.__component !== "content.image-block")
      return structuredClone(block)
    const { imageAsset, ...rest } = block
    const image = assetIds[imageAsset]
    assert.ok(
      Number.isSafeInteger(image) && image > 0,
      `Upload required: ${imageAsset}`
    )
    return { ...rest, image }
  })
  const content = {
    summary: article.summary,
    readingTimeMinutes: article.readingTimeMinutes,
    body,
  }
  if (
    article.operation === "update-existing-body-and-summary-preserve-metadata"
  ) {
    return content
  }
  assert.ok(
    typeof sectionDocumentId === "string" && sectionDocumentId.length > 0,
    "Resolve the production section document ID"
  )
  return {
    ...content,
    locale: article.locale,
    title: article.title,
    slug: article.slug,
    author: article.author,
    section: { connect: [{ documentId: sectionDocumentId }] },
    ...(article.model === "wiki-article"
      ? { articleStatus: article.articleStatus }
      : { publicationOrigin: article.publicationOrigin }),
  }
}

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]
  )
const renderNodes = (nodes) =>
  nodes
    .map((node) => {
      if (node.type === "text") return escape(node.text)
      if (node.type === "link")
        return `<a href="${escape(node.url)}">${renderNodes(node.children)}</a>`
      const tag = node.type === "heading" ? `h${node.level}` : "p"
      return `<${tag}>${renderNodes(node.children)}</${tag}>`
    })
    .join("\n")

export function buildBundle() {
  const articles = manifest.articles.map(compileArticle)
  const assets = Object.fromEntries(
    Object.entries(manifest.assets).map(([key, value]) => [
      key,
      {
        ...value,
        sha256: createHash("sha256")
          .update(readFileSync(new URL(value.file, here)))
          .digest("hex"),
      },
    ])
  )
  const bundle = {
    kind: "editorial-review-bundle-not-a-cms-payload",
    preparedOn: "2026-10-30",
    published: false,
    locale: manifest.locale,
    assets,
    articles,
  }
  writeFileSync(
    new URL("review-bundle.json", here),
    JSON.stringify(bundle, null, 2) + "\n"
  )
  const renderBody = (body) =>
    body
      .map((block) =>
        block.__component === "content.rich-text"
          ? renderNodes(block.body)
          : `<figure><img src="${escape(assets[block.imageAsset].file.replace("../assets/", "assets/"))}" alt="${escape(block.alternativeText)}"><figcaption>${escape(block.caption)}</figcaption></figure>`
      )
      .join("\n")
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Dark mode — editorial reading proof</title><style>
    :root { color-scheme: light; font: 18px/1.7 system-ui,sans-serif; color:#17162b; background:#f1ede5 }
    body { margin:0 } header,nav { max-width:900px; margin:32px auto; padding:0 24px } h1 { font:500 2.5rem/1.15 Georgia,serif } h2 { margin-top:2em; line-height:1.3 } a { color:#4338ca; text-underline-offset:3px } a:focus-visible { outline:3px solid #4338ca; outline-offset:4px } article { max-width:900px; margin:32px auto; padding:clamp(20px,5vw,64px); background:white; border:1px solid #d9d3c9; border-radius:20px } .status,figcaption { color:#55536a; font-size:.85rem } .summary { font-size:1.15rem } figure { margin:2rem 0 } img { display:block; width:100%; height:auto; border:1px solid #d9d3c9; border-radius:8px } figcaption { margin-top:10px } .links { display:flex; flex-wrap:wrap; gap:12px 24px } @media (max-width:600px) { h1 {font-size:2rem} article {margin:16px 12px} }
  </style><header><p class="status">Editorial reading proof · 30 October 2026 · not published</p><h1>Dark mode and the UI overhaul</h1><p>Content preview using existing article block types. This is not the production article renderer. Root-relative article links target the future site routes; use the contents links below to review this bundle.</p></header><nav aria-label="Articles" class="links">${articles.map((a) => `<a href="#${escape(a.slug)}">${escape(a.title)}</a>`).join("\n")}</nav>${articles.map((a) => `<article id="${escape(a.slug)}"><p class="status">${a.model === "blog-article" ? "Journal · From the Index · preview" : "Knowledge · Design system"}</p><h1>${escape(a.title)}</h1><p class="summary">${escape(a.summary)}</p>${renderBody(a.body)}</article>`).join("\n")}</html>`
  writeFileSync(new URL("../preview.html", here), html)
  return bundle
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const bundle = buildBundle()
  console.log(
    JSON.stringify({
      articles: bundle.articles.length,
      assets: Object.keys(bundle.assets).length,
      published: false,
      networkRequests: 0,
    })
  )
}
