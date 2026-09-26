import fs from "node:fs"
import path from "node:path"

import { defineConfig, devices, type Project } from "@playwright/test"
import dotenv from "dotenv"

const envPath = path.resolve(__dirname, ".env")
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: false, quiet: true })
}

const mobileViewportsEnabled =
  process.env.MOBILE_VIEWPORTS_TESTING_ENABLED === "true"

// The access role matrix (e2e/access) needs local seeded fixtures
// (`pnpm seed:access`), so it is opt-in: its project only exists when asked
// for with `--project=access`. The flag is mirrored into the env because
// workers re-load this config without the CLI arguments.
const argv = process.argv
if (
  argv.some(
    (a, i) =>
      a === "--project=access" ||
      (a === "--project" && argv[i + 1] === "access")
  )
)
  process.env.PLAYWRIGHT_ACCESS_PROJECT = "1"
const accessProjectEnabled = process.env.PLAYWRIGHT_ACCESS_PROJECT === "1"
const ACCESS_SPECS = ["e2e/access/**"]

const projects: Project[] = [
  {
    name: "chromium",
    testIgnore: ACCESS_SPECS,
    use: { ...devices["Desktop Chrome"] },
  },
  {
    name: "firefox",
    testIgnore: ACCESS_SPECS,
    use: { ...devices["Desktop Firefox"] },
  },
  {
    name: "webkit",
    testIgnore: ACCESS_SPECS,
    use: { ...devices["Desktop Safari"] },
  },
]

if (mobileViewportsEnabled) {
  projects.push(
    // Android
    {
      name: "Mobile Chrome (Pixel 7)",
      testIgnore: ACCESS_SPECS,
      use: { ...devices["Pixel 7"] },
    },
    // iOS
    {
      name: "Mobile Safari (iPhone 15)",
      testIgnore: ACCESS_SPECS,
      use: { ...devices["iPhone 15"] },
    }
  )
}

if (accessProjectEnabled) {
  projects.push({
    name: "access",
    testMatch: ["e2e/access/**/*.spec.ts"],
    fullyParallel: false,
    retries: 0,
    use: { ...devices["Desktop Chrome"] },
  })
}

projects.push({
  name: "seo",
  testMatch: ["seo/**/*.spec.ts"],
  retries: 0,
  use: {
    ...devices["Desktop Chrome"],
    trace: "off",
    screenshot: "off",
    video: "off",
  },
})

export default defineConfig({
  testDir: ".",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 3 : undefined,
  reporter: "html",

  use: {
    baseURL: process.env.BASE_URL,

    // Uncomment if credentials are needed
    // httpCredentials: {
    //   username: "xx",
    //   password: "yyy",
    // },

    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects,
})
