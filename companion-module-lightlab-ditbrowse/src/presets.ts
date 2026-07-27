import type { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type { ModuleSchema } from './main.js'
import type ModuleInstance from './main.js'
import type { CameraCatalogEntry } from './state.js'

const baseStyle = {
	text: '',
	size: 'auto' as const,
	color: 0xffffff,
	bgcolor: 0x111827,
	show_topbar: false,
}

export function BuildPresetDefinitions(catalog: CameraCatalogEntry[]): {
	structure: CompanionPresetSection<ModuleSchema>[]
	presets: CompanionPresetDefinitions<ModuleSchema>
} {
	const presets: CompanionPresetDefinitions<ModuleSchema> = {
		show_grid: {
			type: 'simple',
			name: 'Show Grid',
			style: { ...baseStyle, text: 'Show\nGrid' },
			steps: [{ down: [{ actionId: 'show_grid', options: {} }], up: [] }],
			feedbacks: [
				{
					feedbackId: 'grid_visible',
					options: {},
					style: { bgcolor: 0x1f8a4c, color: 0xffffff },
				},
			],
		},
		toggle_expansion: {
			type: 'simple',
			name: 'Toggle Expansion Mode',
			style: { ...baseStyle, text: 'Expansion\nMode' },
			steps: [{ down: [{ actionId: 'toggle_expansion', options: {} }], up: [] }],
			feedbacks: [
				{
					feedbackId: 'expansion_enabled',
					options: {},
					style: { bgcolor: 0x1f8a4c, color: 0xffffff },
				},
			],
		},
	}

	for (const camera of catalog) {
		presets[`focus_camera_${camera.cameraNumber}`] = {
			type: 'simple',
			name: `Focus Camera ${camera.cameraNumber}`,
			style: {
				...baseStyle,
				text: `Camera ${camera.cameraNumber}${camera.title ? `\n${camera.title}` : ''}`,
			},
			steps: [
				{
					down: [
						{
							actionId: 'focus_camera',
							options: { cameraNumber: camera.cameraNumber },
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'camera_focused',
					options: { cameraNumber: camera.cameraNumber },
					style: { bgcolor: 0x1f8a4c, color: 0xffffff },
				},
			],
		}
	}

	return {
		structure: [
			{
				id: 'ditbrowse_controls',
				name: 'DIT Browse Controls',
				definitions: ['show_grid', 'toggle_expansion'],
			},
			{
				id: 'ditbrowse_cameras',
				name: 'DIT Browse Cameras',
				definitions: catalog.map((camera) => `focus_camera_${camera.cameraNumber}`),
			},
		],
		presets,
	}
}

export function UpdatePresets(self: ModuleInstance): void {
	const { structure, presets } = BuildPresetDefinitions(self.connection.currentState.catalog)
	self.setPresetDefinitions(structure, presets)
}
