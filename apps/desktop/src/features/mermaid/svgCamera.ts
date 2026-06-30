export interface SvgCameraBox {
	x: number
	y: number
	width: number
	height: number
}

export interface SvgViewportSize {
	width: number
	height: number
}

export interface SvgViewportPoint {
	x: number
	y: number
}

export const minZoom = 0.25
export const maxZoom = 4
export const zoomStep = 1.18
export const fitPaddingRatio = 0.08

const viewBoxSeparatorPattern = /[\s,]+/

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value))
}

function hasValidBox(box: SvgCameraBox): boolean {
	return (
		Number.isFinite(box.x) &&
		Number.isFinite(box.y) &&
		Number.isFinite(box.width) &&
		Number.isFinite(box.height) &&
		box.width > 0 &&
		box.height > 0
	)
}

function hasValidViewport(viewport: SvgViewportSize): boolean {
	return (
		Number.isFinite(viewport.width) &&
		Number.isFinite(viewport.height) &&
		viewport.width > 0 &&
		viewport.height > 0
	)
}

export function parseSvgViewBox(value: string | null): SvgCameraBox | null {
	if (!value) return null
	const [x, y, width, height] = value.trim().split(viewBoxSeparatorPattern).map(Number)
	const box = { x, y, width, height }
	return hasValidBox(box) ? box : null
}

export function mergeCameraBoxes(
	...boxes: readonly (SvgCameraBox | null | undefined)[]
): SvgCameraBox | null {
	const validBoxes = boxes.filter((box): box is SvgCameraBox => Boolean(box && hasValidBox(box)))
	if (validBoxes.length === 0) return null

	const minX = Math.min(...validBoxes.map((box) => box.x))
	const minY = Math.min(...validBoxes.map((box) => box.y))
	const maxX = Math.max(...validBoxes.map((box) => box.x + box.width))
	const maxY = Math.max(...validBoxes.map((box) => box.y + box.height))
	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY,
	}
}

export function formatSvgViewBox(box: SvgCameraBox): string {
	return [box.x, box.y, box.width, box.height]
		.map((value) => Number.parseFloat(value.toFixed(4)).toString())
		.join(" ")
}

export function normalizeCameraAspect(
	camera: SvgCameraBox,
	viewport: SvgViewportSize,
): SvgCameraBox {
	if (!hasValidBox(camera) || !hasValidViewport(viewport)) return camera

	const viewportAspect = viewport.width / viewport.height
	const cameraAspect = camera.width / camera.height
	if (Math.abs(cameraAspect - viewportAspect) < 0.0001) return camera

	if (cameraAspect < viewportAspect) {
		const nextWidth = camera.height * viewportAspect
		return {
			x: camera.x - (nextWidth - camera.width) / 2,
			y: camera.y,
			width: nextWidth,
			height: camera.height,
		}
	}

	const nextHeight = camera.width / viewportAspect
	return {
		x: camera.x,
		y: camera.y - (nextHeight - camera.height) / 2,
		width: camera.width,
		height: nextHeight,
	}
}

export function fitCameraToViewport(
	diagramBox: SvgCameraBox,
	viewport: SvgViewportSize,
	paddingRatio = fitPaddingRatio,
): SvgCameraBox {
	const safePaddingRatio = Math.max(0, paddingRatio)
	const paddedBox = {
		x: diagramBox.x - diagramBox.width * safePaddingRatio,
		y: diagramBox.y - diagramBox.height * safePaddingRatio,
		width: diagramBox.width * (1 + safePaddingRatio * 2),
		height: diagramBox.height * (1 + safePaddingRatio * 2),
	}
	return normalizeCameraAspect(paddedBox, viewport)
}

export function zoomCameraAtViewportPoint(
	camera: SvgCameraBox,
	fitCamera: SvgCameraBox,
	viewport: SvgViewportSize,
	point: SvgViewportPoint,
	zoomFactor: number,
): SvgCameraBox {
	if (!hasValidBox(camera) || !hasValidBox(fitCamera) || !hasValidViewport(viewport)) {
		return camera
	}

	const currentZoom = fitCamera.width / camera.width
	const nextZoom = clamp(currentZoom * zoomFactor, minZoom, maxZoom)
	const nextWidth = fitCamera.width / nextZoom
	const nextHeight = fitCamera.height / nextZoom
	const pointRatioX = clamp(point.x / viewport.width, 0, 1)
	const pointRatioY = clamp(point.y / viewport.height, 0, 1)
	const svgPointX = camera.x + camera.width * pointRatioX
	const svgPointY = camera.y + camera.height * pointRatioY

	return {
		x: svgPointX - nextWidth * pointRatioX,
		y: svgPointY - nextHeight * pointRatioY,
		width: nextWidth,
		height: nextHeight,
	}
}

export function panCameraByViewportDelta(
	camera: SvgCameraBox,
	viewport: SvgViewportSize,
	delta: SvgViewportPoint,
): SvgCameraBox {
	if (!hasValidBox(camera) || !hasValidViewport(viewport)) return camera

	return {
		x: camera.x - delta.x * (camera.width / viewport.width),
		y: camera.y - delta.y * (camera.height / viewport.height),
		width: camera.width,
		height: camera.height,
	}
}
