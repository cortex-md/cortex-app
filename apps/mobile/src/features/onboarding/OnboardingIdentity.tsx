import { FormSection, NativeForm } from "@/components/ui/Form"
import {
	FormButton,
	FormHeader,
	FormPicker,
	FormTextField,
} from "@/features/onboarding/FormControls"
import {
	findVaultIcon,
	vaultColorOptions,
	vaultIconOptions,
} from "@/features/onboarding/vaultAppearance"

export function OnboardingIdentity({
	color,
	fieldKey,
	icon,
	initialName,
	name,
	onBack,
	onChangeColor,
	onChangeIcon,
	onChangeName,
	onContinue,
	showTitle,
}: {
	color: string
	fieldKey: string
	icon: string
	initialName: string
	name: string
	onBack?: () => void
	onChangeColor: (color: string) => void
	onChangeIcon: (icon: string) => void
	onChangeName: (name: string) => void
	onContinue: () => void
	showTitle: boolean
}) {
	const canContinue = name.trim().length > 0
	return (
		<NativeForm>
			{showTitle ? (
				<FormSection>
					<FormHeader title="New vault" />
				</FormSection>
			) : null}
			<FormSection title="Name">
				<FormTextField
					autoCapitalize="words"
					defaultValue={initialName}
					key={fieldKey}
					label="Vault name"
					onChangeText={onChangeName}
					onSubmit={canContinue ? onContinue : undefined}
					placeholder="Vault name"
				/>
			</FormSection>
			<FormSection title="Appearance">
				<FormPicker
					icon={{ md: "palette", sf: "paintpalette" }}
					label="Color"
					onChange={onChangeColor}
					options={vaultColorOptions}
					value={color}
				/>
				<FormPicker
					icon={findVaultIcon(icon).symbol}
					label="Icon"
					onChange={onChangeIcon}
					options={vaultIconOptions}
					value={icon}
				/>
			</FormSection>
			<FormSection>
				<FormButton disabled={!canContinue} label="Continue" onPress={onContinue} />
				{onBack ? <FormButton label="Back" onPress={onBack} variant="plain" /> : null}
			</FormSection>
		</NativeForm>
	)
}
