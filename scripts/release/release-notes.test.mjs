import assert from "node:assert/strict"
import { createRequire } from "node:module"
import test from "node:test"
import { pathToFileURL } from "node:url"

// Exercise the installed release plugin, including its transitive template engine.
const rootRequire = createRequire(import.meta.url)
const releaseRequire = createRequire(rootRequire.resolve("semantic-release"))
const { generateNotes } = await import(
  pathToFileURL(
    releaseRequire.resolve("@semantic-release/release-notes-generator")
  )
)

test("the locked release tooling renders version notes without publishing", async () => {
  const notes = await generateNotes(
    {},
    {
      cwd: process.cwd(),
      options: {
        repositoryUrl: "https://github.com/webbist-js/libraries.global",
      },
      commits: [
        {
          hash: "a".repeat(40),
          message: "feat(ui): activate consented analytics",
        },
      ],
      lastRelease: { gitTag: "v3.0.0" },
      nextRelease: { gitTag: "v3.1.0", version: "3.1.0" },
      logger: { log() {}, error() {} },
    }
  )
  assert.match(notes, /3\.1\.0/)
  assert.match(notes, /activate consented analytics/)
})
