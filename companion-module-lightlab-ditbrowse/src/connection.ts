import WebSocket, { type RawData } from 'ws'
import {
	CONTROL_WEBSOCKET_PATH,
	ProtocolValidationError,
	createClientHello,
	createCommandMessage,
	parseServerMessage,
	type DitBrowseCommand,
	type DitBrowseStatus,
	type ResultMessage,
} from './protocol.js'
import { EMPTY_CONNECTION_STATE, applyStatus, type ConnectionState } from './state.js'

export type ConnectionPhase = 'disconnected' | 'connecting' | 'handshaking' | 'connected'

export interface ConnectionCallbacks {
	onPhase: (phase: ConnectionPhase, message?: string) => void
	onStatus: (status: DitBrowseStatus, catalogChanged: boolean) => void
	onError: (message: string) => void
	debug: (message: string) => void
}

export interface ConnectionOptions {
	version: string
	reconnectDelaysMs?: number[]
	requestTimeoutMs?: number
}

interface PendingRequest {
	resolve: (status: DitBrowseStatus) => void
	reject: (error: Error) => void
	timeout: ReturnType<typeof setTimeout>
}

const DEFAULT_RECONNECT_DELAYS = [1_000, 2_000, 5_000, 10_000]

function rawDataText(data: RawData): string {
	if (Array.isArray(data)) return Buffer.concat(data).toString('utf8')
	if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8')
	return data.toString('utf8')
}

export class DitBrowseConnection {
	private readonly callbacks: ConnectionCallbacks
	private readonly version: string
	private readonly reconnectDelaysMs: number[]
	private readonly requestTimeoutMs: number
	private socket: WebSocket | null = null
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null
	private pending = new Map<string, PendingRequest>()
	private stopped = true
	private generation = 0
	private reconnectAttempt = 0
	private requestCounter = 0
	private port = 52780
	private phase: ConnectionPhase = 'disconnected'
	private state: ConnectionState = EMPTY_CONNECTION_STATE
	private serverVersion = ''

	constructor(callbacks: ConnectionCallbacks, options: ConnectionOptions) {
		this.callbacks = callbacks
		this.version = options.version
		this.reconnectDelaysMs = options.reconnectDelaysMs ?? DEFAULT_RECONNECT_DELAYS
		this.requestTimeoutMs = options.requestTimeoutMs ?? 3_500
	}

	get currentPhase(): ConnectionPhase {
		return this.phase
	}

	get currentState(): ConnectionState {
		return this.state
	}

	get appVersion(): string {
		return this.serverVersion
	}

	start(port: number): void {
		this.port = port
		this.stopped = false
		this.restartConnection()
	}

	reconfigure(port: number): void {
		if (!this.stopped && this.port === port) {
			return
		}
		this.port = port
		this.stopped = false
		this.restartConnection()
	}

	async stop(): Promise<void> {
		this.stopped = true
		this.generation += 1
		this.clearReconnectTimer()
		this.rejectPending(new Error('DIT Browse connection stopped'))
		this.disconnectSocket()
		this.state = EMPTY_CONNECTION_STATE
		this.serverVersion = ''
		this.setPhase('disconnected')
	}

