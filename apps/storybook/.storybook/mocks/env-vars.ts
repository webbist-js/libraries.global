// No application env is loaded by Storybook. Fail loudly when a new seam is needed.
const fixtures = {
  APP_PUBLIC_URL: "https://example.invalid",
  MOBILE_APP_URL: "https://mobile.example.invalid",
  STRAPI_URL: "https://cms.example.invalid",
} as const

export function getEnvVar(name: string, required = false): string | undefined {
  const value = fixtures[name as keyof typeof fixtures]
  if (!value && required)
    throw new Error(`Storybook has no environment fixture for ${name}`)

  return value
}
