// A flat or all-minimum series still draws a visible stub instead of an empty track.
const SPARK_FLOOR_PCT = 10
const SPARK_SPAN_PCT = 88

export function barHeightPcts(values: readonly number[]): number[] {
  const max = Math.max(...values, 1)
  return values.map((v) => (v / max) * 100)
}

export function sparkHeightPcts(values: readonly number[]): number[] {
  const max = Math.max(...values)
  const min = Math.min(...values)
  return values.map((v) => SPARK_FLOOR_PCT + ((v - min) / (max - min || 1)) * SPARK_SPAN_PCT)
}
