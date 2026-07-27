export const CONTROL_PROTOCOL = 'ditbrowse.control'
export const CONTROL_PROTOCOL_VERSION = 1
export const CONTROL_WEBSOCKET_PATH = '/api/ws'

export interface DitBrowseStatusTab {
	index: number
	tileId: string
	cameraId: string | null
	cameraNumber: number | null
	title: string
	url: string
}

export interface DitBrowseStatus {
	expansionEnabled: boolean
	focusMode: boolean
	selectedCameraNumber: number | null
	selectedTileId: string | null
	selectedIndex: number | null
	tabs: DitBrowseStatusTab[]
}

export type DitBrowseCommand =
	| { type: 'status' }
	| { type: 'focusCamera'; cameraNumber: number }
	| { type: 'showGrid' }
	| { type: 'toggleExpansion' }

export interface ClientHello {
	type: 'hello'
	protocol: typeof CONTROL_PROTOCOL
	protocolVersion: typeof CONTROL_PROTOCOL_VERSION
	client: { name: string; version: string }
}

export interface CommandMessage {
	type: 'command'
	requestId: string
	command: DitBrowseCommand
}

export interface ServerHello {
	type: 'hello'
	protocol: typeof CONTROL_PROTOCOL
	protocolVersion: typeof CONTROL_PROTOCOL_VERSION
	server: { name: string; version: string }
	capabilities: string[]
}

export type ResultMessage =
	| { type: 'result'; requestId: string; ok: true; status?: DitBrowseStatus }
	| {
			type: 'result'
			requestId: string
			ok: false
			error: { code: string; message: string }
	  }

export interface StatusEvent {
	type: 'event'
	event: 'status'
	revision: number
	status: DitBrowseStatus
}

export interface ProtocolErrorMessage {
	type: 'error'
	error: { code: string; message: string }
}

export type ServerMessage = ServerHello | ResultMessage | StatusEvent | ProtocolErrorMessage

export class ProtocolValidationError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNullableString(value: unknown): value is string | null {
	return value === null || typeof value === 'string'
}

function isNullablePositiveInteger(value: unknown): value is number | null {
	return value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 1)
}

function parseStatusTab(value: unknown): DitBrowseStatusTab {
	if (
		!isRecord(value) ||
		typeof value.index !== 'number' ||
		!Number.isSafeInteger(value.index) ||
		value.index < 1 ||
		typeof value.tileId !== 'string' ||
		!isNullableString(value.cameraId) ||
		!isNullablePositiveInteger(value.cameraNumber) ||
		typeof value.title !== 'string' ||
		typeof value.url !== 'string'
	) {
		throw new ProtocolValidationError('Invalid DIT Browse status tab')
	}

	return {
		index: value.index,
		tileId: value.tileId,
		cameraId: value.cameraId,
		cameraNumber: value.cameraNumber,
		title: value.title,
		url: value.url,
	}
}

export function parseStatus(value: unknown): DitBrowseStatus {
	if (
		!isRecord(value) ||
		typeof value.expansionEnabled !== 'boolean' ||
		typeof value.focusMode !== 'boolean' ||
		!isNullablePositiveInteger(value.selectedCameraNumber) ||
		!isNullableString(value.selectedTileId) ||
		!isNullablePositiveInteger(value.selectedIndex) ||
		!Array.isArray(value.tabs)
	) {
		throw new ProtocolValidationError('Invalid DIT Browse status')
	}

	return {
		expansionEnabled: value.expansionEnabled,
		focusMode: value.focusMode,
		selectedCameraNumber: value.selectedCameraNumber,
		selectedTileId: value.selectedTileId,
		selectedIndex: value.selectedIndex,
		tabs: value.tabs.map(parseStatusTab),
	}
}

function requireError(value: unknown): { code: string; message: string } {
	if (!isRecord(value) || typeof value.code !== 'string' || typeof value.message !== 'string') {
		throw new ProtocolValidationError('Invalid DIT Browse protocol error')
	}
	return { code: value.code, message: value.message }
}

export function parseServerMessage(value: unknown): ServerMessage {
	if (!isRecord(value)) {
		throw new ProtocolValidationError('DIT Browse message must be an object')
	}

	if (value.type === 'hello') {
		if (
			value.protocol !== CONTROL_PROTOCOL ||
			value.protocolVersion !== CONTROL_PROTOCOL_VERSION ||
			!isRecord(value.server) ||
			typeof value.server.name !== 'string' ||
			typeof value.server.version !== 'string' ||
			!Array.isArray(value.capabilities) ||
			!value.capabilities.every((capability) => typeof capability === 'string')
		) {
			throw new ProtocolValidationError('Unsupported DIT Browse protocol hello')
		}
		return {
			type: 'hello',
			protocol: CONTROL_PROTOCOL,
			protocolVersion: CONTROL_PROTOCOL_VERSION,
			server: { name: value.server.name, version: value.server.version },
			capabilities: value.capabilities,
		}
	}

	if (value.type === 'result') {
		if (typeof value.requestId !== 'string' || !value.requestId || typeof value.ok !== 'boolean') {
			throw new ProtocolValidationError('Invalid DIT Browse command result')
		}
		if (value.ok) {
			return {
				type: 'result',
				requestId: value.requestId,
				ok: true,
				...(value.status === undefined ? {} : { status: parseStatus(value.status) }),
			}
		}
		return {
			type: 'result',
			requestId: value.requestId,
			ok: false,
			error: requireError(value.error),
		}
	}

	if (value.type === 'event' && value.event === 'status') {
		if (typeof value.revision !== 'number' || !Number.isSafeInteger(value.revision) || value.revision < 0) {
			throw new ProtocolValidationError('Invalid DIT Browse status revision')
		}
		return {
			type: 'event',
			event: 'status',
			revision: value.revision,
			status: parseStatus(value.status),
		}
	}

	if (value.type === 'error') {
		return { type: 'error', error: requireError(value.error) }
	}

	throw new ProtocolValidationError('Unsupported DIT Browse server message')
}

export function createClientHello(version: string): ClientHello {
	return {
		type: 'hello',
		protocol: CONTROL_PROTOCOL,
		protocolVersion: CONTROL_PROTOCOL_VERSION,
		client: { name: 'companion-module-lightlab-ditbrowse', version },
	}
}

export function createCommandMessage(requestId: string, command: DitBrowseCommand): CommandMessage {
	return { type: 'command', requestId, command }
}
