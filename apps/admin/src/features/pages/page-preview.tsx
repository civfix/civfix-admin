"use client"

import * as React from "react"

import { Icons } from "@/components/icons"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { EmptyState } from "@/components/shared/page-primitives"
import { pageBlockViews } from "@/features/pages/page-blocks"
import { useAdminEventPage } from "@/features/pages/use-pages"

export function PagePreview({ cleanupId, title }: { cleanupId: string; title: string }) {
  const q = useAdminEventPage(cleanupId)
  const blocks = React.useMemo(() => pageBlockViews(q.data?.blocks ?? []), [q.data])

  if (q.isLoading) return <LoadingState label="Loading page content..." />
  if (q.isError) {
    return (
      <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load the page" />
    )
  }
  const page = q.data
  if (!page) return null

  return (
    <div className="pg-preview">
      {page.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="pg-cover" src={page.coverUrl} alt="" />
      )}
      <div className="pg-seo">
        <div className="pg-seo-title">{page.seo.title ?? title}</div>
        {page.seo.description && <div className="pg-seo-desc">{page.seo.description}</div>}
        <div className="pg-seo-meta mono">
          {page.slug ? `/${page.slug}` : "no public slug"} · theme {page.theme.accent} ·{" "}
          {page.seo.noindex ? "noindex" : "indexable"}
        </div>
      </div>
      {blocks.length === 0 ? (
        <EmptyState
          title="No blocks"
          sub="This page has no content blocks."
          icon={<Icons.Layers size={20} />}
        />
      ) : (
        <div className="pg-blocks">
          {blocks.map((block) => (
            <div key={block.id} className="pg-block">
              <div className="pg-block-head">
                <span className="pg-block-kind">{block.label}</span>
                {block.title && <span className="pg-block-title">{block.title}</span>}
              </div>
              {block.lines.length > 0 && (
                <div className="pg-block-body">
                  {block.lines.map((line, index) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <p key={index}>{line}</p>
                  ))}
                </div>
              )}
              {block.links.length > 0 && (
                <div className="pg-block-links">
                  {block.links.map((href) => (
                    <span key={href} className="mono">
                      {href}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="bcast-note">
        <Icons.Eye size={12} /> The operator read returns the stored content at any status, so a
        draft, unpublished or flagged page renders here exactly as it would publish. Text is plain
        text extracted from the stored markdown subset; outbound links are shown as text and never
        made clickable here.
      </div>
    </div>
  )
}
