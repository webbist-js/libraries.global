"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

function Toaster({ ...props }: ToasterProps) {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      // v2 tokens; the shadcn --popover/--border/--radius vars aren't
      // defined, which left toasts with a transparent background.
      style={
        {
          "--normal-bg": "var(--t-bg-deep)",
          "--normal-text": "var(--t-ink-base)",
          "--normal-border": "var(--t-border-line)",
          "--border-radius": "14px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
