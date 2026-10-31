import { fileURLToPath } from "node:url"

import base from "@repo/eslint-config"

export default [
  ...base.map((config) =>
    config.ignores
      ? {
          ...config,
          ignores: config.ignores.filter(
            (pattern) => !["**/.*", "**/.*/**"].includes(pattern)
          ),
        }
      : config
  ),
  {
    ignores: ["dist/**", "coverage/**", "public/**", ".turbo/**", ".cache/**"],
  },
  // Storybook config is executable source even though it lives in a dotfolder.
  {
    files: ["**/*.{ts,tsx,mjs}"],
    settings: {
      "import-x/resolver": {
        typescript: {
          project: fileURLToPath(new URL("./tsconfig.json", import.meta.url)),
        },
      },
    },
  },
]
