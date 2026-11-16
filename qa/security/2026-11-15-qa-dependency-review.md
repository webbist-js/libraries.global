# QA dependency remediation — 15 November 2026

The three remaining high-severity alerts came from the performance-testing toolchain:

- `@lhci/cli` 0.15.1 → Lighthouse 12.6.1 → Puppeteer Core 24.43.1 →
  `@puppeteer/browsers` 2.13.2 → `extract-zip` 2.0.1: two archive-path advisories.
- The same Puppeteer version → Chromium BiDi 14.0.0 → Zod 3.25.76:
  oversized-collection memory exhaustion.

Upgrade the direct QA dependency to upstream Lighthouse CI 0.16.1. It supplies
Lighthouse 13.6.0 and Puppeteer Core 25.17.0. The resulting browser installer no
longer depends on `extract-zip`; Chromium BiDi uses the already-patched Zod 4.6.7.
Neither vulnerable package version remains anywhere in the lockfile.

Align the QA Playwright runner with Playwright 1.64.1, already resolved for the
accessibility adapter, to keep their `Page` types compatible. Application workspace
importers are unchanged. Node 22.23.4 satisfies the new toolchain's requirements.

CI now audits all workspace dependencies at the high/critical threshold, including
development tools, in addition to the existing production dependency guard. The QA
workspace typecheck also runs in CI after shared libraries are built. No
advisory is ignored or dismissed, and the exception baseline is unchanged.

Validation includes a full dependency audit, QA typecheck, actual Lighthouse
collection against a disposable loopback fixture, and JSON/HTML report readback.
The browser and fixture server are closed after the smoke check. Lower-severity
findings remain visible in the audit; this is not a claim that all findings are gone.
