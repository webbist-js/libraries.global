"use client"

import { createContext, useContext, type ReactNode } from "react"

import type { FooterNavigation } from "./footer-navigation"

const Context = createContext<FooterNavigation>({ sections: [], links: [] })

/** Reuse root-layout CMS reads; navigation changes do not fetch another footer. */
export function FooterNavigationProvider({
  navigation,
  children,
}: {
  readonly navigation: FooterNavigation
  readonly children: ReactNode
}) {
  return <Context.Provider value={navigation}>{children}</Context.Provider>
}

export const useFooterNavigation = () => useContext(Context)
