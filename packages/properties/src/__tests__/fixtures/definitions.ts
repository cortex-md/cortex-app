import type { PropertyDefinition, VaultSchema } from "../../types"

export const selectProperty: PropertyDefinition = {
	id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
	key: "workflow",
	name: "Workflow",
	type: "select",
	createdAt: "2026-06-13T00:00:00.000Z",
	options: [
		{
			id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
			label: "Done",
			color: "green",
		},
	],
	defaultOptionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
}

export function createSystemSchema(): VaultSchema {
	return {
		version: 1,
		properties: [
			selectProperty,
			{
				id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
				key: "note-id",
				name: "ID",
				type: "id",
				createdAt: "2026-06-13T00:00:00.000Z",
			},
			{
				id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
				key: "created-time",
				name: "Created time",
				type: "created_time",
				createdAt: "2026-06-13T00:00:00.000Z",
			},
			{
				id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
				key: "created-by",
				name: "Created by",
				type: "created_by",
				createdAt: "2026-06-13T00:00:00.000Z",
			},
			{
				id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
				key: "edited-time",
				name: "Edited time",
				type: "last_edited_time",
				createdAt: "2026-06-13T00:00:00.000Z",
			},
			{
				id: "12121212-1212-4212-8212-121212121212",
				key: "edited-by",
				name: "Edited by",
				type: "last_edited_by",
				createdAt: "2026-06-13T00:00:00.000Z",
			},
		],
	}
}
