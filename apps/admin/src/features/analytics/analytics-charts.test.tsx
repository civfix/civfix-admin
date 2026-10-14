import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Spark } from "@/features/analytics/analytics-charts"

describe("Spark", () => {
  it("names the trend for assistive tech", () => {
    render(<Spark values={[1, 4, 2]} label="Pins per week, last 3 weeks: 1, 4, 2" />)

    expect(screen.getByRole("img", { name: "Pins per week, last 3 weeks: 1, 4, 2" })).toBeInTheDocument()
  })

  it("colours the bars through the hue class so a hue without its own custom property still paints", () => {
    render(<Spark values={[1, 4, 2]} hue="slate" label="trend" />)

    const spark = screen.getByRole("img", { name: "trend" })
    expect(spark).toHaveClass("hue-slate")
    const bars = [...spark.querySelectorAll<HTMLElement>(".hub-spark-bar")]
    expect(bars).toHaveLength(3)
    for (const bar of bars) expect(bar.style.getPropertyValue("--sh")).toBe("var(--hue)")
  })
})