	async sendCommand(command: DitBrowseCommand): Promise<DitBrowseStatus> {
		const socket = this.socket
		if (this.phase !== 'connected' || !socket || socket.readyState !== WebSocket.OPEN) {
			throw new Error('DIT Browse is not connected')
		}

		const requestId = `${Date.now().toString(36)}-${++this.requestCounter}`
		const promise = new Promise<DitBrowseStatus>((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pending.delete(requestId)
				reject(new Error('DIT Browse command timed out'))
			}, this.requestTimeoutMs)
			timeout.unref?.()
			this.pending.set(requestId, { resolve, reject, timeout })
		})

		this.callbacks.debug(`Sending ${command.type} (${requestId})`)
		socket.send(JSON.stringify(createCommandMessage(requestId, command)))
		return promise
	}

	async refreshStatus(): Promise<DitBrowseStatus> {
		return this.sendCommand({ type: 'status' })
	}

	private restartConnection(): void {
		this.generation += 1
		this.reconnectAttempt = 0
		this.clearReconnectTimer()
		this.rejectPending(new Error('DIT Browse connection reconfigured'))
		this.disconnectSocket()
		this.state = EMPTY_CONNECTION_STATE
		this.serverVersion = ''
		this.connect(this.generation)
	}

	private connect(generation: number): void {
		if (this.stopped || generation !== this.generation) {
			return
		}

		this.setPhase('connecting')
		const url = `ws://127.0.0.1:${this.port}${CONTROL_WEBSOCKET_PATH}`
		this.callbacks.debug(`Connecting to ${url}`)
		const socket = new WebSocket(url)
		this.socket = socket

		socket.on('open', () => {
			if (generation !== this.generation) return
			this.setPhase('handshaking')
			socket.send(JSON.stringify(createClientHello(this.version)))
		})

		socket.on('message', (data) => {
			if (generation !== this.generation) return
			try {
				this.handleMessage(JSON.parse(rawDataText(data)) as unknown)
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Invalid DIT Browse message'
				this.callbacks.onError(message)
				if (error instanceof ProtocolValidationError) {
					socket.close(1002, 'Protocol error')
				}
			}
		})

		socket.on('error', (error) => {
			if (generation !== this.generation) return
			this.callbacks.onError(error.message)
		})

		socket.on('close', () => {
			if (generation !== this.generation) return
			this.socket = null
			this.serverVersion = ''
			this.state = EMPTY_CONNECTION_STATE
			this.rejectPending(new Error('DIT Browse disconnected'))
			this.setPhase('disconnected')
			this.scheduleReconnect(generation)
		})
	}

	private handleMessage(raw: unknown): void {
		const message = parseServerMessage(raw)
		if (message.type === 'hello') {
			if (this.phase !== 'handshaking') {
				throw new ProtocolValidationError('Unexpected DIT Browse hello')
			}
			this.serverVersion = message.server.version
			this.reconnectAttempt = 0
			this.setPhase('connected')
			void this.refreshStatus().catch((error: unknown) => {
				this.callbacks.onError(error instanceof Error ? error.message : 'Could not refresh DIT Browse status')
			})
			return
		}

		if (message.type === 'event') {
			this.acceptStatus(message.status, message.revision)
			return
		}

		if (message.type === 'result') {
			this.handleResult(message)
			return
		}

		this.callbacks.onError(message.error.message)
	}

	private handleResult(message: ResultMessage): void {
		const pending = this.pending.get(message.requestId)
		if (!pending) {
			this.callbacks.debug(`Ignoring stale result ${message.requestId}`)
			return
		}

		clearTimeout(pending.timeout)
		this.pending.delete(message.requestId)
		if (!message.ok) {
			pending.reject(new Error(message.error.message))
			return
		}
		if (!message.status) {
			pending.reject(new Error('DIT Browse result did not include status'))
			return
		}

		this.acceptStatus(message.status)
		pending.resolve(message.status)
	}

	private acceptStatus(status: DitBrowseStatus, revision?: number): void {
		const applied = applyStatus(this.state, status, revision)
		if (!applied.accepted) {
			this.callbacks.debug(`Ignoring stale status revision ${revision}`)
			return
		}
		this.state = applied.state
		this.callbacks.onStatus(status, applied.catalogChanged)
	}

	private scheduleReconnect(generation: number): void {
		if (this.stopped || this.reconnectTimer) {
			return
		}

		const index = Math.min(this.reconnectAttempt, this.reconnectDelaysMs.length - 1)
		const delay = this.reconnectDelaysMs[index] ?? 10_000
		this.reconnectAttempt += 1
		this.callbacks.debug(`Reconnecting in ${delay}ms`)
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null
			this.connect(generation)
		}, delay)
		this.reconnectTimer.unref?.()
	}

	private rejectPending(error: Error): void {
		for (const pending of this.pending.values()) {
			clearTimeout(pending.timeout)
			pending.reject(error)
		}
		this.pending.clear()
	}

	private clearReconnectTimer(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
	}

	private disconnectSocket(): void {
		if (!this.socket) return
		this.socket.removeAllListeners()
		this.socket.terminate()
		this.socket = null
	}

	private setPhase(phase: ConnectionPhase, message?: string): void {
		this.phase = phase
		this.callbacks.onPhase(phase, message)
	}
}
