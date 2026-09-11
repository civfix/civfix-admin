import { describe, expect, it, vi } from "vitest"
import { MAX_IMAGE_BYTES } from "@civfix/shared"

import {
  MAX_ORG_LOGO_BYTES,
  ORG_LOGO_ACCEPT,
  ORG_LOGO_PUT_BASE_TIMEOUT_MS,
  buildLogoUploadRequest,
  logoContentType,
  logoFileProblem,
  logoPutTimeoutMs,
  prepareLogo,
  putLogoBytes,
  uploadOrgLogo,
} from "./org-logo-upload"

function imageBlob(type: string, bytes = 4): Blob & { type: string; size: number } {
  return new Blob([new Uint8Array(bytes)], { type }) as Blob & { type: string; size: number }
}

describe("ORG_LOGO_ACCEPT", () => {
  it("offers exactly the three image types the picker accepts", () => {
    expect(ORG_LOGO_ACCEPT).toBe("image/png,image/jpeg,image/webp")
  })

  it("takes its byte cap from the shared media schemas", () => {
    expect(MAX_ORG_LOGO_BYTES).toBe(MAX_IMAGE_BYTES)
  })
})

describe("logoContentType", () => {
  it("drops parameters and normalizes case", () => {
    expect(logoContentType("IMAGE/JPEG; charset=binary")).toBe("image/jpeg")
    expect(logoContentType("")).toBe("")
  })
})

describe("logoFileProblem", () => {
  it("accepts png, jpeg and webp", () => {
    expect(logoFileProblem({ type: "image/png", size: 10 })).toBeNull()
    expect(logoFileProblem({ type: "image/jpeg", size: 10 })).toBeNull()
    expect(logoFileProblem({ type: "image/webp", size: 10 })).toBeNull()
  })

  it("rejects another type, an empty file and one over the cap", () => {
    expect(logoFileProblem({ type: "image/gif", size: 10 })).toMatch(/PNG, JPEG or WebP/)
    expect(logoFileProblem({ type: "application/pdf", size: 10 })).toMatch(/PNG, JPEG or WebP/)
    expect(logoFileProblem({ type: "image/png", size: 0 })).toMatch(/empty/)
    expect(logoFileProblem({ type: "image/png", size: MAX_ORG_LOGO_BYTES + 1 })).toMatch(/15 MB/)
    expect(logoFileProblem({ type: "image/png", size: MAX_ORG_LOGO_BYTES })).toBeNull()
  })
})

describe("prepareLogo + buildLogoUploadRequest", () => {
  it("builds an image presign request from the file's own bytes", async () => {
    const prepared = await prepareLogo(imageBlob("image/PNG; charset=binary", 4))
    expect(prepared.contentType).toBe("image/png")
    expect(prepared.byteSize).toBe(4)
    expect(prepared.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(buildLogoUploadRequest(prepared)).toEqual({
      kind: "image",
      contentType: "image/png",
      byteSize: 4,
      sha256: prepared.sha256,
    })
  })
})

describe("logoPutTimeoutMs", () => {
  it("never drops below the base timeout and scales with the byte size", () => {
    expect(logoPutTimeoutMs(0)).toBe(ORG_LOGO_PUT_BASE_TIMEOUT_MS)
    expect(logoPutTimeoutMs(1_000)).toBe(ORG_LOGO_PUT_BASE_TIMEOUT_MS)
    expect(logoPutTimeoutMs(MAX_ORG_LOGO_BYTES)).toBeGreaterThan(ORG_LOGO_PUT_BASE_TIMEOUT_MS)
  })
})

describe("putLogoBytes", () => {
  it("PUTs the bytes with the presigned headers", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response)
    const body = imageBlob("image/png")
    await putLogoBytes("https://storage/put", { "content-type": "image/png" }, body, 4, fetchImpl)
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://storage/put")
    expect(init.method).toBe("PUT")
    expect(init.headers).toEqual({ "content-type": "image/png" })
    expect(init.body).toBe(body)
  })

  it("throws on a non-2xx storage response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response)
    await expect(
      putLogoBytes("https://storage/put", {}, imageBlob("image/png"), 4, fetchImpl),
    ).rejects.toThrow(/403/)
  })

  it("replaces a blocked or dropped request with connection copy", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    await expect(
      putLogoBytes("https://storage/put", {}, imageBlob("image/png"), 4, fetchImpl),
    ).rejects.toThrow("Upload failed. Please check your connection and try again.")
  })
})

describe("uploadOrgLogo", () => {
  it("presigns, PUTs and finalizes, returning the media id", async () => {
    const createMediaUpload = vi.fn().mockResolvedValue({
      uploadId: "44444444-4444-4444-8444-444444444444",
      putUrl: "https://storage/put",
      headers: { "content-type": "image/webp" },
    })
    const finalizeMedia = vi
      .fn()
      .mockResolvedValue({ mediaId: "55555555-5555-4555-8555-555555555555", status: "validating" })
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response)

    const mediaId = await uploadOrgLogo({
      api: { createMediaUpload, finalizeMedia },
      file: imageBlob("image/webp", 8),
      fetchImpl,
    })

    expect(createMediaUpload).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "image", contentType: "image/webp", byteSize: 8 }),
    )
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(finalizeMedia).toHaveBeenCalledWith({
      uploadId: "44444444-4444-4444-8444-444444444444",
    })
    expect(mediaId).toBe("55555555-5555-4555-8555-555555555555")
  })

  it("refuses a disallowed file before any request", async () => {
    const createMediaUpload = vi.fn()
    const finalizeMedia = vi.fn()
    await expect(
      uploadOrgLogo({
        api: { createMediaUpload, finalizeMedia },
        file: imageBlob("image/gif"),
        fetchImpl: vi.fn(),
      }),
    ).rejects.toThrow(/PNG, JPEG or WebP/)
    expect(createMediaUpload).not.toHaveBeenCalled()
    expect(finalizeMedia).not.toHaveBeenCalled()
  })
})
