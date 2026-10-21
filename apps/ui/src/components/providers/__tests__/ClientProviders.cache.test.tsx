// @vitest-environment happy-dom
import { useQuery } from "@tanstack/react-query"
import { afterEach, expect, it, vi } from "vitest"

import { cleanup, render, screen } from "@/test/render"

const session = vi.hoisted(() => ({ id: "account-a" }))
vi.mock("@/lib/access-client", () => ({
  useHydratedSession: () => ({ data: { user: { id: session.id } } }),
}))
vi.mock("@/components/global/NavigationProgress", () => ({
  NavigationProgress: () => null,
}))
vi.mock("@/hooks/useTranslatedZod", () => ({ useTranslatedZod: () => {} }))
vi.mock("@/lib/general-helpers", () => ({ setupLibraries: () => {} }))
vi.mock("@/components/notifications/NotificationProvider", () => ({
  NotificationProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}))
import { ClientProviders } from "../ClientProviders"

function PrivateData() {
  const query = useQuery({
    queryKey: ["personal-data"],
    queryFn: async () => session.id,
    staleTime: 60000,
  })

  return <p>{query.data ?? "Loading private data"}</p>
}
afterEach(cleanup)
it("discards an account's private cache synchronously when switching accounts without a reload", async () => {
  session.id = "account-a"
  const view = render(
    <ClientProviders>
      <PrivateData />
    </ClientProviders>
  )
  await screen.findByText("account-a")
  session.id = "account-b"
  view.rerender(
    <ClientProviders>
      <PrivateData />
    </ClientProviders>
  )
  expect(screen.queryByText("account-a")).toBeNull()
  await screen.findByText("account-b")
})
