"use client"

import { Icon } from "@iconify/react"
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
          failure instanceof Error ? failure.message : "Please try again."
        )
      }
    })

  if (!verified)
    return (
      <StaffPanel title="Verify your email" compact>
        <p className="text-base leading-relaxed text-(--t-ink-dim)">
          Verify your email before creating a Team.
        </p>
        <Link className={STAFF_LINK} href="/profile/settings">
          Open account settings
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
      <StaffPanel title="Your Team, together" compact>
        <p className="mb-5 text-xs font-semibold tracking-wide text-(--t-accent-primary) uppercase">
          Step 2 of 2 · Name your Team
        </p>
        <SignupCoverage network={network} />
        <form
          className="space-y-4"
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
              Team name
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
            Teams are free. You become its Organiser as {user.email}. Library
            editing still needs verified access for each library.
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
              {pending ? "Creating…" : "Create your Team"}
            </Button>
            <Button
              type="button"
              variant="link"
              className="px-0"
              disabled={pending}
              onClick={() => setNetworkChosen(false)}
            >
              Change library selection
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
      <Badge color="aurora" label="Starting coverage" />
    </div>
  )
}
