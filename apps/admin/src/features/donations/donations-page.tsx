"use client"

import * as React from "react"
import type {
  AdminDonationListItemDTO,
  DonationDisputeState,
  DonationStatus,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { downloadCsv } from "@/lib/csv"
import { formatDateTime } from "@/lib/dates"
import { formatMoneyMinor } from "@/lib/money"
import { ComplianceChecklist } from "@/features/donations/compliance-checklist"
import { EligibilityQueue } from "@/features/donations/eligibility-queue"
import {
  pl4CsvRows,
  pl4DefaultYear,
  pl4Period,
  pl4PeriodYears,
} from "@/features/donations/donations-reporting"
import {
  useAdminDonationsInfinite,
  useDonationTotalsByOrg,
  usePlatformDonationSettings,
} from "@/features/donations/use-donations"
import { useNav, useToast } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"

const TABS = [
  { value: "report", label: "PL-4 report" },
  { value: "eligibility", label: "Eligibility" },
  { value: "donations", label: "Donations" },
  { value: "compliance", label: "AB 488" },
] as const

type TabId = (typeof TABS)[number]["value"]

const DONATION_STATUS_VIEW: Record<DonationStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "status-progress" },
  succeeded: { label: "Succeeded", cls: "status-ok" },
  failed: { label: "Failed", cls: "status-flag" },
  refunded: { label: "Refunded", cls: "priority-low" },
  partially_refunded: { label: "Partly refunded", cls: "attention" },
}

const DISPUTE_LABEL: Record<DonationDisputeState, string> = {
  none: "",
  open: "Dispute open",
  won: "Dispute won",
  lost: "Dispute lost",
  warning: "Dispute warning",
}

function DonationRow({ item }: { item: AdminDonationListItemDTO }) {
  const view = DONATION_STATUS_VIEW[item.status]
  const dispute = DISPUTE_LABEL[item.disputeState]
  return (
    <div className="qrow static">
      <div className="leading">
        <span className="evt-row-ico hue-moss" title="Donation">
          <Icons.Star size={15} />
        </span>
      </div>
      <div className="body">
        <div className="top">
          <span className="title">{item.orgName}</span>
          <span className="ident mono">{item.reference}</span>
          {!item.livemode && <span className="pill priority-low tight">Test</span>}
        </div>
        <div className="sub">
          <span className="strong">{formatMoneyMinor(item.amount.amountMinor, item.amount.currency)}</span>
          <span className="sep">·</span>
          <span>civfix fee {formatMoneyMinor(item.platformFeeMinor, item.amount.currency)}</span>
          {item.refundedTotalMinor > 0 && (
            <>
              <span className="sep">·</span>
              <span>
                refunded {formatMoneyMinor(item.refundedTotalMinor, item.amount.currency)}
              </span>
            </>
          )}
          <span className="sep">·</span>
          <span>{item.receiptSentAt ? "receipt sent" : "no receipt yet"}</span>
        </div>
      </div>
      <div className="trailing">
        {dispute !== "" && <span className="pill attention tight">{dispute}</span>}
        <span className={`pill ${view.cls} tight`}>{view.label}</span>
        <span className="age">{formatDateTime(item.chargedAt ?? item.createdAt)}</span>
      </div>
    </div>
  )
}

function DonationsList({ emptyTitle }: { emptyTitle: string }) {
  const q = useAdminDonationsInfinite({})
  const items = React.useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data])
  const totals = q.data?.pages[0]?.totals

  return (
    <>
      {totals && (
        <div className="statusstrip kpi-strip">
          <div className="statcell">
            <div className="statcell-label">Gross</div>
            <div className="statcell-num">{formatMoneyMinor(totals.grossMinor)}</div>
            <div className="statcell-hot">{totals.count.toLocaleString()} donations</div>
          </div>
          <div className="statcell">
            <div className="statcell-label">civfix fee</div>
            <div className="statcell-num">{formatMoneyMinor(totals.platformFeeMinor)}</div>
            <div className="statcell-hot">application fee</div>
          </div>
          <div className="statcell">
            <div className="statcell-label">Refunded</div>
            <div className="statcell-num">{formatMoneyMinor(totals.refundedMinor)}</div>
            <div className="statcell-hot">by the organization</div>
          </div>
        </div>
      )}
      <section className="card">
        <div className="card-head">
          <h3>Donations</h3>
          <div className="spacer" />
          <span className="meta">{items.length} loaded</span>
        </div>
        <div className="queue-list">
          {q.isLoading ? (
            <LoadingState label="Loading donations..." />
          ) : q.isError ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          ) : (
            <>
              {items.length === 0 ? (
                <EmptyState
                  title={emptyTitle}
                  sub="No donation has been charged on the platform yet."
                  icon={<Icons.Star size={20} />}
                />
              ) : (
                items.map((item) => <DonationRow key={item.id} item={item} />)
              )}
              {q.hasNextPage && (
                <button
                  type="button"
                  className="btn load-more"
                  disabled={q.isFetchingNextPage}
                  onClick={() => void q.fetchNextPage()}
                >
                  {q.isFetchingNextPage ? "Loading…" : "Load more"}
                </button>
              )}
            </>
          )}
        </div>
        <div className="card-pad">
          <div className="bcast-note">
            <Icons.Lock size={12} /> Donor names, emails and card numbers are never returned to the
            operator plane. A donation row carries amounts, references and status only.
          </div>
        </div>
      </section>
    </>
  )
}

