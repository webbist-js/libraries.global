import { fileURLToPath } from "node:url"

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    storybookTest({
      configDir: fileURLToPath(new URL("./.storybook", import.meta.url)),
    }),
  ],
  test: {
    name: "storybook",
    maxWorkers: 1,
    fileParallelism: false,
    setupFiles: ["./.storybook/collect-retired-frames.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({
        // Real map/globe rendering also runs on CI hosts without a GPU.
        launchOptions: {
          args: [
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
            // Lets the setup file reclaim retired story frames between files.
            "--js-flags=--expose-gc",
          ],
        },
        contextOptions: {
          colorScheme:
            process.env.STORYBOOK_APPEARANCE === "dark" ? "dark" : "light",
        },
      }),
      instances: [{ browser: "chromium" }],
    },
  },
})
