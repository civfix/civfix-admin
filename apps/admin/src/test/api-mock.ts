import { vi, type Mock } from "vitest"

import type { api as realApi } from "@/lib/api"

type ApiMethods = { [K in keyof typeof realApi]: Mock }

const methods = new Map<string, Mock>()

/**
 * Stand-in for the typed API client. Every method is a lazily created `vi.fn()`; an unconfigured
 * method rejects so a test never silently renders against `undefined` data.
 */
export const apiMock = new Proxy({} as ApiMethods, {
  get(_target, name) {
    if (typeof name !== "string") return undefined
    let fn = methods.get(name)
    if (!fn) {
      fn = vi.fn(() => Promise.reject(new Error(`api.${name} was not mocked`)))
      methods.set(name, fn)
    }
    return fn
  },
})

export function resetApiMock(): void {
  methods.clear()
}
