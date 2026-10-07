import { screen, waitFor } from "@testing-library/react"
import { expect } from "vitest"

const SECTION_FALLBACK = "Loading..."

// AppShell mounts each section through React.lazy, and React holds a lazily resolved page back until
// 300 ms after its Suspense fallback committed. Awaiting that swap on its own keeps the page's data
// waits from sharing one findBy budget with it.
export async function waitForSectionPage(): Promise<void> {
  await waitFor(() => expect(screen.queryByText(SECTION_FALLBACK)).toBeNull())
}
