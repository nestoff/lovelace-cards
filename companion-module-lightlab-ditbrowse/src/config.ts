import type { SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	[key: string]: number | boolean
	port: number
	debug: boolean
}

export const DEFAULT_CONFIG: ModuleConfig = {
	port: 52780,
	debug: false,
}

export function normalizeConfig(config: Partial<ModuleConfig>): ModuleConfig {
	return {
		port:
			typeof config.port === 'number' && Number.isSafeInteger(config.port) && config.port >= 1 && config.port <= 65535
				? config.port
				: DEFAULT_CONFIG.port,
		debug: config.debug === true,
	}
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'number',
			id: 'port',
			label: 'DIT Browse port',
			width: 6,
			min: 1,
			max: 65535,
			default: DEFAULT_CONFIG.port,
			step: 1,
			asInteger: true,
		},
		{
			type: 'checkbox',
			id: 'debug',
			label: 'Debug logging',
			width: 6,
			default: DEFAULT_CONFIG.debug,
		},
	]
}
