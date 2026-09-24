"use client"

import { avatarColor, monogram, type AdminUserListItemDTO } from "@civfix/shared"

export function UserAvatar({
  user,
  large = false,
}: {
  user: Pick<AdminUserListItemDTO, "id" | "name"> & {
    avatar?: AdminUserListItemDTO["avatar"]
    avatarUrl?: string | null
  }
  large?: boolean
}) {
  const className = `user-av${large ? " lg" : ""}`
  if (user.avatarUrl) {
    return (
      <img className={className} src={user.avatarUrl} alt="" />
    )
  }
  return (
    <span className={className} style={{ background: user.avatar?.[0] ?? avatarColor(user.id) }}>
      {monogram(user.name)}
    </span>
  )
}
