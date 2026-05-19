import baseConfig from "@repo/eslint-config"

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  {
    // Standalone CLI/data scripts — relax rules that only make sense for library code
    files: ["scripts/**/*.ts"],
    rules: {
      "no-console": "off",
      "unicorn/no-process-exit": "off",
      "unicorn/prefer-top-level-await": "off",
      "sonarjs/cognitive-complexity": "off",
      "turbo/no-undeclared-env-vars": "off",
    },
  },
]
