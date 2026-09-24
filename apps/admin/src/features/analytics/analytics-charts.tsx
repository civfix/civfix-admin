"use client"

/**
 * Analytics chart helpers, ported from the design (metrics.jsx BarChart and pages-operations.jsx
 * Spark). Class names + DOM mirror the prototype so they render pixel-faithfully against the ported
 * admin.css (`.barchart*`, `.hub-spark*`). Used by the Analytics cards (pins-per-week + cleanup
 * events use BarChart; Spark is available for compact inline trends).
 */

/** A column bar chart with an optional label row; the last bar gets the `now` accent. */
export function BarChart({ values, labels }: { values: number[]; labels?: string[] }) {
  const max = Math.max(...values, 1)
  return (
    <div className="barchart">
      {values.map((v, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={i} className="barchart-col">
          <div className="barchart-bar-wrap">
            <div
              className={`barchart-bar ${i === values.length - 1 ? "now" : ""}`}
              style={{ height: `${(v / max) * 100}%` }}
            >
              <span className="barchart-val">{v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}</span>
            </div>
          </div>
          {labels && <div className="barchart-label">{labels[i]}</div>}
        </div>
      ))}
    </div>
  )
}

/** A compact sparkline (the design's hub spark): min/max-normalized bars, last bar accented. */
export function Spark({
  values,
  label,
  hue = "moss",
}: {
  values: number[]
  label: string
  hue?: string
}) {
  const max = Math.max(...values)
  const min = Math.min(...values)
  return (
    <div className={`hub-spark hue-${hue}`} role="img" aria-label={label}>
      {values.map((v, i) => (
        <span
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className={`hub-spark-bar ${i === values.length - 1 ? "now" : ""}`}
          style={
            {
              height: `${10 + ((v - min) / (max - min || 1)) * 88}%`,
              "--sh": "var(--hue)",
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
