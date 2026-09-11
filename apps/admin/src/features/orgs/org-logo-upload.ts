import { MAX_IMAGE_BYTES, type CreateMediaUploadRequest } from "@civfix/shared"
import type { ApiClient } from "@civfix/shared/client"

import { errorMessage } from "@/lib/error-messages"

export const ORG_LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const
export const ORG_LOGO_ACCEPT = ORG_LOGO_MIME_TYPES.join(",")
export const MAX_ORG_LOGO_BYTES = MAX_IMAGE_BYTES
export const ORG_LOGO_PUT_BASE_TIMEOUT_MS = 120_000
export const ORG_LOGO_MIN_BYTES_PER_SEC = 64_000

export const MAX_ORG_LOGO_LABEL = `${Math.round(MAX_ORG_LOGO_BYTES / (1024 * 1024))} MB`

export interface LogoFileFacts {
  type: string
  size: number
}

export interface PreparedLogo {
  contentType: string
  byteSize: number
  sha256: string
}

export function logoPutTimeoutMs(byteSize: number): number {
  return Math.max(ORG_LOGO_PUT_BASE_TIMEOUT_MS, (byteSize / ORG_LOGO_MIN_BYTES_PER_SEC) * 1000)
}

export function logoContentType(type: string): string {
  return (type.split(";", 1)[0] ?? "").trim().toLowerCase()
}

export function logoFileProblem(file: LogoFileFacts): string | null {
  const type = logoContentType(file.type)
  if (!(ORG_LOGO_MIME_TYPES as readonly string[]).includes(type)) {
    return "Pick a PNG, JPEG or WebP image."
  }
  if (file.size <= 0) return "That file is empty."
  if (file.size > MAX_ORG_LOGO_BYTES) return `The image must be under ${MAX_ORG_LOGO_LABEL}.`
  return null
}

export function buildLogoUploadRequest(prepared: PreparedLogo): CreateMediaUploadRequest {
  return {
    kind: "image",
    contentType: prepared.contentType,
    byteSize: prepared.byteSize,
    sha256: prepared.sha256,
  }
}

export function logoUploadErrorMessage(err: unknown): string {
  return errorMessage(err, {}, { fallback: "Couldn't upload the image. Please try again." })
}

export async function sha256Hex(blob: Blob): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error("A secure context is required to hash the image.")
  const digest = await subtle.digest("SHA-256", await blob.arrayBuffer())
  let hex = ""
  for (const b of new Uint8Array(digest)) hex += b.toString(16).padStart(2, "0")
  return hex
}

export async function prepareLogo(file: Blob & LogoFileFacts): Promise<PreparedLogo> {
  return {
    contentType: logoContentType(file.type),
    byteSize: file.size,
    sha256: await sha256Hex(file),
  }
}

export async function putLogoBytes(
  url: string,
  headers: Record<string, string>,
  body: Blob,
  byteSize: number,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), logoPutTimeoutMs(byteSize))
  let res: Response
  try {
    res = await fetchImpl(url, { method: "PUT", headers, body, signal: controller.signal })
  } catch (err) {
    throw new Error("Upload failed. Please check your connection and try again.", { cause: err })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new Error(`Upload failed (${res.status}). Please try again.`)
}

export interface UploadOrgLogoInput {
  api: Pick<ApiClient, "createMediaUpload" | "finalizeMedia">
  file: Blob & LogoFileFacts
  fetchImpl?: typeof fetch
}

export async function uploadOrgLogo(input: UploadOrgLogoInput): Promise<string> {
  const problem = logoFileProblem(input.file)
  if (problem) throw new Error(problem)
  const prepared = await prepareLogo(input.file)
  const presign = await input.api.createMediaUpload(buildLogoUploadRequest(prepared))
  await putLogoBytes(
    presign.putUrl,
    presign.headers,
    input.file,
    prepared.byteSize,
    input.fetchImpl ?? fetch,
  )
  const finalized = await input.api.finalizeMedia({ uploadId: presign.uploadId })
  return finalized.mediaId
}
