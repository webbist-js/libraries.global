"use client"

import { useLocale } from "next-intl"
import { useRef, useState, useTransition } from "react"

import { useMembershipRefresh } from "@/components/billing/useMembershipRefresh"
import {
  TeamNetworkChoice,
  type TeamNetworkSelection,
} from "@/components/networks/TeamNetworkChoice"
import { Button } from "@/components/ui/button"
import { Link, useRouter } from "@/lib/navigation"
import { TEAM_TERMS_VERSION } from "@/lib/team-billing/types"

import { StaffPanel, STAFF_LINK } from "./StaffPanel"
import {
  TeamCheckoutDialog,
  type TeamCheckoutChoice,
} from "./TeamCheckoutDialog"

export function TeamSignup({
  available,
  verified,
  initialSeats,
  sandbox,
  user,
  initialNetwork,
}: {
  readonly available: boolean
  readonly verified: boolean
  readonly initialSeats: number
  readonly sandbox: boolean
  readonly initialNetwork?: string
  readonly user: { name: string; email: string }
}) {
  const requestId = useRef(crypto.randomUUID())
  const [team, setTeam] = useState<{ id: string; name: string } | null>(null)
  const [network, setNetwork] = useState<TeamNetworkSelection>(null)
  const [networkChosen, setNetworkChosen] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const refresh = useMembershipRefresh()
  const router = useRouter()
  const locale = useLocale()
  const create = (choice: TeamCheckoutChoice): Promise<boolean> =>
    new Promise((resolve) => {
      if (team) {
        resolve(true)

        return
      }
      startTransition(async () => {
        setError("")
        try {
          const response = await fetch("/api/billing/teams", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: choice.name,
              ...(network
                ? {
                    primaryNetworkId: network.network.documentId,
                    libraryDocumentIds: network.libraryDocumentIds,
                  }
                : {}),
              requestId: requestId.current,
              publicServiceRequested: choice.publicServiceRequested,
            }),
          })
          const result = await response.json()
          if (!response.ok)
            throw new Error(
              result.error === "team_membership_exists"
                ? "Your account already belongs to a Team. Open your Team to manage members or add seats."
                : "The Team could not be created. Retry with the same name."
            )
          setTeam({ id: result.teamId, name: choice.name })
          await refresh()
          resolve(true)
        } catch (failure) {
          setError(
            failure instanceof Error ? failure.message : "Please try again."
          )
          resolve(false)
        }
      })
    })
  const checkout = (choice: TeamCheckoutChoice) =>
    startTransition(async () => {
      if (!team) return
      setError("")
      try {
        const response = await fetch(`/api/staff/team/${team.id}/billing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "checkout",
            seats: choice.seats,
            locale,
            termsVersion: TEAM_TERMS_VERSION,
          }),
        })
        const result = await response.json()
        if (!response.ok || !result.url)
          throw new Error(
            result.error === "team_payment_confirmation_pending"
              ? "An earlier payment is being confirmed. Open your Team billing to check its status."
              : "Checkout could not be opened. Your Team is saved; retry or continue from Team billing."
          )
        window.location.assign(result.url)
      } catch (failure) {
        setError(
          failure instanceof Error ? failure.message : "Please try again."
        )
      }
    })
  if (!verified || !available)
    return (
      <StaffPanel
        title={
          !verified ? "Verify your email" : "Team subscriptions are unavailable"
        }
        compact
      >
        <p className="text-[15px] leading-relaxed text-(--t-ink-dim)">
          {!verified
            ? "Verify your email before creating a Team."
            : "New Team subscriptions are temporarily unavailable. Please check back later."}
        </p>
        <Link
          className={STAFF_LINK}
          href={!verified ? "/profile/settings" : "/contribute/membership"}
        >
          {!verified ? "Open account settings" : "View membership options"}
        </Link>
      </StaffPanel>
    )

  if (!networkChosen)
    return (
      <TeamNetworkChoice
        initialNetwork={initialNetwork}
        onChoose={(choice) => {
          setNetwork(choice)
          setNetworkChosen(true)
          setOpen(true)
        }}
      />
    )

  return (
    <>
      <StaffPanel title={team ? team.name : "Your Team, together"} compact>
        <p className="text-[15px] leading-relaxed text-(--t-ink-dim)">
          {team
            ? "Your Team is saved. Complete annual billing when you’re ready to activate membership."
            : "Start with five seats, invite colleagues and manage annual billing online."}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="primary" size="pill" onClick={() => setOpen(true)}>
            {team ? "Continue to payment" : "Create your Team"}
          </Button>
          <ServiceManagementLink team={team} network={network} />
          {team ? (
            <Link className={STAFF_LINK} href="/staff/teams/billing">
              Open Team billing
            </Link>
          ) : (
            <Link className={STAFF_LINK} href="/staff">
              Your staff workspace
            </Link>
          )}
        </div>
      </StaffPanel>
      <TeamCheckoutDialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value)
          if (!value && team) router.push(`/staff/teams/billing`)
        }}
        initialSeats={initialSeats}
        teamName={team?.name}
        initialName={network?.network.name}
        sandbox={sandbox}
        user={user}
        busy={pending}
        error={error}
        onTeam={create}
        onCheckout={checkout}
      />
    </>
  )
}

function ServiceManagementLink({
  team,
  network,
}: {
  readonly team: { id: string; name: string } | null
  readonly network: TeamNetworkSelection
}) {
  if (!team || !network) return null

  return (
    <Link
      className={STAFF_LINK}
      href={`/staff/networks?network=${network.network.documentId}`}
    >
      Request service management
    </Link>
  )
}
