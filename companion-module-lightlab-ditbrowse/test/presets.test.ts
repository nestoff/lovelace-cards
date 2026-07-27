import { describe, expect, it } from 'vitest'
import { BuildPresetDefinitions } from '../src/presets.js'

describe('presets', () => {
	it('builds grid, expansion, and integer camera presets', () => {
		const { presets, structure } = BuildPresetDefinitions([
			{ cameraNumber: 1, title: 'A', url: 'http://camera-1' },
			{ cameraNumber: 12, title: 'L', url: 'http://camera-12' },
		])

		expect(Object.keys(presets)).toEqual(['show_grid', 'toggle_expansion', 'focus_camera_1', 'focus_camera_12'])
		expect(presets.focus_camera_12).toMatchObject({
			style: { text: 'Camera 12\nL' },
			steps: [
				{
					down: [{ actionId: 'focus_camera', options: { cameraNumber: 12 } }],
				},
			],
			feedbacks: [{ feedbackId: 'camera_focused', options: { cameraNumber: 12 } }],
		})
		expect(structure[1].definitions).toEqual(['focus_camera_1', 'focus_camera_12'])
	})
})
