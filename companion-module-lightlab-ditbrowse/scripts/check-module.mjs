import fs from 'node:fs/promises'
import { validateManifest } from '@companion-module/base/manifest'

const manifestPath = new URL('../companion/manifest.json', import.meta.url)
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))

validateManifest(manifest, false)
console.log('DIT Browse Companion manifest is valid.')
