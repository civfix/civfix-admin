import { describe, expect, it } from "vitest"
import {
  MAIL_AUTH_VERDICT_LABELS,
  MAIL_REPLY_PUBLICATION_LABELS,
  MailAuthVerdictSchema,
  MailReplyPublicationSchema,
  MailStatusSchema,
} from "@civfix/shared"

import {
  AUTH_VERDICT_VIEW,
  MAIL_STATUS_CLS,
  PUBLICATION_CLS,
  PUBLISH_TOAST,
  domainOfAddress,
  publicationTitle,
  publishConfirmBody,
  withheldNote,
  withheldReason,
} from "./mail-presentation"

describe("mail badges", () => {
  it("styles every mail status, verdict and publication state", () => {
    for (const status of MailStatusSchema.options) expect(MAIL_STATUS_CLS[status]).toBeTruthy()
    for (const verdict of MailAuthVerdictSchema.options) {
      expect(AUTH_VERDICT_VIEW[verdict].cls).toBeTruthy()
      expect(AUTH_VERDICT_VIEW[verdict].title).toBeTruthy()
      expect(MAIL_AUTH_VERDICT_LABELS[verdict]).toBeTruthy()
    }
    for (const publication of MailReplyPublicationSchema.options) {
      expect(PUBLICATION_CLS[publication]).toBeTruthy()
      expect(MAIL_REPLY_PUBLICATION_LABELS[publication]).toBeTruthy()
    }
  })

  it("flags a failed sender check and a withheld reply", () => {
    expect(AUTH_VERDICT_VIEW.fail.cls).toBe("status-flag")
    expect(AUTH_VERDICT_VIEW.pass.cls).toBe("status-ok")
    expect(PUBLICATION_CLS.withheld).toBe("status-flag")
    expect(PUBLICATION_CLS.published).toBe("status-ok")
  })

  it("says where a published reply went", () => {
    expect(publicationTitle("published", true)).toBe("Posted to the report chat and timeline.")
    expect(publicationTitle("published", false)).toBe("Added to the event timeline.")
    expect(publicationTitle("withheld", true)).toMatch(/Not posted publicly/)
    expect(publicationTitle("pending", false)).toMatch(/posted shortly/)
  })
})

describe("withheld reply review", () => {
  it("treats a failed, missing or unrecorded sender check as a possible forgery", () => {
    expect(withheldReason("fail")).toBe("auth")
    expect(withheldReason("unknown")).toBe("auth")
    expect(withheldReason("pass")).toBe("domain")
    expect(withheldReason(null)).toBe("auth")
    expect(withheldReason(undefined)).toBe("auth")
  })

  it("explains why the reply was held back and where publishing sends it", () => {
    expect(withheldNote({ authVerdict: "fail", from: "x@city.gov" }, true)).toMatch(
      /^This reply failed sender authentication, so it wasn't posted to the report chat\. It could be forged/,
    )
    expect(withheldNote({ authVerdict: "unknown", from: "x@city.gov" }, false)).toMatch(
      /^This reply couldn't be authenticated, so it wasn't posted to the event timeline\./,
    )
    expect(withheldNote({ authVerdict: "pass", from: "clerk@vendor.example" }, true)).toMatch(
      /^This reply came from vendor\.example, which isn't a domain this thread was sent to, so it wasn't posted to the report chat\./,
    )
    expect(withheldNote({ authVerdict: null, from: "" }, false)).toMatch(
      /^This reply couldn't be authenticated, so it wasn't posted to the event timeline\./,
    )
    expect(withheldNote({ authVerdict: "pass", from: "" }, false)).toMatch(/^This reply came from an unknown sender,/)
  })

  it("shows the sender's domain, never the whole address", () => {
    expect(domainOfAddress("clerk@city.gov")).toBe("city.gov")
    expect(withheldNote({ authVerdict: "pass", from: "clerk@city.gov" }, true)).not.toMatch(/clerk@/)
  })

  it("warns what publishing does before it happens", () => {
    expect(publishConfirmBody(true)).toMatch(/report's public chat.*reporter gets a notification/)
    expect(publishConfirmBody(false)).toMatch(/event's timeline/)
  })

  it("has a toast for every publish outcome", () => {
    for (const publication of MailReplyPublicationSchema.options) {
      expect(PUBLISH_TOAST[publication]).toBeTruthy()
    }
    expect(PUBLISH_TOAST.published).toBe("Reply published")
  })
})
