"use client"

import dynamic from "next/dynamic"
import type { AdminReportDTO, ReportCategory } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { LightboxSync } from "@/components/shared/lightbox"
import { categoryCssVar, categoryPinSrc } from "@/lib/category"
import { ImageThumbButton, openLightboxAt, StillThumbFace } from "@/features/reports/media-thumb"
import type { ReportMediaView } from "@/features/reports/report-media"
import { useRefreshReportMedia } from "@/features/reports/use-reports"

const LeafletMap = dynamic(() => import("@/components/map/leaflet-map").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <div className="pi-map-canvas" aria-busy="true" />,
})

const REPORT_MINIMAP_ZOOM = 14
const MINIMAP_PIN_ID = "r"
const STREET_VIEW_BASE_URL = "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint="

function streetViewUrl([lat, lng]: AdminReportDTO["coords"]): string {
  return `${STREET_VIEW_BASE_URL}${lat},${lng}`
}

function ReportPhotoFace({
  photoUrl,
  pin,
  category,
}: {
  photoUrl: string | null
  pin: string
  category: ReportCategory
}) {
  return (
    <>
      {photoUrl ? (
        <img className="rep-photo-img" src={photoUrl} alt="Reporter photo" decoding="async" />
      ) : (
        <span className="rep-photo-pin" style={{ background: categoryCssVar(category) }}>
          <img src={pin} alt="" />
        </span>
      )}
      {photoUrl && (
        <span className="rep-photo-tag">
          <Icons.Eye size={12} /> Reporter photo
        </span>
      )}
    </>
  )
}

function ReportPhoto({ report, media }: { report: AdminReportDTO; media: ReportMediaView }) {
  const refreshMedia = useRefreshReportMedia(report.id)
  const { preview, lightboxImages } = media
  const photoUrl = preview ? (preview.thumbUrl ?? preview.url) : null
  const catStyle = { ["--cat" as string]: categoryCssVar(report.category) }
  const face = (
    <ReportPhotoFace
      photoUrl={photoUrl}
      pin={categoryPinSrc(report.category)}
      category={report.category}
    />
  )
  if (!preview) {
    return (
      <div className="rep-photo" style={catStyle}>
        {face}
      </div>
    )
  }
  return (
    <button
      type="button"
      className="rep-photo rep-photo-open"
      style={catStyle}
      title="Expand this photo"
      onClick={() => openLightboxAt(lightboxImages, preview.id, refreshMedia)}
    >
      {face}
    </button>
  )
}

export function ReportLocation({ report, media }: { report: AdminReportDTO; media: ReportMediaView }) {
  return (
    <div className="sub">
      <div className="sub-head">
        Location
        <a
          className="btn sm ghost"
          style={{ marginLeft: "auto" }}
          href={streetViewUrl(report.coords)}
          target="_blank"
          rel="noopener noreferrer"
          title="Open this location in Google Street View"
        >
          <Icons.Eye size={11} /> Street View
        </a>
      </div>
      <div className="sub-body" style={{ padding: 10 }}>
        <div className="rep-media">
          <LightboxSync images={media.lightboxImages} />
          {report.hasPhoto && <ReportPhoto report={report} media={media} />}
          <div className="rep-minimap">
            <LeafletMap
              pins={[
                {
                  id: MINIMAP_PIN_ID,
                  category: report.category,
                  lat: report.coords[0],
                  lng: report.coords[1],
                },
              ]}
              center={report.coords}
              zoom={REPORT_MINIMAP_ZOOM}
              tint="voyager"
              interactive={false}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function ReportPhotos({ reportId, media }: { reportId: string; media: ReportMediaView }) {
  const refreshMedia = useRefreshReportMedia(reportId)
  const { gallery, lightboxImages } = media
  return (
    <div className="sub">
      <div className="sub-head">
        Photos
        <span className="rep-confirms" style={{ marginLeft: "auto" }}>
          <Icons.Eye size={12} /> {gallery.length}
        </span>
      </div>
      <div className="sub-body" style={{ padding: 10 }}>
        <div className="dsc-msg-media">
          {gallery.map((m) =>
            m.kind === "image" ? (
              <ImageThumbButton
                key={m.id}
                media={m}
                onOpen={() => openLightboxAt(lightboxImages, m.id, refreshMedia)}
              />
            ) : (
              <a
                key={m.id}
                className="dsc-msg-thumb"
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                title="Open full media in a new tab"
              >
                <StillThumbFace thumbUrl={m.thumbUrl} />
              </a>
            ),
          )}
        </div>
      </div>
    </div>
  )
}
