import { Newsreader } from "next/font/google"
import localFont from "next/font/local"

// Keep Figtree's extensionless Google Fonts URLs out of the build-time loader.
export const fontFigtree = localFont({
  src: "../../public/fonts/figtree/Figtree-Variable.ttf",
  weight: "400 700",
  style: "normal",
  variable: "--font-figtree",
  display: "swap",
})

export const fontNewsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-newsreader",
  display: "swap",
})

export const fontJetBrainsMono = localFont({
  src: "../../public/fonts/jetbrains-mono/JetBrainsMono-Variable.ttf",
  weight: "300 600",
  style: "normal",
  variable: "--font-jetbrains-mono",
  display: "swap",
})
