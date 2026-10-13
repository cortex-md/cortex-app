import { getErrorMessage } from "@cortex/core"
import { Button, Host } from "@expo/ui"
import { CreditCard } from "lucide-react-native"
import { Platform, StyleSheet, Text, View } from "react-native"

import {
	getHostedSyncPlan,
	openUpgradeCheckout,
	useHostedSyncEntitlement,
} from "@/features/billing/billingAdapter"
import { toast } from "@/features/feedback/useToast"
import { SettingsBlock, SettingsFooter, SettingsScroll } from "@/features/settings/SettingsLayout"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const PURCHASE_NOTE = IS_IOS
	? "[Purchase path on iOS: App Store in-app purchase or web checkout]"
	: "[Purchase path on Android: Google Play Billing or web checkout]"

async function upgrade(): Promise<void> {
	try {
		await openUpgradeCheckout()
	} catch (error) {
		toast(getErrorMessage(error))
	}
}

function PlanRequiredBanner() {
	const { colors } = useMobileColors()
	return (
		<View style={[styles.banner, { backgroundColor: colors.errorBackground }]}>
			<CreditCard color={colors.destructiveText} size={20} strokeWidth={2} />
			<Text style={[styles.bannerText, { color: colors.destructiveText }]}>Plan Required</Text>
		</View>
	)
}

export function PlanScreen() {
	const { colors } = useMobileColors()
	const plan = getHostedSyncPlan()
	const { entitled } = useHostedSyncEntitlement()

	return (
		<SettingsScroll>
			{!entitled ? <PlanRequiredBanner /> : null}
			<View style={[styles.card, { backgroundColor: colors.cell }]}>
				<Text style={[styles.eyebrow, { color: colors.tint }]}>{plan.eyebrow}</Text>
				<Text style={[styles.headline, { color: colors.label }]}>{plan.headline}</Text>
				<Text style={[styles.body, { color: colors.secondaryLabel }]}>{plan.body}</Text>
				<View style={styles.priceRow}>
					<Text style={[styles.price, { color: colors.label }]}>{plan.price}</Text>
					<Text style={[styles.period, { color: colors.secondaryLabel }]}>{plan.period}</Text>
				</View>
				<Text style={[styles.tagline, { color: colors.secondaryLabel }]}>{plan.tagline}</Text>
				<Host matchContents style={styles.cta}>
					<Button label={plan.cta} onPress={() => void upgrade()} variant="filled" />
				</Host>
			</View>
			<SettingsBlock>
				<SettingsFooter>{plan.selfHostingNote}</SettingsFooter>
				<SettingsFooter>{PURCHASE_NOTE}</SettingsFooter>
			</SettingsBlock>
		</SettingsScroll>
	)
}

const styles = StyleSheet.create({
	banner: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 18 : 16,
		flexDirection: "row",
		gap: 10,
		marginHorizontal: 16,
		marginTop: 12,
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	bannerText: {
		fontSize: 15,
		fontWeight: "600",
		lineHeight: 20,
	},
	body: {
		fontSize: 15,
		lineHeight: 21,
	},
	card: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 20,
		gap: 10,
		marginHorizontal: 16,
		marginTop: 12,
		padding: 20,
	},
	cta: {
		marginTop: 8,
	},
	eyebrow: {
		fontSize: 13,
		fontWeight: "600",
		letterSpacing: 0.6,
		lineHeight: 18,
		textTransform: "uppercase",
	},
	headline: {
		fontSize: 26,
		fontWeight: "700",
		letterSpacing: IS_IOS ? -0.4 : 0,
		lineHeight: 32,
	},
	period: {
		fontSize: 15,
		lineHeight: 20,
	},
	price: {
		fontSize: 34,
		fontWeight: "700",
		lineHeight: 40,
	},
	priceRow: {
		alignItems: "baseline",
		flexDirection: "row",
		gap: 6,
		marginTop: 6,
	},
	tagline: {
		fontSize: 13,
		lineHeight: 18,
	},
})
