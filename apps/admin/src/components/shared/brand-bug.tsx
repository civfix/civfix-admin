const BRAND_BUG_SRC = "/ds/pinit-bug.svg"

// Decorative: every caller sets the brand name in text beside it or hides it from assistive tech.
export function BrandBug({ width, height }: { width: number; height: number }) {
  // A tiny static SVG: next/image adds nothing under the static export's unoptimized images.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={BRAND_BUG_SRC} alt="" width={width} height={height} />
}
