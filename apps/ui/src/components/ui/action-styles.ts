import { buttonVariants } from "@/components/ui/button"

/** Compact editorial primary action; inherits the shared control contract. */
export const primaryCtaSm = buttonVariants({
  variant: "primary",
  size: "pill-sm",
  className: "px-5 py-2.5",
})

/** Its quieter companion, such as Cancel beside a primary action. */
export const secondaryCtaSm = buttonVariants({
  variant: "surface",
  size: "pill-sm",
  className: "px-5 py-2.5",
})
