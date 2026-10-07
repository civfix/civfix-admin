import type { ReactNode } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"

import { makeTestQueryClient } from "@/test/render"

// Runs one mutation through a client wired to the app's mutation cache, so its meta toasts fire.
export async function runMutation<I>(
  useHook: () => { mutateAsync: (input: I) => Promise<unknown> },
  input: I,
): Promise<void> {
  const client = makeTestQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(useHook, { wrapper })
  await act(() => result.current.mutateAsync(input))
}
