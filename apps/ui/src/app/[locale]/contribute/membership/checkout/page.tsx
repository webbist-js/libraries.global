import { headers } from "next/headers"

import { CheckoutFlow } from "@/components/billing/CheckoutFlow"
import { getSessionSSR } from "@/lib/auth-server"

export const metadata = {
  title: "Membership checkout",
  robots: { index: false, follow: false },
}
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{
    plan?: string
    interval?: string
    attempt?: string
    cancelled?: string
  }>
}) {
  const [params, session] = await Promise.all([
    searchParams,
    getSessionSSR(await headers()),
  ])
  const user = session?.user
  const attempt =
    params.attempt && /^[\da-f-]{36}$/i.test(params.attempt)
      ? params.attempt
      : undefined

  return (
    <main className="mx-auto my-6 max-w-6xl overflow-hidden rounded-3xl border bg-white sm:my-10">
      <CheckoutFlow
        user={
          user
            ? {
                email: user.email,
                verified: user.emailVerified,
                complimentaryPro:
                  ["pro", "team"].includes(user.plan ?? "") &&
                  user.planSource !== "paid",
              }
            : null
        }
        initialPlan={params.plan === "supporter" ? "supporter" : "pro"}
        initialInterval={params.interval === "year" ? "year" : "month"}
        attempt={attempt}
        cancelled={params.cancelled === "1"}
      />
    </main>
  )
}
