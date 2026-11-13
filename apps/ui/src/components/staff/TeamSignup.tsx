"use client"

import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"
import { useId, useRef, useState, useTransition } from "react"

import { useMembershipRefresh } from "@/components/billing/useMembershipRefresh"
import { Badge } from "@/components/ds/Badge"
import {
  TeamNetworkChoice,
  type TeamNetworkSelection,
} from "@/components/networks/TeamNetworkChoice"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Link, useRouter } from "@/lib/navigation"

import { StaffPanel, STAFF_LINK } from "./StaffPanel"

/**
 * Free organisation setup. Creating a Team buys nothing and grants no library
 * authority: chosen libraries remain claims until verified access is
 * reviewed. API access is bought separately at /developers.
 * The staff-workspace owner may restyle this step.
 */
export function TeamSignup({
  verified,
  initialNetwork,
  user,
}: {
  readonly verified: boolean
  readonly initialNetwork?: string
  readonly user: { name: string; email: string }
}) {
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const requestId = useRef(crypto.randomUUID())
  const nameId = useId()
  const [network, setNetwork] = useState<TeamNetworkSelection>(null)
  const [networkChosen, setNetworkChosen] = useState(false)
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const refresh = useMembershipRefresh()
  const router = useRouter()

  const create = () =>
    startTransition(async () => {
      setError("")
      try {
        const response = await fetch("/api/billing/teams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            ...(network
              ? {
                  primaryNetworkId: network.network.documentId,
                  libraryDocumentIds: network.libraryDocumentIds,
                }
              : {}),
            requestId: requestId.current,
          }),
        })
        const result = (await response.json()) as { error?: string }
        if (!response.ok)
          throw new Error(
            result.error === "organisation_exists"
              ? "Your account already belongs to a Team. Open your Team to manage members."
              : "The Team could not be created. Retry with the same name."
          )
        await refresh()
        router.push("/staff/teams")
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : tExisting("apiIndividualCheckout.retry")
        )
      }
    })

  if (!verified)
    return (
      <StaffPanel title={tStatic("staff.verify_your_email")} compact>
        <p className="text-base leading-relaxed text-(--t-ink-dim)">
          {tStatic("staff.verify_your_email_before_creating_a_team")}
        </p>
        <Link className={STAFF_LINK} href="/profile/settings">
          {tExisting("apiIndividualCheckout.openSettings")}
        </Link>
      </StaffPanel>
    )

  if (!networkChosen)
    return (
      <TeamNetworkChoice
        initialNetwork={initialNetwork}
        onChoose={(choice) => {
          setNetwork(choice)
          setName((current) => current || choice?.network.name || "")
          setNetworkChosen(true)
        }}
      />
    )

  return (
    <div className="mx-auto max-w-3xl">
      <StaffPanel title={tStatic("staff.your_team_together")} compact>
        <p className="mb-5 text-xs font-semibold tracking-wide text-(--t-accent-primary) uppercase">
          {tStatic("staff.step_2_of_2_name_your_team")}
        </p>
        <SignupCoverage network={network} />
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!pending && name.trim()) create()
          }}
        >
          <div>
            <label
              htmlFor={nameId}
              className="mb-2 block text-base font-semibold"
            >
              {tStatic("staff.team_name")}
            </label>
            <Input
              id={nameId}
              value={name}
              maxLength={120}
              required
              autoComplete="organization"
              placeholder="Bristol Libraries"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <p className="m-0 text-base leading-relaxed text-(--t-ink-dim)">
            Creating a Team is free. You’ll manage it as {user.email}. Editing
            library records requires verified staff access for each library.
          </p>
          {error ? (
            <p
              role="alert"
              className="m-0 rounded-2xl border border-(--t-accent-danger)/30 bg-(--t-bg-surface) p-4 text-base text-(--t-accent-danger)"
            >
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-4">
            <Button
              type="submit"
              variant="primary"
              size="pill"
              disabled={pending || !name.trim()}
              aria-busy={pending}
            >
              {pending
                ? "Creating…"
                : tExisting("staticUi.staffRoute.create_your_team")}
            </Button>
            <Button
              type="button"
              variant="link"
              className="px-0"
              disabled={pending}
              onClick={() => setNetworkChosen(false)}
            >
              {tStatic("staff.change_library_selection")}
            </Button>
          </div>
        </form>
      </StaffPanel>
    </div>
  )
}

function SignupCoverage({
  network,
}: {
  readonly network: TeamNetworkSelection
}) {
  const tStatic = useTranslations("staticUi")

  return (
    <div className="mb-5 flex items-center gap-3 rounded-2xl bg-(--t-bg-surface) p-4">
      <Icon
        aria-hidden
        icon="mdi:domain"
        width={24}
        className="text-(--t-accent-primary)"
      />
      <div className="min-w-0 flex-1">
        <strong className="block text-sm">
          {network?.network.name ?? "Choose libraries individually"}
        </strong>
        <p className="mt-1 text-xs text-(--t-ink-dim)">
          {network
            ? `${network.libraryDocumentIds.length} published libraries selected`
            : "Add your libraries in the staff workspace after setup."}
        </p>
      </div>
      <Badge color="aurora" label={tStatic("staff.starting_coverage")} />
    </div>
  )
}
