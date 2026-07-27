import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

export default generateEslintConfig({
	enableTypescript: true,
	ignores: ['.pnp.*', '.yarn/**', 'node_modules/**'],
	commonRules: {
		'n/no-unpublished-import': 'off',
	},
	typescriptRules: {
		'@typescript-eslint/unbound-method': 'off',
	},
})
