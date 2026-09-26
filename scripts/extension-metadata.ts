import { execFileSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'

export function extensionMetadata(): Plugin {
    return {
        name: 'extension-metadata',
        async generateBundle() {
            const root = process.cwd()
            const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
            const manifest = JSON.parse(await readFile(path.join(root, 'extension/manifest.json'), 'utf8'))
            const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
            this.emitFile({
                type: 'asset',
                fileName: 'BUILD-INFO.json',
                source: JSON.stringify({
                    extensionVersion: manifest.version,
                    exporterVersion: pkg.version,
                    sourceCommit: git('rev-parse', 'HEAD'),
                    sourceDirty: git('status', '--porcelain').length > 0,
                    settingsStorage: 'Namespaced localStorage on the ChatGPT origin (page-readable).',
                }, null, 2),
            })
            this.emitFile({ type: 'asset', fileName: 'licenses/Exporter-LICENSE', source: await readFile(path.join(root, 'LICENSE'), 'utf8') })

            // Include notices for the packages actually present in the bundle.
            const packages = new Map<string, { name: string, version: string, license?: unknown }>()
            const visited = new Set<string>()
            for (const id of this.getModuleIds()) {
                if (!id.includes('/node_modules/') || id.startsWith('\0')) continue
                let directory = path.dirname(id.split('?')[0])
                while (directory.includes('/node_modules/') && !visited.has(directory)) {
                    visited.add(directory)
                    try {
                        const info = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
                        if (info.name && info.version) {
                            packages.set(directory, info)
                            break
                        }
                    }
                    catch { /* A source subdirectory may have no package metadata. */ }
                    directory = path.dirname(directory)
                }
            }
            const notices = []
            for (const [directory, info] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
                const prefix = `licenses/${info.name.replaceAll('/', '_')}-${info.version}`
                const files = []
                for (const entry of await readdir(directory, { withFileTypes: true })) {
                    if (!entry.isFile() || !/^(?:licen[sc]e|copying|notice|copyright)(?:[.-]|$)/i.test(entry.name)) continue
                    const fileName = `${prefix}/${entry.name}`
                    this.emitFile({ type: 'asset', fileName, source: await readFile(path.join(directory, entry.name), 'utf8') })
                    files.push(fileName)
                }
                notices.push({ name: info.name, version: info.version, license: info.license, files })
            }
            this.emitFile({ type: 'asset', fileName: 'licenses/DEPENDENCIES.json', source: JSON.stringify(notices, null, 2) })
        },
    }
}
