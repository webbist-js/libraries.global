// Offline data boundary. Every reader requires an explicit synthetic response.
import { readServerFixture } from "../server-fixtures"

export function fetchDrives(...args: unknown[]) {
  return readServerFixture("driveRecords.fetchDrives", args)
}
export function fetchDrive(...args: unknown[]) {
  return readServerFixture("driveRecords.fetchDrive", args)
}
export function fetchDriveStats(...args: unknown[]) {
  return readServerFixture("driveRecords.fetchDriveStats", args)
}
export function fetchDriveInReview(...args: unknown[]) {
  return readServerFixture("driveRecords.fetchDriveInReview", args)
}
export function fetchDriveLeaderboard(...args: unknown[]) {
  return readServerFixture("driveRecords.fetchDriveLeaderboard", args)
}
