import { readFile } from "node:fs/promises"
import path from "node:path"

import { artifactDirectory } from "./runtime.js"

// Preserve the measured failure without regenerating a large local fixture.
const result = JSON.parse(
  await readFile(
    path.join(artifactDirectory, "pathological/build-z16.json"),
    "utf8"
  )
)
console.log(JSON.stringify(result, null, 2))
