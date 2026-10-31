import type { ProfileNetworkAffiliation } from "@/components/networks/NetworkAffiliations"
import type { DriveView } from "@/lib/drives/drive-view"
import type { UserProfile } from "@/lib/types/profile"

export type Workspace = {
  actorId: string
  asOf: number
  profile: UserProfile | null
  avatarUrl: string | null
  imageUploadsEnabled: boolean
  followedDrives: DriveView[] | null
  affiliations?: ProfileNetworkAffiliation[] | null
}
