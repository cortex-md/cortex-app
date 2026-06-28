export interface LivePreviewMetrics {
	blockPasses: number
	viewportPasses: number
	syntaxNodesVisited: number
	candidateBlocks: number
	decorationsProduced: number
}

const metrics: LivePreviewMetrics = {
	blockPasses: 0,
	viewportPasses: 0,
	syntaxNodesVisited: 0,
	candidateBlocks: 0,
	decorationsProduced: 0,
}

export function recordBlockPass(): void {
	metrics.blockPasses++
}

export function recordViewportPass(): void {
	metrics.viewportPasses++
}

export function recordSyntaxNodeVisit(): void {
	metrics.syntaxNodesVisited++
}

export function recordCandidateBlocks(count: number): void {
	metrics.candidateBlocks += count
}

export function recordDecorationsProduced(count: number): void {
	metrics.decorationsProduced += count
}

export function getLivePreviewMetrics(): LivePreviewMetrics {
	return { ...metrics }
}

export function resetLivePreviewMetrics(): void {
	metrics.blockPasses = 0
	metrics.viewportPasses = 0
	metrics.syntaxNodesVisited = 0
	metrics.candidateBlocks = 0
	metrics.decorationsProduced = 0
}
