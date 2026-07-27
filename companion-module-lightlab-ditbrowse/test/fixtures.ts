import type { DitBrowseStatus } from '../src/protocol.js'

export const statusFixture: DitBrowseStatus = {
	expansionEnabled: true,
	focusMode: false,
	selectedCameraNumber: 1,
	selectedTileId: 'tile-41',
	selectedIndex: 1,
	tabs: [
		{
			index: 1,
			tileId: 'tile-41',
			cameraId: 'camera-41',
			cameraNumber: 1,
			title: 'A',
			url: 'http://192.168.1.1',
		},
		{
			index: 2,
			tileId: 'tile-42',
			cameraId: 'camera-42',
			cameraNumber: 2,
			title: 'B',
			url: 'http://192.168.1.2',
		},
	],
}
