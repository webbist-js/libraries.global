import { uploadProfileImage } from "@/lib/profile-image"

export async function POST(req: Request) {
  return uploadProfileImage(req, "avatar")
}
