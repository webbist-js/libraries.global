import { expect, it } from "vitest"

import { sanitizeCmsHtml } from "./sanitize"

it.each([
  '<img src="/cover.jpg" onerror="alert(1)"><script>alert(1)</script>',
  '<a href="javascript:alert(1)">link</a><a href="&#106;avascript:alert(1)">encoded</a>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe><object data="x"></object>',
  '<svg><a xlink:href="javascript:alert(1)">bad</a></svg><math><mtext>bad</mtext></math>',
  '<form action="https://attacker.invalid"><input name="password"></form><style>body{display:none}</style>',
  '<div style="background:url(https://attacker.invalid)">text</div>',
])("removes executable and active CMS content", (html) => {
  expect(sanitizeCmsHtml(html)).not.toMatch(
    /onerror|javascript:|<script|<iframe|<object|<svg|<math|<form|<input|<style| style=/i
  )
})
it("preserves article formatting, accessible tables, images and ordinary links", () => {
  const html =
    '<figure class="image"><img src="https://cdn.example.org/a.jpg" alt="Library"><figcaption>A library</figcaption></figure><h2>Heading</h2><table><tr><th scope="col">Area</th><td>1</td></tr></table><p><a href="/en/knowledge">Read more</a> <strong>now</strong></p>'
  expect(sanitizeCmsHtml(html)).toContain('<th scope="col">Area</th>')
  expect(sanitizeCmsHtml(html)).toContain('href="/en/knowledge"')
  expect(sanitizeCmsHtml(html)).toContain('alt="Library"')
})
