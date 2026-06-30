import { describe, expect, it } from "vitest"
import {
	fitCameraToViewport,
	formatSvgViewBox,
	maxZoom,
	mergeCameraBoxes,
	minZoom,
	normalizeCameraAspect,
	panCameraByViewportDelta,
	parseSvgViewBox,
	zoomCameraAtViewportPoint,
} from "../../../features/mermaid/svgCamera"

describe("svgCamera", () => {
	it("fits the diagram with padding while preserving viewport aspect", () => {
		const camera = fitCameraToViewport(
			{ x: 0, y: 0, width: 100, height: 50 },
			{ width: 400, height: 200 },
		)

		expect(camera.x).toBe(-8)
		expect(camera.y).toBe(-4)
		expect(camera.width).toBeCloseTo(116)
		expect(camera.height).toBeCloseTo(58)
	})

	it("normalizes camera aspect around its center", () => {
		const camera = normalizeCameraAspect(
			{ x: 0, y: 0, width: 100, height: 100 },
			{ width: 300, height: 100 },
		)

		expect(camera).toEqual({ x: -100, y: 0, width: 300, height: 100 })
	})

	it("zooms around a viewport point", () => {
		const fitCamera = { x: -8, y: -4, width: 116, height: 58 }
		const camera = zoomCameraAtViewportPoint(
			fitCamera,
			fitCamera,
			{ width: 400, height: 200 },
			{ x: 200, y: 100 },
			2,
		)

		expect(camera).toEqual({ x: 21, y: 10.5, width: 58, height: 29 })
	})

	it("clamps zoom to the configured range", () => {
		const fitCamera = { x: -8, y: -4, width: 116, height: 58 }
		const zoomedIn = zoomCameraAtViewportPoint(
			fitCamera,
			fitCamera,
			{ width: 400, height: 200 },
			{ x: 200, y: 100 },
			100,
		)
		const zoomedOut = zoomCameraAtViewportPoint(
			fitCamera,
			fitCamera,
			{ width: 400, height: 200 },
			{ x: 200, y: 100 },
			0.001,
		)

		expect(zoomedIn.width).toBe(fitCamera.width / maxZoom)
		expect(zoomedOut.width).toBe(fitCamera.width / minZoom)
	})

	it("converts viewport pan delta into viewBox coordinates", () => {
		const camera = panCameraByViewportDelta(
			{ x: -8, y: -4, width: 116, height: 58 },
			{ width: 400, height: 200 },
			{ x: 40, y: 20 },
		)

		expect(camera).toEqual({ x: -19.6, y: -9.8, width: 116, height: 58 })
	})

	it("parses and formats viewBox values", () => {
		expect(parseSvgViewBox("0, 0, 100, 50")).toEqual({ x: 0, y: 0, width: 100, height: 50 })
		expect(parseSvgViewBox("0 0 0 50")).toBeNull()
		expect(formatSvgViewBox({ x: 0.333333, y: 1.2, width: 100, height: 50 })).toBe(
			"0.3333 1.2 100 50",
		)
	})

	it("merges viewBox and rendered content bounds", () => {
		expect(
			mergeCameraBoxes(
				{ x: 0, y: 0, width: 100, height: 50 },
				{ x: -20, y: -5, width: 140, height: 60 },
			),
		).toEqual({ x: -20, y: -5, width: 140, height: 60 })
		expect(mergeCameraBoxes(null, undefined)).toBeNull()
	})
})
