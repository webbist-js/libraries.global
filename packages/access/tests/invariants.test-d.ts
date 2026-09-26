// Type-level invariants from spec §3.1. Checked by `pnpm --filter @repo/access typecheck`.
// Adding a plan field to CapabilityInput, or letting a capability function take
// Entitlements, makes this file fail to compile.
import {
  canSubmit,
  resolveCapabilities,
  resolveEntitlements,
  type CapabilityInput,
} from "../src"

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false
const assertTrue = <T extends true>() => undefined as unknown as T

// Invariant 1: CapabilityInput has no plan-related keys.
type PlanishKeys = Extract<
  keyof CapabilityInput,
  | "plan"
  | "planSource"
  | "subscription"
  | "entitlements"
  | "features"
  | "grants"
  | "verifications"
  | "tier"
  | "rewardsTier"
>
assertTrue<Equals<PlanishKeys, never>>()

// Invariant 2: no capability function accepts an Entitlements value.
const ent = resolveEntitlements({ signedIn: true, now: new Date(0) })
// @ts-expect-error Entitlements is not a CapabilityInput
resolveCapabilities(ent)
// @ts-expect-error Entitlements is not Capabilities
canSubmit(ent, "correction")
