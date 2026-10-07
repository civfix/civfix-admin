"use client"

import { SourceFooter } from "@/components/shell/source-footer"
import { LiveMap } from "@/components/map/live-map"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { HostPlatformLauncher } from "@/features/home/host-platform-launcher"
import { PreviewList } from "@/features/home/preview-list"
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

function AnalyticsCell({
  summaryQuery,
  analytics,
}: Pick<ReturnType<typeof useHomeTiles>, "summaryQuery" | "analytics">) {
  return (
    <div className="bt-cell bt-analytics">
      {summaryQuery.isLoading ? (
        <section className="card">
          <LoadingState label="Loading summary..." />
        </section>
      ) : summaryQuery.isError ? (
        <section className="card">
          <ErrorState
            error={summaryQuery.error}
            onRetry={() => summaryQuery.refetch()}
            title="Could not load the dashboard summary"
          />
        </section>
      ) : analytics ? (
        <MetricSectionTile summary={analytics} />
      ) : null}
    </div>
  )
}

export function HomePage(_props: SectionPageProps) {
  const { summaryQuery, analytics, tiles } = useHomeTiles()

  return (
    <div className="hub">
      <div className="hub-bento">
        <div className="bt-cell bt-map">
          <LiveMap />
        </div>

        <PreviewCell tile={tiles.discovery} />
        <AnalyticsCell summaryQuery={summaryQuery} analytics={analytics} />
        <PreviewCell tile={tiles.moderation} />
        <PreviewCell tile={tiles.mail} />
        <PreviewCell tile={tiles.users} />
        <PreviewCell tile={tiles.reports} />
        <PreviewCell tile={tiles.events} />

        <div className="bt-cell bt-host">
          <HostPlatformLauncher />
        </div>
      </div>
      <SourceFooter />
    </div>
  )
}
