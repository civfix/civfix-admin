"use client"

import { SourceFooter } from "@/components/shell/source-footer"
import { LiveMap } from "@/components/map/live-map"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { HostPlatformLauncher } from "@/features/home/host-platform-launcher"
import { PreviewList } from "@/features/home/preview-list"
import type { SectionSummary } from "@/features/home/home-summaries"
import { MetricSectionTile, PreviewSectionTile } from "@/features/home/section-tiles"
import { useHomeTiles, type PreviewTileModel } from "@/features/home/use-home-tiles"
import type { SectionPageProps } from "@/components/shell/page-registry"

function PreviewCell({ tile }: { tile: PreviewTileModel }) {
  return (
    <div className={`bt-cell ${tile.cell}`}>
      <PreviewSectionTile summary={tile.summary} feature={tile.feature} moreLabel={tile.moreLabel}>
        <PreviewList page={tile.summary.page} state={tile.state} rows={tile.rows} />
      </PreviewSectionTile>
    </div>
  )
}

// The tiles drawn from the summary alone show its loading and error states in their own cell.
function SummaryCell({
  cell,
  summaryQuery,
  summary,
  loadingLabel,
  errorTitle,
}: {
  cell: string
  summaryQuery: ReturnType<typeof useHomeTiles>["summaryQuery"]
  summary: SectionSummary | undefined
  loadingLabel: string
  errorTitle: string
}) {
  return (
    <div className={`bt-cell ${cell}`}>
      {summaryQuery.isLoading ? (
        <section className="card">
          <LoadingState label={loadingLabel} />
        </section>
      ) : summaryQuery.isError ? (
        <section className="card">
          <ErrorState error={summaryQuery.error} onRetry={() => summaryQuery.refetch()} title={errorTitle} />
        </section>
      ) : summary ? (
        <MetricSectionTile summary={summary} />
      ) : null}
    </div>
  )
}

export function HomePage(_props: SectionPageProps) {
  const { summaryQuery, analytics, filings, tiles } = useHomeTiles()

  return (
    <div className="hub">
      <div className="hub-bento">
        <div className="bt-cell bt-map">
          <LiveMap />
        </div>

        <PreviewCell tile={tiles.discovery} />
        <SummaryCell
          cell="bt-analytics"
          summaryQuery={summaryQuery}
          summary={analytics}
          loadingLabel="Loading summary..."
          errorTitle="Could not load the dashboard summary"
        />
        <PreviewCell tile={tiles.moderation} />
        <PreviewCell tile={tiles.mail} />
        <PreviewCell tile={tiles.users} />
        <PreviewCell tile={tiles.reports} />
        <PreviewCell tile={tiles.events} />
        <SummaryCell
          cell="bt-filings"
          summaryQuery={summaryQuery}
          summary={filings}
          loadingLabel="Loading filings..."
          errorTitle="Could not load the filings count"
        />

        <div className="bt-cell bt-host">
          <HostPlatformLauncher />
        </div>
      </div>
      <SourceFooter />
    </div>
  )
}
