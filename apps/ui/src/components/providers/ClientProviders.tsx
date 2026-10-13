"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import type React from "react"
import { z } from "zod"

import { NavigationProgress } from "@/components/global/NavigationProgress"
import { NotificationProvider } from "@/components/notifications/NotificationProvider"
import { useTranslatedZod } from "@/hooks/useTranslatedZod"
import { setupLibraries } from "@/lib/general-helpers"

// Setup libraries in client environment
setupLibraries()

const queryClient = new QueryClient()

export function ClientProviders({
  children,
  nonce,
}: {
  readonly children: React.ReactNode
  /**
   * The request's CSP nonce (`x-nonce`): next-themes injects an inline
   * bootstrap script, and without the nonce `script-src` blocks it.
   */
  readonly nonce?: string
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
        <QueryClientProvider client={queryClient}>
          <NotificationProvider>{children}</NotificationProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </>
  )
}
