"use client"

import { createContext, useContext, type ComponentPropsWithoutRef } from "react"

const MainContext = createContext(false)

/** Section layouts and reusable page templates share one semantic skip target. */
export function MainContent({
  children,
  id: _id,
  tabIndex,
  ...props
}: ComponentPropsWithoutRef<"main">) {
  const nested = useContext(MainContext)
  const Element = nested ? "div" : "main"

  return (
    <MainContext.Provider value>
      <Element
        {...props}
        id={nested ? undefined : "main"}
        tabIndex={nested ? tabIndex : -1}
      >
        {children}
      </Element>
    </MainContext.Provider>
  )
}
