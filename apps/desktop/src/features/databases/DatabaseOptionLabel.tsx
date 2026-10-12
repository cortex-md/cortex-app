import type { DatabaseGroup } from "@cortex/properties/database"
import { DatabasePill } from "./DatabaseValue"

export function DatabaseOptionLabel({ group }: { group: DatabaseGroup }) {
	if (group.option) return <DatabasePill option={group.option} />
	return <span className="db-group-label">{group.label}</span>
}
