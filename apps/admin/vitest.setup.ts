import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

import { resetApiMock } from "@/test/api-mock"

// Unmount first so a query still in flight from this test cannot land on the next test's mocks.
afterEach(() => {
  cleanup()
  resetApiMock()
})
