export const REMOTE_ORIGIN = "collab:remote"
export const SEED_ORIGIN = "collab:seed"
export const RECONCILE_ORIGIN = "collab:reconcile"
export const EXTERNAL_ORIGIN = "collab:external"

export const OUTGOING_FLUSH_DELAY_MS = 40
export const OUTGOING_FLUSH_BYTES = 64 * 1024
export const AWARENESS_THROTTLE_MS = 100
export const LEADER_HANDSHAKE_MS = 5_000
export const RELEASE_GRACE_MS = 30_000
export const RECONNECT_MIN_DELAY_MS = 1_000
export const RECONNECT_MAX_DELAY_MS = 30_000
export const COMPACT_MAX_BYTES = Math.floor(1.4 * 1024 * 1024)
export const MAX_COLLAB_NOTE_BYTES = 1024 * 1024
export const EMPTY_UPDATE_BYTES = 2
