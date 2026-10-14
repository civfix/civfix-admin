export const SECOND_MS = 1_000
export const MINUTE_MS = 60 * SECOND_MS

// Long enough to skip a request per keystroke of a word typed in one burst, short enough that the
// list still feels live.
export const SEARCH_DEBOUNCE_MS = 250

// Leaflet measures its container once, at creation, possibly before the surrounding layout has
// settled, so a new map measures again shortly after; its ResizeObserver covers every later change.
export const MAP_SETTLE_MS = 60
