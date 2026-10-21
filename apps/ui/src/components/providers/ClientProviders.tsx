"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import type React from "react"
import { useEffect, useState } from "react"
import { z } from "zod"

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
      <NavigationProgress />
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        forcedTheme="light"
        enableSystem={false}
        nonce={nonce}
      >
        <SessionQueries>
          {liveConsole ? (
            children
          ) : (
            <NotificationProvider>{children}</NotificationProvider>
          )}
        </SessionQueries>
      </ThemeProvider>
    </>
  )
}
