import { describe, expect, it } from 'vitest'
import { EMPTY_CONNECTION_STATE, applyStatus, cameraCatalog, selectedCamera } from '../src/state.js'
import { statusFixture } from './fixtures.js'

describe('state', () => {
	it('builds a unique integer camera catalog in tab order', () => {
		const duplicate = {
			...statusFixture,
			tabs: [...statusFixture.tabs, { ...statusFixture.tabs[0], index: 3, title: 'Duplicate' }],
		}

		expect(cameraCatalog(duplicate)).toEqual([
			{ cameraNumber: 1, title: 'A', url: 'http://192.168.1.1' },
			{ cameraNumber: 2, title: 'B', url: 'http://192.168.1.2' },
		])
	})

	it('ignores stale status revisions', () => {
		const first = applyStatus(EMPTY_CONNECTION_STATE, statusFixture, 5)
		const stale = applyStatus(first.state, { ...statusFixture, focusMode: true }, 4)

		expect(stale.accepted).toBe(false)
		expect(stale.state.status?.focusMode).toBe(false)
	})

	it('reports catalog changes separately from selection changes', () => {
		const first = applyStatus(EMPTY_CONNECTION_STATE, statusFixture, 1)
		const selectionOnly = applyStatus(first.state, { ...statusFixture, selectedCameraNumber: 2, selectedIndex: 2 }, 2)

		expect(first.catalogChanged).toBe(true)
		expect(selectionOnly.catalogChanged).toBe(false)
		expect(selectedCamera(selectionOnly.state.status)).toMatchObject({ cameraNumber: 2, title: 'B' })
	})
})
