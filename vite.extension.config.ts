import { fileURLToPath } from 'node:url'
import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'
import { extensionMetadata } from './scripts/extension-metadata'

export default defineConfig({
    publicDir: 'extension',
    plugins: [
        preact({ devToolsEnabled: false, devtoolsInProd: false }),
        extensionMetadata(),
    ],
    resolve: {
        alias: {
            'vite-plugin-monkey/dist/client': fileURLToPath(new URL('./src/extension/client.ts', import.meta.url)),
        },
    },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
        outDir: 'extension-dist',
        target: 'chrome120',
        minify: false,
        cssMinify: false,
        lib: {
            entry: 'src/extension/entry.ts',
            name: 'ChatGPTExporter',
            formats: ['iife'],
            fileName: () => 'exporter.js',
            cssFileName: 'exporter',
        },
    },
})
