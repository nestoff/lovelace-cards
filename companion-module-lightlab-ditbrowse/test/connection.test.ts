import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebSocketServer, type RawData, type WebSocket } from 'ws'
import { DitBrowseConnection, type ConnectionPhase } from '../src/connection.js'
import { statusFixture } from './fixtures.js'

const servers: WebSocketServer[] = []
const connections: DitBrowseConnection[] = []

function rawDataText(data: RawData): string {
	if (Array.isArray(data)) return Buffer.concat(data).toString('utf8')
	if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8')
	return data.toString('utf8')
}

async function startServer(
	onCommand?: (message: Record<string, unknown>, socket: WebSocket) => void,
): Promise<{ server: WebSocketServer; port: number; commands: Record<string, unknown>[] }> {
	const commands: Record<string, unknown>[] = []
	const server = new WebSocketServer({ host: '127.0.0.1', port: 0, path: '/api/ws' })
	servers.push(server)
	await new Promise<void>((resolve) => server.once('listening', () => resolve()))
	server.on('connection', (socket) => {
		socket.on('message', (data) => {
			const message = JSON.parse(rawDataText(data)) as Record<string, unknown>
			if (message.type === 'hello') {
				socket.send(
					JSON.stringify({
						type: 'hello',
						protocol: 'ditbrowse.control',
						protocolVersion: 1,
						server: { name: 'DIT Browse', version: '0.1.0' },
						capabilities: ['status', 'focusCamera', 'showGrid', 'toggleExpansion', 'statusEvents'],
					}),
				)
				return
			}
			commands.push(message)
			if (onCommand) {
				onCommand(message, socket)
				return
			}
			const command = message.command as Record<string, unknown>
			const status =
				command.type === 'focusCamera'
					? { ...statusFixture, focusMode: true, selectedCameraNumber: command.cameraNumber }
					: statusFixture
			socket.send(
				JSON.stringify({
					type: 'result',
					requestId: message.requestId,
					ok: true,
					status,
				}),
			)
		})
	})
	const address = server.address()
	if (typeof address === 'string' || address === null) throw new Error('Test server has no port')
	return { server, port: address.port, commands }
}

function createConnection(reconnectDelaysMs = [10]): {
	connection: DitBrowseConnection
	phases: ConnectionPhase[]
	onStatus: ReturnType<typeof vi.fn>
} {
	const phases: ConnectionPhase[] = []
	const onStatus = vi.fn()
	const connection = new DitBrowseConnection(
		{
			onPhase: (phase) => phases.push(phase),
			onStatus,
			onError: vi.fn(),
			debug: vi.fn(),
		},
		{ version: '0.1.0', reconnectDelaysMs, requestTimeoutMs: 500 },
	)
	connections.push(connection)
	return { connection, phases, onStatus }
}

async function waitFor(check: () => boolean, timeoutMs = 1_000): Promise<void> {
	const started = Date.now()
	while (!check()) {
		if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for condition')
		await new Promise((resolve) => setTimeout(resolve, 5))
	}
}

afterEach(async () => {
	await Promise.all(connections.splice(0).map(async (connection) => connection.stop()))
	await Promise.all(
		servers.splice(0).map(
			async (server) =>
				new Promise<void>((resolve) => {
					for (const socket of server.clients) socket.terminate()
					server.close(() => resolve())
				}),
		),
	)
})

describe('DitBrowseConnection', () => {
	it('handshakes, refreshes status, and correlates integer camera commands', async () => {
		const { port, commands } = await startServer()
		const { connection, phases, onStatus } = createConnection()
		connection.start(port)

		await waitFor(() => connection.currentPhase === 'connected' && onStatus.mock.calls.length > 0)
		expect(phases).toEqual(expect.arrayContaining(['connecting', 'handshaking', 'connected']))
		expect(commands[0]).toMatchObject({ command: { type: 'status' } })

		await expect(connection.sendCommand({ type: 'focusCamera', cameraNumber: 2 })).resolves.toMatchObject({
			focusMode: true,
			selectedCameraNumber: 2,
		})
		expect(commands.at(-1)).toMatchObject({ command: { type: 'focusCamera', cameraNumber: 2 } })
	})

	it('rejects pending actions when the socket disconnects', async () => {
		const { server, port } = await startServer((message, socket) => {
			const command = message.command as Record<string, unknown>
			if (command.type === 'status') {
				socket.send(JSON.stringify({ type: 'result', requestId: message.requestId, ok: true, status: statusFixture }))
			}
		})
		const { connection, onStatus } = createConnection([1_000])
		connection.start(port)
		await waitFor(() => onStatus.mock.calls.length > 0)

		const pending = connection.sendCommand({ type: 'showGrid' })
		for (const socket of server.clients) socket.terminate()

		await expect(pending).rejects.toThrow(/disconnected/)
	})

	it('ignores stale events and reconnects without replaying actions', async () => {
		const { server, port, commands } = await startServer()
		const { connection, phases, onStatus } = createConnection([10])
		connection.start(port)
		await waitFor(() => onStatus.mock.calls.length > 0)

		await connection.sendCommand({ type: 'focusCamera', cameraNumber: 2 })
		const socket = [...server.clients][0]
		socket.send(JSON.stringify({ type: 'event', event: 'status', revision: 5, status: statusFixture }))
		socket.send(
			JSON.stringify({
				type: 'event',
				event: 'status',
				revision: 4,
				status: { ...statusFixture, focusMode: true },
			}),
		)
		await waitFor(() => connection.currentState.revision === 5)
		expect(connection.currentState.status?.focusMode).toBe(false)

		socket.terminate()
		await waitFor(() => phases.filter((phase) => phase === 'connected').length >= 2)
		await waitFor(
			() => commands.filter((message) => (message.command as Record<string, unknown>).type === 'status').length >= 2,
		)

		expect(
			commands.filter((message) => (message.command as Record<string, unknown>).type === 'focusCamera'),
		).toHaveLength(1)
	})
})
