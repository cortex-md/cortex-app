/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogTitle,
} from "./alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog"

describe("Dialog", () => {
	it("renders modal surfaces without backdrop blur", () => {
		render(
			<Dialog open>
				<DialogContent>
					<DialogTitle>Preferences</DialogTitle>
					<DialogDescription>Change workspace preferences.</DialogDescription>
				</DialogContent>
			</Dialog>,
		)

		const dialog = screen.getByRole("dialog", { name: "Preferences" })
		const overlay = document.querySelector('[data-slot="dialog-overlay"]')
		const positioner = document.querySelector('[data-slot="dialog-positioner"]')

		expect(dialog.className).not.toContain("backdrop-blur-xl")
		expect(dialog.className).not.toContain("translate-x")
		expect(dialog.className).not.toContain("translate-y")
		expect(positioner?.className).toContain("inset-0")
		expect(positioner?.className).toContain("place-items-center")
		expect(positioner?.className).toContain("z-[100]")
		expect(overlay?.className).toContain("z-[90]")
	})
})

describe("AlertDialog", () => {
	it("renders alert modal surfaces without backdrop blur", () => {
		render(
			<AlertDialog open>
				<AlertDialogContent>
					<AlertDialogTitle>Delete note?</AlertDialogTitle>
					<AlertDialogDescription>This action can be undone.</AlertDialogDescription>
				</AlertDialogContent>
			</AlertDialog>,
		)

		const alertDialog = screen.getByRole("alertdialog", { name: "Delete note?" })
		const overlay = document.querySelector('[data-slot="alert-dialog-overlay"]')
		const positioner = document.querySelector('[data-slot="alert-dialog-positioner"]')

		expect(alertDialog.className).not.toContain("backdrop-blur-xl")
		expect(alertDialog.className).not.toContain("translate-x")
		expect(alertDialog.className).not.toContain("translate-y")
		expect(positioner?.className).toContain("inset-0")
		expect(positioner?.className).toContain("place-items-center")
		expect(positioner?.className).toContain("z-[100]")
		expect(overlay?.className).toContain("z-[90]")
	})
})
