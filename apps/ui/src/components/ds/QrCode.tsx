"use client"
import { QRCodeSVG } from "qrcode.react"

export function QrCode({
  value,
  label,
  size = 176,
}: {
  readonly value: string
  readonly label: string
  readonly size?: number
}) {
  return (
    <QRCodeSVG
      value={value}
      size={size}
      level="M"
      marginSize={4}
      title={label}
    />
  )
}
