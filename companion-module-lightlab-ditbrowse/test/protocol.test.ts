import { describe, expect, it } from 'vitest'
import { ProtocolValidationError, createClientHello, parseServerMessage } from '../src/protocol.js'
import { statusFixture } from './fixtures.js'

describe('protocol', () => {
	it('creates the versioned client hello', () => {
		expect(createClientHello('0.1.0')).toEqual({
			type: 'hello',
			protocol: 'ditbrowse.control',
			protocolVersion: 1,
			client: { name: 'companion-module-lightlab-ditbrowse', version: '0.1.0' },
		})
	})

	it('parses a complete status event', () => {
		expect(
			parseServerMessage({
				type: 'event',
				event: 'status',
				revision: 4,
				status: statusFixture,
			}),
		).toEqual({ type: 'event', event: 'status', revision: 4, status: statusFixture })
	})

	it('rejects string camera numbers and unsupported protocol versions', () => {
		expect(() =>
			parseServerMessage({
				type: 'event',
				event: 'status',
				revision: 4,
				status: { ...statusFixture, selectedCameraNumber: '1' },
			}),
		).toThrow(ProtocolValidationError)

		expect(() =>
			parseServerMessage({
				type: 'hello',
				protocol: 'ditbrowse.control',
				protocolVersion: 2,
				server: { name: 'DIT Browse', version: '0.1.0' },
				capabilities: [],
			}),
		).toThrow(/Unsupported/)
	})

	it('parses nested command errors', () => {
		expect(
			parseServerMessage({
				type: 'result',
				requestId: 'request-1',
				ok: false,
				error: { code: 'not_found', message: 'No camera number matches 25' },
			}),
		).toEqual({
			type: 'result',
			requestId: 'request-1',
			ok: false,
			error: { code: 'not_found', message: 'No camera number matches 25' },
		})
	})
})
