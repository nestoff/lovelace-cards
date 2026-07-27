import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetActionDefinitions, type ActionsSchema } from './actions.js'
import { GetConfigFields, normalizeConfig, type ModuleConfig } from './config.js'
import { DitBrowseConnection, type ConnectionPhase } from './connection.js'
import { UpdateFeedbacks, type FeedbacksSchema } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import type { DitBrowseCommand, DitBrowseStatus } from './protocol.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateVariableDefinitions, UpdateVariableValues, type VariablesSchema } from './variables.js'

export type ModuleSchema = {
	config: ModuleConfig
	secrets: undefined
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: VariablesSchema
}

export { UpgradeScripts }

export default class ModuleInstance extends InstanceBase<ModuleSchema> {
	config: ModuleConfig = normalizeConfig({})
	readonly connection: DitBrowseConnection
	lastError = ''
	private debugEnabled = false

	constructor(internal: unknown) {
		super(internal)
		this.connection = new DitBrowseConnection(
			{
				onPhase: (phase, message) => this.handlePhase(phase, message),
				onStatus: (_status, catalogChanged) => this.handleStatus(catalogChanged),
				onError: (message) => this.recordError(message),
				debug: (message) => {
					if (this.debugEnabled) this.log('debug', message)
				},
			},
			{ version: '0.1.0' },
		)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = normalizeConfig(config)
		this.debugEnabled = this.config.debug
		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
		this.updateVariableDefinitions()
		this.connection.start(this.config.port)
	}

	async destroy(): Promise<void> {
		await this.connection.stop()
		this.log('debug', 'DIT Browse module destroyed')
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		const previousPort = this.config.port
		this.config = normalizeConfig(config)
		this.debugEnabled = this.config.debug
		if (this.config.port !== previousPort) {
			this.connection.reconfigure(this.config.port)
		}
		UpdateVariableValues(this)
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	async executeCommand(command: DitBrowseCommand): Promise<DitBrowseStatus> {
		try {
			const status = await this.connection.sendCommand(command)
			this.lastError = ''
			UpdateVariableValues(this)
			return status
		} catch (error) {
			const message = error instanceof Error ? error.message : 'DIT Browse command failed'
			this.recordError(message)
			throw error
		}
	}

	updateActions(): void {
		this.setActionDefinitions(GetActionDefinitions(this))
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	private handlePhase(phase: ConnectionPhase, message?: string): void {
		const statuses: Record<ConnectionPhase, InstanceStatus> = {
			disconnected: InstanceStatus.Disconnected,
			connecting: InstanceStatus.Connecting,
			handshaking: InstanceStatus.Connecting,
			connected: InstanceStatus.Ok,
		}
		if (phase === 'connected') this.lastError = ''
		this.updateStatus(statuses[phase], message)
		UpdateVariableValues(this)
		this.checkAllFeedbacks()
	}

	private handleStatus(catalogChanged: boolean): void {
		UpdateVariableValues(this)
		this.checkFeedbacks('expansion_enabled', 'grid_visible', 'camera_focused', 'camera_selected')
		if (catalogChanged) this.updatePresets()
	}

	private recordError(message: string): void {
		this.lastError = message
		this.log('warn', message)
		UpdateVariableValues(this)
	}
}
