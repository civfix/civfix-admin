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
  publicationTitle,
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
