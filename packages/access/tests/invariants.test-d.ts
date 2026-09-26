// Type-level invariants from spec §3.1. Checked by `tsc -p tsconfig.typecheck.json`,
// which `pnpm test` (and so CI) runs before vitest. Adding any field to
// CapabilityInput, a trust field to EntitlementInput, or letting a capability
// function take Entitlements, makes this file fail to compile.
import {
  canSubmit,
  resolveCapabilities,
  resolveEntitlements,
  type CapabilityInput,
  type EntitlementInput,
} from "../src"

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false
const assertTrue = <T extends true>() => undefined as unknown as T

// Invariant 1: CapabilityInput has exactly these keys. An allowlist, so any new
// field (plan-like or not) has to be added here on purpose.
assertTrue<
  Equals<keyof CapabilityInput, "signedIn" | "contributorRole" | "claims">
>()

// ...and the reverse: EntitlementInput carries no role, claim or capability
// fields, so trust never feeds the plan either.
type TrustKeys = Extract<
  keyof EntitlementInput,
  "contributorRole" | "claims" | "capabilities" | "isVerifiedLibrarian" | "role"
>
assertTrue<Equals<TrustKeys, never>>()

// Invariant 2: no capability function accepts an Entitlements value.
const ent = resolveEntitlements({ signedIn: true, now: new Date(0) })
// @ts-expect-error Entitlements is not a CapabilityInput
resolveCapabilities(ent)
// @ts-expect-error Entitlements is not Capabilities
canSubmit(ent, "correction")
