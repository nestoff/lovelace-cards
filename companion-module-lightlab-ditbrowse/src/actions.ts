import type { CompanionActionDefinitions } from '@companion-module/base'
import type ModuleInstance from './main.js'

export type ActionsSchema = {
	focus_camera: { options: { cameraNumber: number } }
	show_grid: { options: Record<string, never> }
	toggle_expansion: { options: Record<string, never> }
	refresh_status: { options: Record<string, never> }
}

export function GetActionDefinitions(self: ModuleInstance): CompanionActionDefinitions<ActionsSchema> {
	return {
		focus_camera: {
			name: 'Focus Camera',
			description: 'Expand a numbered camera when expansion mode is enabled.',
			options: [
				{
					id: 'cameraNumber',
					type: 'number',
					label: 'Camera number',
					default: 1,
					min: 1,
					max: 999999,
					step: 1,
					asInteger: true,
				},
			],
			callback: async (event) => {
				const cameraNumber = event.options.cameraNumber
				if (!Number.isSafeInteger(cameraNumber) || cameraNumber < 1) {
					throw new Error('Camera number must be a positive integer')
				}
				await self.executeCommand({ type: 'focusCamera', cameraNumber })
			},
		},
		show_grid: {
			name: 'Show Grid',
			description: 'Show every camera without changing expansion mode.',
			options: [],
			callback: async () => {
				await self.executeCommand({ type: 'showGrid' })
			},
		},
		toggle_expansion: {
			name: 'Toggle Expansion Mode',
			description: 'Enable or disable single-camera expansion. Disabling locks DIT Browse to the grid.',
			options: [],
			callback: async () => {
				await self.executeCommand({ type: 'toggleExpansion' })
			},
		},
		refresh_status: {
			name: 'Refresh Status',
			description: 'Request a complete current state snapshot from DIT Browse.',
			options: [],
			callback: async () => {
				await self.executeCommand({ type: 'status' })
			},
		},
	}
}

export function UpdateActions(self: ModuleInstance): void {
	self.setActionDefinitions(GetActionDefinitions(self))
}
