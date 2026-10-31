"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTranslations } from "next-intl"

import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  APPEARANCE_PREFERENCES,
  isAppearancePreference,
} from "@/lib/appearance"

export const APPEARANCE_ICONS = { light: Sun, dark: Moon, system: Monitor }
export function AppearanceControl({
  className,
  inverse = false,
}: {
  readonly className?: string
  readonly inverse?: boolean
}) {
  const appearance = useAppearance()
  const t = useTranslations("appearance")
  if (!appearance || !appearance.enabled) return null
  const preference = appearance.ready ? appearance.preference : "system"
  const Icon = APPEARANCE_ICONS[preference]
  const label = appearance.ready
    ? t("menuName", {
        preference: t(preference),
        resolved: t(appearance.resolved),
      })
    : t("label")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={inverse ? "inverse" : "surface"}
          size="icon-lg"
          disabled={!appearance.ready}
          aria-label={label}
          title={label}
          className={`size-11 ${className ?? ""}`}
        >
          <Icon size={19} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="z-[110] min-w-48 rounded-2xl border-(--t-border-hi) p-2"
      >
        <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value) => {
            if (isAppearancePreference(value)) appearance.choose(value)
          }}
        >
          {APPEARANCE_PREFERENCES.map((value) => {
            const OptionIcon = APPEARANCE_ICONS[value]

            return (
              <DropdownMenuRadioItem
                key={value}
                value={value}
                className="min-h-11 gap-2 rounded-xl"
              >
                <OptionIcon size={17} aria-hidden="true" />
                {t(value)}
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
        <p className="m-0 px-2 pt-2 text-xs text-(--t-ink-dim)">
          {t("systemHint")}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
