// Offline data boundary. Every reader requires an explicit synthetic response.
import { readServerFixture } from "../server-fixtures"

export const HOW_DRIVES_WORK_SLUG = "how-drives-work"
export function fetchPlaceNames(...args: unknown[]) {
  return readServerFixture("drives.fetchPlaceNames", args)
}
export function loadDriveViews(...args: unknown[]) {
  return readServerFixture("drives.loadDriveViews", args)
}
export function openDriveCount(...args: unknown[]) {
  return readServerFixture("drives.openDriveCount", args)
}
export function fetchFeaturedDriveView(...args: unknown[]) {
  return readServerFixture("drives.fetchFeaturedDriveView", args)
}
export function fetchHomepageDriveViews(...args: unknown[]) {
  return readServerFixture("drives.fetchHomepageDriveViews", args)
}
export function drivesInPlaces(...args: unknown[]) {
  return readServerFixture("drives.drivesInPlaces", args)
}
export function howDrivesWorkHref(...args: unknown[]) {
  return readServerFixture("drives.howDrivesWorkHref", args)
}
