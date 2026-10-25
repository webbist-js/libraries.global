import { fileURLToPath } from "node:url"

export default {
  test: { include: ["tests/**/*.test.ts"], minWorkers: 1, maxWorkers: 1 },
  resolve: {
    alias: [
      {
        find: /^@repo\/shared-data$/,
        replacement: fileURLToPath(new URL("./index.ts", import.meta.url)),
      },
    ],
  },
}
