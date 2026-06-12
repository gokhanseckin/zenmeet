export type StoredTokens = {
  access_token: string
  refresh_token: string
  /** epoch ms when access_token expires */
  expires_at: number
}

/**
 * Result of a {@link TokenStore.load}. `cas` is an opaque snapshot of the
 * stored value (the ciphertext) captured at load time. Pass it back to
 * {@link TokenStore.save} / {@link TokenStore.markNeedsReconnect} as
 * `expectedCas` to compare-and-set: the write only lands if the stored value
 * has not changed since the load, defeating lost-update races between the
 * cron refresher and concurrent user actions.
 */
export type LoadedTokens = {
  tokens: StoredTokens
  /** Opaque compare-and-set token (the stored ciphertext at load time). */
  cas: string
}

export type SaveOptions = {
  /** Only persist if the stored value still equals this snapshot (CAS). */
  expectedCas?: string
}

export type TokenStore = {
  /** Load decrypted tokens + a CAS snapshot; null if provider not connected. */
  load(): Promise<LoadedTokens | null>
  /**
   * Persist re-encrypted tokens after refresh. Returns true if a row was
   * written. When `expectedCas` is supplied, returns false (no write) if the
   * stored value changed since load — i.e. this caller lost a CAS race.
   */
  save(tokens: StoredTokens, opts?: SaveOptions): Promise<boolean>
  /**
   * Refresh failed permanently — flag teacher for reconnect. When
   * `expectedCas` is supplied, only flags if the stored value is unchanged,
   * so a teacher whose token was concurrently refreshed is not spuriously
   * flagged. Returns true if the flag was set.
   */
  markNeedsReconnect(opts?: SaveOptions): Promise<boolean>
}

export type RefreshFn = (refreshToken: string) => Promise<StoredTokens>

export type CreatedMeeting = { joinUrl: string; providerMeetingId: string }

export interface MeetingProvider {
  createMeeting(args: {
    accessToken: string; title: string; startsAt: Date; endsAt: Date; timezone: string
  }): Promise<CreatedMeeting>
  deleteMeeting(args: { accessToken: string; providerMeetingId: string }): Promise<void>
}
