import type { ResetPasswordTarget } from "@cortex/core"
import { createModalStore } from "@/utils/createModalStore"

export type { ResetPasswordTarget }

export const resetPasswordModal = createModalStore<ResetPasswordTarget>()
