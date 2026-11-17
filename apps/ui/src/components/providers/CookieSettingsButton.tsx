"use client"

function openCookieSettings() {
  window.dispatchEvent(new Event("open-cookie-settings"))
}

const labels: Record<string, string> = {
  en: "Cookie choices",
  cs: "Nastavení cookies",
  es: "Opciones de cookies",
  fr: "Choix des cookies",
  ja: "Cookie の設定",
  "zh-TW": "Cookie 偏好設定",
}

export function CookieSettingsButton({
  locale = "en",
  className,
  onOpen,
}: {
  readonly locale?: string
  readonly className?: string
  readonly onOpen?: () => void
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (onOpen) {
          onOpen()
          requestAnimationFrame(openCookieSettings)
        } else openCookieSettings()
      }}
    >
      {labels[locale] ?? labels.en}
    </button>
  )
}
