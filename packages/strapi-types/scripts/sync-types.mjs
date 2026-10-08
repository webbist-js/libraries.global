import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
} from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const source = fileURLToPath(
  new URL("../../../apps/strapi/types/generated/", import.meta.url)
)
const target = fileURLToPath(new URL("../generated/", import.meta.url))
mkdirSync(target, { recursive: true })
if (existsSync(source) && realpathSync(source) !== realpathSync(target)) {
  for (const file of readdirSync(source)) {
    if (file.endsWith(".d.ts"))
      copyFileSync(path.join(source, file), path.join(target, file))
  }
}
