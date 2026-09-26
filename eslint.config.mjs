import baseConfig from "@repo/eslint-config"

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  {
    // Standalone CLI/data scripts — relax rules that only make sense for library code
    // Both forms: `-c ../../eslint.config.mjs` from apps/strapi resolves
    // patterns against the cwd, so the repo-relative path alone never matched.
    files: [
      "scripts/**/*.{ts,mjs,js}",
      "apps/strapi/scripts/**/*.{ts,mjs,js}",
    ],
    rules: {
      "no-console": "off",
      "unicorn/no-process-exit": "off",
      "unicorn/prefer-top-level-await": "off",
      "sonarjs/cognitive-complexity": "off",
      "turbo/no-undeclared-env-vars": "off",
    },
  },
]
