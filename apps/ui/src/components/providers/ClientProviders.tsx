"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import type React from "react"
import { z } from "zod"

import { NavigationProgress } from "@/components/global/NavigationProgress"
import { useTranslatedZod } from "@/hooks/useTranslatedZod"
import { setupLibraries } from "@/lib/general-helpers"

// Setup libraries in client environment
setupLibraries()

const queryClient = new QueryClient()

export function ClientProviders({
  children,
}: {
  readonly children: React.ReactNode
}) {
  useTranslatedZod(z)

  return (
    <>
      <NavigationProgress />
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </ThemeProvider>
    </>
  )
}
