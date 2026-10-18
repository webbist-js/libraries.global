const fs = require("node:fs")
const path = require("node:path")
const root = path.join(__dirname, "..")
fs.copyFileSync(
  path.join(root, "server/contracts.ts"),
  path.join(root, "types/index.d.ts")
)
