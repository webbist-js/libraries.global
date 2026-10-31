"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"
import { Suspense, useEffect, useState } from "react"
import { z } from "zod"

import { AccountAppearanceSync } from "@/components/appearance/AccountAppearanceSync"
import { AppearanceProvider } from "@/components/appearance/AppearanceProvider"
import { NavigationProgress } from "@/components/global/NavigationProgress"
import { NotificationProvider } from "@/components/notifications/NotificationProvider"
import { useTranslatedZod } from "@/hooks/useTranslatedZod"
import { useHydratedSession } from "@/lib/access-client"
import { setupLibraries } from "@/lib/general-helpers"

// Setup libraries in client environment
setupLibraries()

function ScopedQueries({ children }: { children: React.ReactNode }) {
  // One client is owned by this provider’s mounted lifetime.
  // eslint-disable-next-line react/hook-use-state
  const [queryClient] = useState(() => new QueryClient())
  useEffect(
    () => () => {
      queryClient.cancelQueries()
      queryClient.clear()
    },
    [queryClient]
  )

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function SessionQueries({ children }: { children: React.ReactNode }) {
  const { data } = useHydratedSession()

  // Replacing the provider discards private data synchronously on account change.
  return (
    <ScopedQueries key={data?.user?.id ?? "anonymous"}>
      {children}
    </ScopedQueries>
  )
}

export function ClientProviders({
  children,
  nonce,
  liveConsole = false,
}: {
  readonly children: React.ReactNode
  /**
   * The request's CSP nonce (`x-nonce`): next-themes injects an inline
   * bootstrap script, and without the nonce `script-src` blocks it.
   */
  readonly nonce?: string
  readonly liveConsole?: boolean
}) {
  useTranslatedZod(z)

  return (
    <>
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <AppearanceProvider nonce={nonce}>
        <AccountAppearanceSync />
        <SessionQueries>
          {liveConsole ? (
            children
          ) : (
            <NotificationProvider>{children}</NotificationProvider>
          )}
        </SessionQueries>
      </AppearanceProvider>
    </>
  )
}
