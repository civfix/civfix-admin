import type { ReactElement } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, type RenderResult } from "@testing-library/react"

export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  })
}

export function renderWithQuery(
  ui: ReactElement,
  client: QueryClient = makeTestQueryClient(),
): RenderResult & { client: QueryClient } {
  return { ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>), client }
}
