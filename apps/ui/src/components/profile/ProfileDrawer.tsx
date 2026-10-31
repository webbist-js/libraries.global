"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useId, useRef, useState } from "react"

import { Drawer } from "@/components/ds/Drawer"
import { useHydratedSession } from "@/lib/access-client"
import { useEditorialDrawer } from "@/lib/editorial/drawer"
import { usePathname } from "@/lib/navigation"
import {
  closeProfileDrawer,
  finishProfileHandoff,
  handoffProfileDrawer,
  setProfileNavigationGuard,
  useProfileDrawer,
} from "@/lib/profile-drawer"
import { useStaffDrawer } from "@/lib/staff/drawer"

import type { Workspace } from "./profile-workspace.types"
import { ProfileWorkspace, ProfileWorkspaceActions } from "./ProfileWorkspace"
import { ProfileWorkspaceHeader } from "./ProfileWorkspaceHeader"

export default function ProfileDrawer() {
  const drawer = useProfileDrawer()
  const { data: session, isPending, error: sessionError } = useHydratedSession()
  const user = session?.user
  const actor = user?.id ?? null
  const t = useTranslations("dashboard")
  const ui = useTranslations("ui")
  const locale = useLocale()
  const path = usePathname()
  const previousPath = useRef(path)
  const staff = useStaffDrawer(),
    editorial = useEditorialDrawer()
  const [dirty, setDirty] = useState(false)
  const [saveActionsTarget, setSaveActionsTarget] =
    useState<HTMLDivElement | null>(null)
  const unsaved = dirty && drawer.section === "settings"
  const id = useId()
  const client = useQueryClient()
  const open =
    drawer.open &&
    actor === drawer.actor &&
    !isPending &&
    !sessionError &&
    !staff.open &&
    !editorial
  // Keep the same actor's contents through the exit, but remove them
  // immediately when the session changes or becomes uncertain.
  const [visible, setVisible] = useState(open ? drawer : null)
  if (open && visible !== drawer) setVisible(drawer)
  const showing = Boolean(
    visible && visible.actor === actor && !isPending && !sessionError
  )
  const query = useQuery<Workspace>({
    queryKey: ["profile-workspace", actor, locale],
    enabled: open,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `/api/profile/workspace?locale=${encodeURIComponent(locale)}`,
        { signal, cache: "no-store" }
      )
      if (!response.ok) throw new Error(t("profileUnavailable"))
      const data = (await response.json()) as Workspace
      if (data.actorId !== actor) throw new Error(t("profileUnavailable"))

      return data
    },
  })
  useEffect(() => {
    if (
      drawer.open &&
      (drawer.actor !== actor ||
        sessionError ||
        previousPath.current !== path ||
        staff.open ||
        editorial)
    )
      closeProfileDrawer(true)
    previousPath.current = path
  }, [
    actor,
    drawer.actor,
    drawer.open,
    editorial,
    path,
    sessionError,
    staff.open,
  ])
  useEffect(() => {
    if (!open) return

    return setProfileNavigationGuard(
      () => !unsaved || window.confirm(t("discardProfileChanges"))
    )
  }, [unsaved, open, t])
  useEffect(() => {
    if (!unsaved || !open) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)

    return () => window.removeEventListener("beforeunload", warn)
  }, [unsaved, open])
  useEffect(() => {
    if (!open || !drawer.anchor || !query.data) return
    document.getElementById(drawer.anchor)?.scrollIntoView({ block: "start" })
  }, [drawer.anchor, drawer.section, open, query.data])
  const refresh = () => {
    client.invalidateQueries({
      queryKey: ["profile-workspace", actor, locale],
    })
  }

  return (
    <Drawer
      open={open}
      onClose={() => {
        closeProfileDrawer()
      }}
      returnFocusTo={drawer.trigger}
      onAfterClose={() => {
        setVisible(null)
        if (document.activeElement === document.body)
          document
            .querySelector<HTMLElement>(".profile-trigger")
            ?.focus({ preventScroll: true })
        finishProfileHandoff()
      }}
      titleId={id}
      title={ui("your_profile")}
      headerContent={
        showing && user ? (
          <ProfileWorkspaceHeader
            user={user}
            profile={query.data?.profile}
            avatarUrl={query.data?.avatarUrl}
          />
        ) : null
      }
      footer={
        showing && user ? (
          <ProfileWorkspaceActions
            user={user}
            onHandoff={handoffProfileDrawer}
            saveActionsRef={
              visible?.section === "settings" ? setSaveActionsTarget : undefined
            }
          />
        ) : null
      }
      side="left"
      className="profile-workspace-drawer"
    >
      {showing && user && visible ? (
        <ProfileWorkspace
          key={actor}
          user={user}
          section={visible.section}
          query={query}
          onDirtyChange={setDirty}
          onRefresh={refresh}
          onHandoff={handoffProfileDrawer}
          saveActionsTarget={saveActionsTarget}
        />
      ) : null}
    </Drawer>
  )
}
