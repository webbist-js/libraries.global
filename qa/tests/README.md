# Testing Info

## 🐞 Automated Testing Suite

This directory contains an automated testing suite designed to ensure quality across functionality, accessibility, performance, and SEO.

It can include different testing frameworks and tools depending on project needs, for example:

- **End-to-End (E2E) Tests** with tools like [Playwright](https://playwright.dev/) or [Cypress](https://www.cypress.io/)
- **Accessibility Tests** using [AXE-Core](https://classic.yarnpkg.com/en/package/@axe-core/playwright)
- **SEO Tests** for automated validation of search engine optimizations
- **Visual Tests** for automated visual validation
- **Performance Tests** using [LighthouseCI](https://github.com/GoogleChrome/lighthouse-ci/tree/main)

---

## 📂 Project Structure

```bash
qa/
├── tests/
│   └── playwright/                       ← Playwright-based tests (workspace package)
│       ├── e2e/                          ← End-to-End tests
│       ├── axe/                          ← Accessibility tests
│       ├── seo/                          ← SEO tests
│       ├── visual/                       ← Visual tests
│       ├── perfo/                        ← Performance tests using LighthouseCI
│       ├── helpers/                      ← Shared test utilities/helpers
│       ├── .env.example                  ← Example environment variables file
│       ├── package.json                  ← Test dependencies & scripts for this package
│       ├── playwright.config.ts          ← Playwright configuration
│       ├── tsconfig.json                 ← TypeScript configuration for this package
```

### Playwright

#### 🔧 Environment Variables

Playwright tests require a `.env` file.

1. Copy the example file:
   ```bash
   cp qa/tests/playwright/.env.example qa/tests/playwright/.env
   ```
2. Update the `BASE_URL` value to point to the environment you want to test.
   ```bash
    BASE_URL=http://localhost:3000
   ```
   `BASE_URL` defines the base URL of the application under test and is used as the starting point for all Playwright test suites.

#### 🌎 Install Playwright Browsers

Before running tests for the first time, install the required browsers:

```bash
# From project root
pnpm -F @repo/tests-playwright exec playwright install --with-deps

# Or from the playwright directory
cd qa/tests/playwright && pnpm exec playwright install --with-deps
```

#### �📱 Mobile Viewport Testing

Mobile browser projects can be enabled via an environment variable.

```env
MOBILE_VIEWPORTS_TESTING_ENABLED=true
```

#### ▶️ Running Tests

All test commands are run from the **project root**, not from inside the `qa/` folder.

- **Playwright - Run E2E tests (headless)**

  ```bash
  pnpm run tests:playwright:e2e:test
  ```

- **Playwright - Run E2E tests in interactive mode (headed)**

  ```bash
  pnpm run tests:playwright:e2e:test:interactive
  ```

- **Playwright - Run AXE tests**

  ```bash
  pnpm run tests:playwright:axe
  ```

- **Playwright - Run SEO tests**

  ```bash
  pnpm run tests:playwright:seo
  ```

- **Playwright - Run Visual tests**

  ```bash
  pnpm tests:playwright:visual
  ```

- **LighthouseCI - Run Perfo tests**
  ```bash
  pnpm tests:lhci:perfo
  ```

#### Additional info for visual tests

**Playwright – Running visual regression tests**

1. **Initial run (baseline creation)**  
   Run the visual tests for the first time.  
   This initial run will generate the **baseline (golden) screenshots**, which serve as the reference for future comparisons.

2. **Deploy the application**  
   Deploy the application version you want to validate visually.

3. **Comparison run**  
   Run the visual tests again.  
   Playwright will generate new screenshots and **compare them against the previously created baseline** to detect visual changes or regressions.

# Analytics acceptance on the released beta

After the reviewed code is deployed and the accepted GTM container is published:

```sh
ANALYTICS_ACCEPTANCE=1 BASE_URL=https://libraries.global pnpm -F @repo/tests-playwright exec playwright test e2e/analytics.spec.ts --project=chromium --workers=1
```

This opt-in suite uses fresh anonymous beta visits, verifies the real tag output, and intercepts collection requests so automated test visits are not recorded in GA. It checks rejection persistence, one sanitized consented page view, cookie lifetime, withdrawal, cookie cleanup and locale navigation. It does not open accounts, redeem invitations or submit email forms. Repeat on Firefox/WebKit and complete the private-route, sampled-action and GA DebugView checks with the operator's owned beta session. See [analytics acceptance](../../apps/ui/ANALYTICS.md).
