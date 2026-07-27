import type { CompanionFeedbackDefinitions } from '@companion-module/base'
import type ModuleInstance from './main.js'

export type FeedbacksSchema = {
	connected: { type: 'boolean'; options: Record<string, never> }
	expansion_enabled: { type: 'boolean'; options: Record<string, never> }
	grid_visible: { type: 'boolean'; options: Record<string, never> }
	camera_focused: { type: 'boolean'; options: { cameraNumber: number } }
	camera_selected: { type: 'boolean'; options: { cameraNumber: number } }
}

const positiveStyle = { bgcolor: 0x1f8a4c, color: 0xffffff }

const cameraNumberOption = {
	id: 'cameraNumber' as const,
	type: 'number' as const,
	label: 'Camera number',
	default: 1,
	min: 1,
	max: 999999,
	step: 1,
	asInteger: true,
}

export function GetFeedbackDefinitions(self: ModuleInstance): CompanionFeedbackDefinitions<FeedbacksSchema> {
	return {
		connected: {
			name: 'DIT Browse Connected',
			type: 'boolean',
			defaultStyle: positiveStyle,
			options: [],
			callback: () => self.connection.currentPhase === 'connected',
		},
		expansion_enabled: {
			name: 'Expansion Mode Enabled',
			type: 'boolean',
			defaultStyle: positiveStyle,
			options: [],
			callback: () => self.connection.currentState.status?.expansionEnabled === true,
		},
		grid_visible: {
			name: 'Grid Visible',
			type: 'boolean',
			defaultStyle: positiveStyle,
			options: [],
			callback: () => self.connection.currentState.status?.focusMode === false,
		},
		camera_focused: {
			name: 'Camera Focused',
			type: 'boolean',
			defaultStyle: positiveStyle,
			options: [cameraNumberOption],
			callback: (feedback) => {
				const status = self.connection.currentState.status
				return (
					status?.expansionEnabled === true &&
					status.focusMode === true &&
					status.selectedCameraNumber === feedback.options.cameraNumber
				)
			},
		},
		camera_selected: {
			name: 'Camera Selected',
			type: 'boolean',
			defaultStyle: positiveStyle,
			options: [cameraNumberOption],
			callback: (feedback) =>
				self.connection.currentState.status?.selectedCameraNumber === feedback.options.cameraNumber,
		},
	}
}

export function UpdateFeedbacks(self: ModuleInstance): void {
	self.setFeedbackDefinitions(GetFeedbackDefinitions(self))
}
