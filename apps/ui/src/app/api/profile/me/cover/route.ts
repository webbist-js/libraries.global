import { clearProfileCover, uploadProfileImage } from "@/lib/profile-image"

export async function POST(req: Request) {
  return uploadProfileImage(req, "cover")
}

export const DELETE = clearProfileCover
