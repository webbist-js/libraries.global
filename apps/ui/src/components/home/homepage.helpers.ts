import {
  type LucideIcon,
  BookOpen,
  Building2,
  Compass,
  Database,
  Landmark,
  Search,
  Sparkles,
  Users,
} from "lucide-react"

export function getLibraryLocationLabel(library: {
  city?: string | null
  country?: { name?: string | null } | null
  continent?: { name?: string | null } | null
}) {
  const locationParts = [
    library.city,
    library.country?.name,
    library.continent?.name,
  ]
    .filter(Boolean)
    .slice(0, 2)

  return locationParts.join(", ")
}

export function getServiceIcon(category?: string | null): LucideIcon {
  switch (category) {
    case "Access":
      return Search
    case "Learning":
      return BookOpen
    case "Research":
    case "Archives":
      return Database
    case "Community":
      return Users
    case "Business":
      return Building2
    case "Culture":
      return Landmark
    case "Digital":
      return Sparkles

    default:
      return Compass
  }
}
