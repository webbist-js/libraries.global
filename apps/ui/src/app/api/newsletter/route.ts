import { collectSubscription } from "@/lib/subscriptions"

export async function POST(req: Request) {
  return collectSubscription(req, "newsletter")
}
