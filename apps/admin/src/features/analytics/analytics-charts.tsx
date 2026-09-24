"use client"

import type { CSSProperties } from "react"

import { barHeightPcts, barValueLabel, sparkHeightPcts } from "@/features/analytics/chart-geometry"

// Class names and DOM match the `.barchart*` and `.hub-spark*` rules in admin.css.

// The `.hue-*` classes admin.css defines; any other value paints nothing.
export type Hue = "slate" | "lilac" | "sun" | "sky" | "moss" | "bloom"

export function BarChart({ values, labels }: { values: number[]; labels?: string[] }) {
  const heights = barHeightPcts(values)
  return (
    <div className="barchart">
      {values.map((v, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={i} className="barchart-col">
          <div className="barchart-bar-wrap">
            <div
              className={`barchart-bar ${i === values.length - 1 ? "now" : ""}`}
              style={{ height: `${heights[i]}%` }}
            >
              <span className="barchart-val">{barValueLabel(v)}</span>
            </div>
          </div>
          {labels && <div className="barchart-label">{labels[i]}</div>}
        </div>
      ))}
    </div>
  )
}

export function Spark({
  values,
  label,
  hue = "moss",
}: {
  values: number[]
  label: string
  hue?: Hue
}) {
  const heights = sparkHeightPcts(values)
  return (
    <div className={`hub-spark hue-${hue}`} role="img" aria-label={label}>
      {heights.map((height, i) => (
        <span
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className={`hub-spark-bar ${i === heights.length - 1 ? "now" : ""}`}
          style={
            {
              height: `${height}%`,
              "--sh": "var(--hue)",
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
