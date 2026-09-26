import { startExporter } from '../main'

interface ExtensionState {
    status: 'starting' | 'loaded' | 'error'
    startedAt: number
    error?: string
}

const page = window as Window & { __CHATGPT_EXPORTER_EXTENSION_V1__?: ExtensionState }
if (!page.__CHATGPT_EXPORTER_EXTENSION_V1__) {
    const state: ExtensionState = { status: 'starting', startedAt: Date.now() }
    page.__CHATGPT_EXPORTER_EXTENSION_V1__ = state
    try {
        startExporter()
        state.status = 'loaded'
    }
    catch (error) {
        state.status = 'error'
        state.error = String(error)
        console.error('[Exporter extension] Startup failed:', error)
    }
}
