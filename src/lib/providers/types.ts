export type StoredTokens = {
  access_token: string
  refresh_token: string
  /** epoch ms when access_token expires */
  expires_at: number
}

export type TokenStore = {
  /** Load decrypted tokens; null if provider not connected. */
  load(): Promise<StoredTokens | null>
  /** Persist re-encrypted tokens after refresh. */
  save(tokens: StoredTokens): Promise<void>
  /** Refresh failed permanently — flag teacher for reconnect. */
  markNeedsReconnect(): Promise<void>
}

export type RefreshFn = (refreshToken: string) => Promise<StoredTokens>

export type CreatedMeeting = { joinUrl: string; providerMeetingId: string }

export interface MeetingProvider {
  createMeeting(args: {
    accessToken: string; title: string; startsAt: Date; endsAt: Date; timezone: string
  }): Promise<CreatedMeeting>
  deleteMeeting(args: { accessToken: string; providerMeetingId: string }): Promise<void>
}
