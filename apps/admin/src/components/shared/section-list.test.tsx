import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ListCard, ListStates, LoadMoreButton, SearchBox } from "@/components/shared/section-list"

const IDLE = { isLoading: false, isError: false, error: null, refetch: () => undefined }

function nextPage(overrides: Partial<{ hasNextPage: boolean; isFetchingNextPage: boolean }> = {}) {
  return { hasNextPage: true, isFetchingNextPage: false, fetchNextPage: vi.fn(), ...overrides }
}

describe("ListStates", () => {
  it("shows the loading label while loading", () => {
    render(
      <ListStates query={{ ...IDLE, isLoading: true }} loadingLabel="Loading rows...">
        <p>rows</p>
      </ListStates>,
    )
    expect(screen.getByRole("status")).toHaveTextContent("Loading rows...")
    expect(screen.queryByText("rows")).toBeNull()
  })

  it("shows the error with a retry that refetches", () => {
    const refetch = vi.fn()
    render(
      <ListStates query={{ ...IDLE, isError: true, error: "boom", refetch }} loadingLabel="Loading rows...">
        <p>rows</p>
      </ListStates>,
    )
    expect(screen.getByRole("alert")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(refetch).toHaveBeenCalledOnce()
  })

  it("shows the empty state only when empty", () => {
    const { rerender } = render(
      <ListStates query={IDLE} loadingLabel="Loading rows..." isEmpty empty={<p>nothing</p>}>
        <p>rows</p>
      </ListStates>,
    )
    expect(screen.getByText("nothing")).toBeInTheDocument()
    expect(screen.queryByText("rows")).toBeNull()

    rerender(
      <ListStates query={IDLE} loadingLabel="Loading rows..." isEmpty={false} empty={<p>nothing</p>}>
        <p>rows</p>
      </ListStates>,
    )
    expect(screen.getByText("rows")).toBeInTheDocument()
    expect(screen.queryByText("nothing")).toBeNull()
  })
})

describe("LoadMoreButton", () => {
  it("renders nothing without a next page", () => {
    const { container } = render(
      <LoadMoreButton query={nextPage({ hasNextPage: false })} className="list-load-more" />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("fetches the next page on click", () => {
    const query = nextPage()
    render(<LoadMoreButton query={query} className="list-load-more" />)
    const button = screen.getByRole("button", { name: "Load more" })
    expect(button).toHaveClass("btn", "list-load-more")
    expect(button).not.toHaveAttribute("style")
    fireEvent.click(button)
    expect(query.fetchNextPage).toHaveBeenCalledOnce()
  })

  it("is disabled while the next page loads", () => {
    render(<LoadMoreButton query={nextPage({ isFetchingNextPage: true })} className="load-more" />)
    expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled()
  })

  it("takes a custom label", () => {
    render(<LoadMoreButton query={nextPage()} className="load-more" label="Load more broadcasts" />)
    expect(screen.getByRole("button", { name: "Load more broadcasts" })).toHaveClass("btn", "load-more")
  })
})

describe("ListCard", () => {
  it("renders the card head and list body", () => {
    const { container } = render(
      <ListCard title="Events" meta={0}>
        <p>rows</p>
      </ListCard>,
    )
    expect(container.innerHTML).toBe(
      '<section class="card md-list"><div class="card-head"><h3>Events</h3><div class="spacer"></div>' +
        '<span class="meta">0</span></div><div class="queue-list"><p>rows</p></div></section>',
    )
  })

  it("omits the meta when it is undefined", () => {
    const { container } = render(
      <ListCard title="Hosts">
        <p>rows</p>
      </ListCard>,
    )
    expect(container.querySelector(".meta")).toBeNull()
  })
})

describe("SearchBox", () => {
  it("reports the typed value", () => {
    const onChange = vi.fn()
    render(<SearchBox label="Search events" placeholder="Search…" value="" onChange={onChange} />)
    fireEvent.change(screen.getByRole("textbox", { name: "Search events" }), { target: { value: "park" } })
    expect(onChange).toHaveBeenCalledWith("park")
  })
})
