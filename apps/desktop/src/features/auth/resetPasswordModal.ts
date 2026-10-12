import { createModalStore } from "@/utils/createModalStore"

export interface ResetPasswordTarget {
	token: string
	serverUrl: string | null
}

export const resetPasswordModal = createModalStore<ResetPasswordTarget>()
