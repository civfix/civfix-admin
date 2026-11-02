import { afterEach, beforeEach } from "vitest"

import { startConsoleGuard, stopConsoleGuard } from "@/test/console"

beforeEach(startConsoleGuard)
afterEach(stopConsoleGuard)
