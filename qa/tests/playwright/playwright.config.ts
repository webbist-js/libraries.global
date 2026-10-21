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
// Workers reload this file without the runner's CLI arguments.
if (argv.includes("--project=admin")) process.env.QA_ADMIN_PROJECT = "1"
if (argv.includes("--project=smoke")) process.env.QA_SMOKE = "1"
if (
  argv.some(
    (a, i) =>
      a === "--project=access" ||
      (a === "--project" && argv[i + 1] === "access")
  )
)
  process.env.PLAYWRIGHT_ACCESS_PROJECT = "1"
const accessProjectEnabled = process.env.PLAYWRIGHT_ACCESS_PROJECT === "1"
// Playwright's failure DOM context includes password input values. Never
// attach it to an authenticated fixture run, even with traces disabled.
if (accessProjectEnabled || process.env.QA_ADMIN_PROJECT === "1")
  process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1"
const ACCESS_SPECS = ["e2e/access/**", "admin/**", "smoke/**"]

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
    // Every spec here signs in, and Better Auth allows 5 sign-ins a minute
    // per IP: one worker makes the files take turns rather than race.
    workers: 1,
    retries: 0,
    // The project timeout is also the beforeAll/afterAll hook timeout
    // (test.describe.configure only covers tests). A hook that signs in
    // three or four fixtures after another file has spent the minute's
    // budget waits out a 429 or two, which the 30 s default cut short.
    timeout: 300_000,
    use: {
      ...devices["Desktop Chrome"],
      // A trace would record the fixture password in the sign-in POST
      // bodies. `--trace on` still overrides this for a local debug run.
      trace: "off",
      video: "off",
      screenshot: "off",
    },
  })
}

const smokeEnabled =
  process.env.QA_SMOKE === "1" || argv.includes("--project=smoke")
const smokePort = Number(process.env.QA_SMOKE_PORT ?? "3101")
if (!Number.isInteger(smokePort) || smokePort < 1024 || smokePort > 65535)
  throw new Error("QA_SMOKE_PORT must be an unprivileged local port")
const smokeOrigin = `http://localhost:${smokePort}`
if (smokeEnabled)
  projects.push({
    name: "smoke",
    testMatch: ["smoke/**/*.spec.ts"],
    use: {
      ...devices["Desktop Chrome"],
      baseURL: smokeOrigin,
      trace: "off",
    },
  })
if (process.env.QA_ADMIN_PROJECT === "1" || argv.includes("--project=admin")) {
  const admin = new URL(process.env.QA_STRAPI_URL ?? "http://127.0.0.1:1337")
  if (!["localhost", "127.0.0.1", "[::1]"].includes(admin.hostname))
    throw new Error("Admin QA is restricted to a local fixture CMS")
  projects.push({
    name: "admin",
    testMatch: ["admin/**/*.spec.ts"],
    workers: 1,
    fullyParallel: false,
    retries: 0,
    use: {
      ...devices["Desktop Chrome"],
      baseURL: admin.origin,
      trace: "off",
      video: "off",
      screenshot: "off",
    },
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
  updateSnapshots: "none",
  ...(smokeEnabled
    ? {
        webServer: {
          command: `pnpm --filter @repo/ui start --hostname localhost --port ${smokePort}`,
          url: `${smokeOrigin}/events`,
          timeout: 120000,
          reuseExistingServer: !process.env.CI,
          env: {
            BETA_GATE_ENABLED: "false",
            APP_PUBLIC_URL: smokeOrigin,
            STRAPI_URL: "http://127.0.0.1:65534",
          },
        },
      }
    : {}),
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
