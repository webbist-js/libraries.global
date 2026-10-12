import { billingConfig } from "@/lib/billing/config"
import { billingFailure, billingJson } from "@/lib/billing/http"
import { billingStripe } from "@/lib/billing/provider"

export const runtime = "nodejs"
export async function GET() {
  const config = billingConfig()
  if (!config.enabled)
    return billingJson({
      available: false,
      sandbox: config.mode === "sandbox",
      prices: [],
    })
  try {
    const stripe = billingStripe()
    const selections = (["pro", "supporter"] as const)
      .flatMap((plan) =>
        plan === "supporter" && !config.supporterApproved
          ? []
          : (["month", "year"] as const).map((interval) => ({
              plan,
              interval,
              id: config.prices[plan][interval],
            }))
      )
      .filter((selection) => selection.id)
    const prices = await Promise.all(
      selections.map(async ({ plan, interval, id }) => {
        const price = await stripe.prices.retrieve(id!)
        if (
          !price.active ||
          price.livemode !== (config.mode === "live") ||
          price.recurring?.interval !== interval ||
          price.recurring.interval_count !== 1 ||
          price.currency !== "gbp" ||
          price.unit_amount === null
        )
          throw new Error("catalogue mismatch")

        return {
          plan,
          interval,
          unitAmount: price.unit_amount,
          currency: price.currency,
        }
      })
    )

    return billingJson({
      available: true,
      sandbox: config.mode === "sandbox",
      prices,
    })
  } catch (error) {
    return billingFailure(error)
  }
}
