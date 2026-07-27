import type { CompanionVariableDefinitions, CompanionVariableValues } from '@companion-module/base'
import { CONTROL_PROTOCOL_VERSION } from './protocol.js'
import { selectedCamera } from './state.js'
import type ModuleInstance from './main.js'

export type VariablesSchema = {
	connection_status: string
	app_version: string
	protocol_version: number
	expansion_enabled: string
	focus_mode: string
	selected_camera_number: number | string
	selected_title: string
	selected_url: string
	camera_count: number
	last_error: string
}

export function GetVariableDefinitions(): CompanionVariableDefinitions<VariablesSchema> {
	return {
		connection_status: { name: 'Connection status' },
		app_version: { name: 'DIT Browse version' },
		protocol_version: { name: 'Control protocol version' },
		expansion_enabled: { name: 'Expansion mode enabled' },
		focus_mode: { name: 'Camera focus mode active' },
		selected_camera_number: { name: 'Selected camera number' },
		selected_title: { name: 'Selected camera title' },
		selected_url: { name: 'Selected camera URL' },
		camera_count: { name: 'Numbered camera count' },
		last_error: { name: 'Last error' },
	}
}

function phaseLabel(self: ModuleInstance): string {
	const phase = self.connection.currentPhase
	return phase.charAt(0).toUpperCase() + phase.slice(1)
}

export function GetVariableValues(self: ModuleInstance): CompanionVariableValues {
	const status = self.connection.currentState.status
	const selected = selectedCamera(status)
	return {
		connection_status: phaseLabel(self),
		app_version: self.connection.appVersion,
		protocol_version: CONTROL_PROTOCOL_VERSION,
		expansion_enabled: status?.expansionEnabled ? 'Yes' : 'No',
		focus_mode: status?.focusMode ? 'Yes' : 'No',
		selected_camera_number: status?.selectedCameraNumber ?? '',
		selected_title: selected?.title ?? '',
		selected_url: selected?.url ?? '',
		camera_count: self.connection.currentState.catalog.length,
		last_error: self.lastError,
	}
}

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	self.setVariableDefinitions(GetVariableDefinitions())
	self.setVariableValues(GetVariableValues(self))
}

export function UpdateVariableValues(self: ModuleInstance): void {
	self.setVariableValues(GetVariableValues(self))
}
