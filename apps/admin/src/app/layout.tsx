import type { Metadata, Viewport } from "next"
import { Bricolage_Grotesque, Manrope, JetBrains_Mono } from "next/font/google"
import { tokens } from "@civfix/shared/tokens"

import { Providers } from "@/components/providers"
import "./globals.css"
// After globals.css so the design system's component classes win over Tailwind's base reset where
// they overlap on the shell.
import "@/styles/admin.css"
// Last, so the app's own additions layer on top of the design system CSS.
import "@/styles/app.css"

// colors-and-type.css builds the --font-display/body/mono stacks from these *-next variables. The names
// must differ from the stacks' own, or the alias becomes a circular var() that CSS invalidates, falling
// back to serif.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display-next",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
})

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body-next",
  display: "swap",
  weight: ["400", "500", "600", "700"],
})

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-next",
  display: "swap",
})

export const metadata: Metadata = {
  title: "civfix Operations",
  description: "civfix admin and operator dashboard: discovery, reports, events, mail, users, and analytics.",
  applicationName: "civfix Operations",
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: tokens.color.neutral.paper,
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
