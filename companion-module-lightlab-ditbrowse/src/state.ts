import type { DitBrowseStatus } from './protocol.js'

export interface CameraCatalogEntry {
	cameraNumber: number
	title: string
	url: string
}

export interface ConnectionState {
	status: DitBrowseStatus | null
	revision: number
	catalog: CameraCatalogEntry[]
}

export interface AppliedStatus {
	state: ConnectionState
	accepted: boolean
	catalogChanged: boolean
}

export const EMPTY_CONNECTION_STATE: ConnectionState = {
	status: null,
	revision: -1,
	catalog: [],
}

export function cameraCatalog(status: DitBrowseStatus): CameraCatalogEntry[] {
	const seen = new Set<number>()
	const catalog: CameraCatalogEntry[] = []
	for (const tab of status.tabs) {
		if (tab.cameraNumber === null || seen.has(tab.cameraNumber)) {
			continue
		}
		seen.add(tab.cameraNumber)
		catalog.push({
			cameraNumber: tab.cameraNumber,
			title: tab.title,
			url: tab.url,
		})
	}
	return catalog
}

export function sameCatalog(left: CameraCatalogEntry[], right: CameraCatalogEntry[]): boolean {
	return JSON.stringify(left) === JSON.stringify(right)
}

export function applyStatus(previous: ConnectionState, status: DitBrowseStatus, revision?: number): AppliedStatus {
	if (revision !== undefined && revision <= previous.revision) {
		return { state: previous, accepted: false, catalogChanged: false }
	}

	const catalog = cameraCatalog(status)
	return {
		state: {
			status,
			revision: revision ?? previous.revision,
			catalog,
		},
		accepted: true,
		catalogChanged: !sameCatalog(previous.catalog, catalog),
	}
}

export function selectedCamera(status: DitBrowseStatus | null): CameraCatalogEntry | null {
	if (!status || status.selectedCameraNumber === null) {
		return null
	}
	return cameraCatalog(status).find((camera) => camera.cameraNumber === status.selectedCameraNumber) ?? null
}
