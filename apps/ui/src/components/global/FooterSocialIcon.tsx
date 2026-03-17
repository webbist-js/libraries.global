"use client"

import { Icon } from "@iconify/react"

const SOCIAL_ICON_MAP: Record<string, string> = {
  facebook: "simple-icons:facebook",
  instagram: "simple-icons:instagram",
  x: "simple-icons:x",
  linkedin: "simple-icons:linkedin",
  youtube: "simple-icons:youtube",
  tiktok: "simple-icons:tiktok",
  whatsapp: "simple-icons:whatsapp",
  telegram: "simple-icons:telegram",
  wechat: "simple-icons:wechat",
  threads: "simple-icons:threads",
  bluesky: "simple-icons:bluesky",
  mastodon: "simple-icons:mastodon",
  pinterest: "simple-icons:pinterest",
}

export function FooterSocialIcon({
  platform,
}: {
  readonly platform?: string | null
}) {
  const icon = platform ? SOCIAL_ICON_MAP[platform] : undefined

  return <Icon icon={icon ?? "mdi:web"} className="size-4" />
}

FooterSocialIcon.displayName = "FooterSocialIcon"

export default FooterSocialIcon
