import type { Metadata, Viewport } from "next"
import { Bricolage_Grotesque, Manrope, JetBrains_Mono } from "next/font/google"
import { tokens } from "@civfix/shared/tokens"

import { Providers } from "@/components/providers"
import "./globals.css"
// The ported design system CSS (warm-paper tokens + every shell/component class from the PinIt Admin
// handoff). Imported AFTER globals.css so the design's component classes win over Tailwind's base
// reset wherever they overlap on the shell. admin.css @imports colors-and-type.css itself.
import "@/styles/admin.css"
// Dashboard app additions the prototype lacked: the Cloudflare Access sign-in gate, boot screen, inline
// spinner, and loading / error / empty states. Built on the same design tokens; imported last so it can
// layer on top of the ported design CSS.
import "@/styles/app.css"

/**
 * Fonts are loaded via next/font/google and exposed as CSS variables that the design CSS references
 * through a bridge in globals.css (--font-display / --font-body / --font-mono -> --font-*-next). The
 * families match tokens.font (Bricolage Grotesque / Manrope / JetBrains Mono), identical to
 * community-web.
 */
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
})

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["400", "500", "600", "700"],
})

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "civfix Operations",
  description: "civfix admin and operator dashboard: discovery, reports, events, mail, users, and moderation.",
  applicationName: "civfix Operations",
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  // Sourced from the shared token (neutral.paper) so browser chrome matches the app background.
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
