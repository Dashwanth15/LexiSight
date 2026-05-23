// Copies canonical 3D assets from /models into /public/models for Vite static serving.
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const copies = [
  ['models/hight_quality_realistic_man_character.glb', 'public/models/hight_quality_realistic_man_character.glb'],
]

for (const [fromRel, toRel] of copies) {
  const from = join(root, fromRel)
  const to = join(root, toRel)
  if (!existsSync(from)) {
    console.error(`[sync-models] Missing source: ${fromRel}`)
    process.exit(1)
  }
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to)
  console.log(`[sync-models] ${fromRel} -> ${toRel}`)
}
