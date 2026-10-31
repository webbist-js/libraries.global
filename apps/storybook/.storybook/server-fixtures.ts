const requests = new Map<string, Promise<unknown>>()

export function resetServerFixtures() {
  requests.clear()
}
/** Stable promises also support production components that read with React.use(). */
export function readServerFixture(
  name: string,
  args: unknown[] = []
): Promise<unknown> {
  const key = `${name}:${JSON.stringify(args)}`
  let pending = requests.get(key)
  if (!pending) {
    pending = fetch(`/__storybook/server/${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    }).then(async (response) => {
      if (!response.ok)
        throw new Error(
          `Storybook server fixture ${name} returned ${response.status}`
        )

      return response.json()
    })
    requests.set(key, pending)
  }

  return pending
}
