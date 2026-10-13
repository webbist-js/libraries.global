# Release helpers

The manual image workflow publishes the current protected `dev` commit after CI and CodeQL pass. Image publication and production promotion are separate operations.

`DO_IMAGE_PUBLISH_ENABLED=true` is a repository Actions variable. The `production-images` environment holds three secrets: `DO_CONTAINER_REGISTRY` (registry prefix), `DO_REGISTRY_USERNAME` and `DO_REGISTRY_TOKEN`. Use a short-lived registry writer. Keep environment review enabled and restrict its branch policy to `dev`.

`registry-auth.mjs` runs only inside GitHub Actions. It passes the token through Docker password stdin, masks derived login values and creates a private configuration directory outside the checkout. The workflow removes that directory even after failure. Login diagnostics are suppressed because they can include credential data.

`image-manifest.mjs` writes a schema-2 artifact with the repository, full source commit and three relative references: `ui@sha256:...`, `strapi@sha256:...` and `worker@sha256:...`. The public artifact omits the private registry prefix. Operators use `resolvePrivateReferences(manifest, registry)` to validate the artifact and reconstruct full references for their private release record. Preserve accepted manifests beyond the Actions artifact retention window.

Run the helper checks with:

```sh
pnpm exec eslint scripts/release/*.mjs
node --test scripts/release/*.test.mjs
```

`check-public-files.mjs` verifies that private operational paths and credentials are absent from the Git index. Host inventories, runtime secrets, recovery records and promotion commands belong in private operator documentation.
