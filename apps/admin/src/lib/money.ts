const FORMATTERS = new Map<string, Intl.NumberFormat>()

function formatter(currency: string): Intl.NumberFormat {
  const key = currency.toUpperCase()
  const cached = FORMATTERS.get(key)
  if (cached) return cached
  const made = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: key,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  FORMATTERS.set(key, made)
  return made
}

export function formatMoneyMinor(amountMinor: number, currency = "USD"): string {
  if (!Number.isFinite(amountMinor)) return "—"
  return formatter(currency).format(amountMinor / 100)
}

export function moneyMinorToDecimalString(amountMinor: number): string {
  if (!Number.isFinite(amountMinor)) return "0.00"
  const negative = amountMinor < 0
  const abs = Math.abs(Math.trunc(amountMinor))
  const whole = Math.floor(abs / 100)
  const cents = abs % 100
  return `${negative ? "-" : ""}${whole}.${String(cents).padStart(2, "0")}`
}
