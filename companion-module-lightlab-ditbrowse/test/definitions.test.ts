import { describe, expect, it, vi } from 'vitest'
import { GetActionDefinitions } from '../src/actions.js'
import { GetConfigFields } from '../src/config.js'
import { GetFeedbackDefinitions } from '../src/feedbacks.js'
import type ModuleInstance from '../src/main.js'

function instanceStub(): ModuleInstance {
	return {
		executeCommand: vi.fn(async () => undefined),
		connection: {
			currentPhase: 'connected',
			currentState: {
				status: {
					expansionEnabled: true,
					focusMode: true,
					selectedCameraNumber: 2,
					selectedTileId: 'tile-42',
					selectedIndex: 2,
					tabs: [],
				},
				catalog: [],
				revision: 1,
			},
		},
	} as unknown as ModuleInstance
}

describe('Companion definitions', () => {
	it('exposes only local port and debug configuration', () => {
		const fields = GetConfigFields()
		expect(fields.map((field) => field.id)).toEqual(['port', 'debug'])
		expect(JSON.stringify(fields)).not.toMatch(/host|token|password/i)
	})

	it('uses an integer-only camera action field', async () => {
		const instance = instanceStub()
		const actions = GetActionDefinitions(instance)
		const focus = actions.focus_camera
		if (!focus) throw new Error('Focus Camera action is missing')
		expect(focus.options).toEqual([
			expect.objectContaining({
				id: 'cameraNumber',
				type: 'number',
				min: 1,
				step: 1,
				asInteger: true,
			}),
		])
		await focus.callback(
			{ options: { cameraNumber: 2 } } as Parameters<typeof focus.callback>[0],
			{} as Parameters<typeof focus.callback>[1],
		)
		expect(instance.executeCommand).toHaveBeenCalledWith({ type: 'focusCamera', cameraNumber: 2 })
	})

	it('defines state feedbacks with integer camera fields', async () => {
		const feedbacks = GetFeedbackDefinitions(instanceStub())
		expect(Object.keys(feedbacks)).toEqual([
			'connected',
			'expansion_enabled',
			'grid_visible',
			'camera_focused',
			'camera_selected',
		])
		const cameraFocused = feedbacks.camera_focused
		if (!cameraFocused) throw new Error('Camera Focused feedback is missing')
		expect(cameraFocused.options[0]).toMatchObject({
			type: 'number',
			asInteger: true,
		})
	})
})