function Pl4Report() {
  const years = React.useMemo(() => pl4PeriodYears(), [])
  const [year, setYear] = React.useState(() => pl4DefaultYear())
  const period = React.useMemo(() => pl4Period(year), [year])
  const nav = useNav()
  const toast = useToast()

  const settings = usePlatformDonationSettings()
  const currency = settings.data?.currency ?? "USD"
  const q = useDonationTotalsByOrg({ from: period.from, to: period.to })
  const rows = q.data?.items ?? []
  const totals = q.data?.totals
  const truncated = q.data?.truncated === true

  const exportCsv = () => {
    if (!q.data || truncated || settings.data === undefined) return
    const filename = `civfix-pl4-${period.year}${period.complete ? "" : "-interim"}.csv`
    downloadCsv(
      filename,
      pl4CsvRows(q.data.items, period, {
        generatedAt: new Date().toISOString(),
        currency,
        totals: q.data.totals,
      }),
    )
    toast(`PL-4 totals exported · ${filename}`)
  }

  return (
    <>
      <div className="toolbar">
        <FilterChips
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
          value={String(year)}
          onChange={(v) => setYear(Number(v))}
        />
        <div className="toolbar-spacer" />
        <button
          type="button"
          className="btn"
          disabled={
            q.data === undefined ||
            settings.data === undefined ||
            rows.length === 0 ||
            truncated
          }
          title={
            truncated
              ? "The period returned more organizations than the server will total in one call; narrow the window before exporting"
              : settings.data === undefined
                ? "The platform donation settings must load before the export can stamp its currency"
                : undefined
          }
          onClick={exportCsv}
        >
          <Icons.FileText size={13} /> Export PL-4 CSV
        </button>
      </div>

      <section className="card">
        <div className="card-head">
          <h3>{period.label} · totals by organization</h3>
          <div className="spacer" />
          <span className="meta">{rows.length}</span>
        </div>
        <div className="card-pad">
          {q.isLoading ? (
            <LoadingState label="Computing period totals..." />
          ) : q.isError ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No donations in this period"
              sub="No donation was created between the period start and the coverage end."
              icon={<Icons.Star size={20} />}
            />
          ) : (
            <div className="don-table">
              <div className="don-trow head">
                <span>Organization</span>
                <span>Donations</span>
                <span>Gross</span>
                <span>civfix fee</span>
                <span>Refunded</span>
                <span>Net</span>
              </div>
              {rows.map((row) => (
                <div
                  key={row.organizationId}
                  className="don-trow"
                  role="button"
                  tabIndex={0}
                  onClick={() => nav("orgs", row.organizationId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") nav("orgs", row.organizationId)
                  }}
                >
                  <span className="don-org">{row.orgName}</span>
                  <span className="mono">{row.count.toLocaleString()}</span>
                  <span className="mono">{formatMoneyMinor(row.grossMinor, currency)}</span>
                  <span className="mono">{formatMoneyMinor(row.platformFeeMinor, currency)}</span>
                  <span className="mono">{formatMoneyMinor(row.refundedMinor, currency)}</span>
                  <span className="mono">{formatMoneyMinor(row.netMinor, currency)}</span>
                </div>
              ))}
            </div>
          )}
          {!period.complete && (
            <div className="pay-note tone-warn">
              <Icons.AlertTriangle size={13} /> {period.label} is still running. These totals cover
              donations created up to {formatDateTime(period.to)} — an interim view, not the
              full-year report the Attorney General expects. The export is stamped and named
              accordingly.
            </div>
          )}
          {truncated ? (
            <div className="pay-note tone-alert">
              <Icons.AlertTriangle size={13} /> The server capped this period at {rows.length}{" "}
              organizations, so these totals are incomplete and the export is blocked. A filing
              artifact must cover the whole period: split the reporting year into shorter windows,
              or raise the server cap.
            </div>
          ) : totals ? (
            <div className="pay-note tone-ok">
              <Icons.Check size={13} /> Server-computed over the whole period ·{" "}
              {totals.count.toLocaleString()} donations ·{" "}
              {formatMoneyMinor(totals.grossMinor, currency)} gross ·{" "}
              {formatMoneyMinor(totals.netMinor, currency)} net.
            </div>
          ) : null}
          <div className="bcast-note">
            <Icons.Lock size={12} /> A donation belongs to the period by its charge date (the IRS
            contribution date) in UTC, not California local time. Net is gross less the civfix
            platform fee and refunds; refunds count against the period the donation was charged in,
            so a closed year can move after a late refund. Stripe charges its processing fee to the recipient organization;
            civfix never sees it.
          </div>
        </div>
      </section>
    </>
  )
}

function tabFromFocus(focusId: string | null): TabId {
  return TABS.some((t) => t.value === focusId) ? (focusId as TabId) : "report"
}

export function DonationsPage({ focusId }: SectionPageProps) {
  const [tab, setTab] = React.useState<TabId>(() => tabFromFocus(focusId))

  React.useEffect(() => {
    if (focusId !== null) setTab(tabFromFocus(focusId))
  }, [focusId])

  return (
    <>
      <PageHead
        title="Donations"
        subtitle={
          <span>
            civfix enables donations to verified nonprofits and never holds the funds. This is the
            AB 488 operator view: eligibility evidence, the platform fee we took, and the reports the
            California Attorney General expects.
          </span>
        }
      />

      <div className="toolbar">
        <FilterChips
          options={TABS.map((t) => ({ value: t.value, label: t.label }))}
          value={tab}
          onChange={(v) => setTab(v as TabId)}
        />
      </div>

      {tab === "report" && <Pl4Report />}
      {tab === "eligibility" && <EligibilityQueue />}
      {tab === "donations" && <DonationsList emptyTitle="No donations yet" />}
      {tab === "compliance" && <ComplianceChecklist />}
    </>
  )
}
