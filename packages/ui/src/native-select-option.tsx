import type * as React from "react"

function NativeSelectOption({ ...props }: React.ComponentProps<"option">) {
	return <option data-slot="native-select-option" {...props} />
}

export { NativeSelectOption }
