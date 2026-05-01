import { redirect } from "next/navigation"

// Settings moved to /profile/settings
export default function SettingsRedirectPage() {
  redirect("/profile/settings")
}
