import { describeRepeat, parseQuickAdd, type QuickAddResult, toIsoDate } from "@cortex/tasks"
import { useMemo, useState } from "react"
import { Alert } from "react-native"

import { FormRow, FormSection } from "@/components/ui/Form"
import { toast } from "@/features/feedback/useToast"
import { dismissSheet } from "@/features/navigation/routes"
import { submitQuickAdd } from "@/features/today/quickAddActions"
import { SheetToolbar } from "@/features/today/SheetToolbar"
import { DateRow, TaskForm } from "@/features/today/TaskFormControls"

const PLACEHOLDER = "Call Ana tomorrow at 3pm"

function withDueOverride(parsed: QuickAddResult, due: string | null | undefined): QuickAddResult {
	if (due === undefined) return parsed
	if (due === null) return { title: parsed.title }
	return { ...parsed, due }
}

export function QuickAddSheet() {
	const today = toIsoDate(new Date())
	const [draft, setDraft] = useState("")
	const [dueOverride, setDueOverride] = useState<string | null | undefined>(undefined)
	const [submitting, setSubmitting] = useState(false)
	const parsed = useMemo(() => parseQuickAdd(draft.trim(), today), [draft, today])
	const result = withDueOverride(parsed, dueOverride)
	const hasTokens = Boolean(parsed.due || parsed.time || parsed.repeat)
	const canAdd = result.title.length > 0 && !submitting

	const handleAdd = () => {
		if (!canAdd) return
		setSubmitting(true)
		void submitQuickAdd(result).then((added) => {
			if (added) {
				dismissSheet()
				toast("Added to Inbox")
				return
			}
			setSubmitting(false)
			Alert.alert("Couldn't add the task", "The vault's task inbox is not ready yet. Try again.")
		})
	}

	return (
		<>
			<SheetToolbar
				confirmDisabled={!canAdd}
				confirmLabel="Add"
				onCancel={dismissSheet}
				onConfirm={handleAdd}
				title="New task"
			/>
			<TaskForm
				autoFocus
				initialTitle=""
				onSubmitTitle={handleAdd}
				onTitleChange={setDraft}
				placeholder={PLACEHOLDER}
			>
				{hasTokens ? (
					<FormSection title="Detected">
						<FormRow
							icon={{ sf: "checklist", md: "checklist" }}
							title={parsed.title || "No title"}
						/>
						{result.time ? (
							<FormRow icon={{ sf: "clock", md: "schedule" }} title="Time" value={result.time} />
						) : null}
						{result.repeat ? (
							<FormRow
								icon={{ sf: "repeat", md: "repeat" }}
								title="Repeat"
								value={describeRepeat(result.repeat)}
							/>
						) : null}
					</FormSection>
				) : null}
				<FormSection>
					<DateRow
						icon={{ sf: "calendar", md: "calendar_today" }}
						onChange={(date) => setDueOverride(date ?? null)}
						title="Due date"
						today={today}
						value={result.due}
					/>
				</FormSection>
			</TaskForm>
		</>
	)
}
