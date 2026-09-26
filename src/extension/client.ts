import { createGMStorage } from './gm-storage.js'

// This module replaces the userscript client only in the Chrome build.
// MAIN-world execution keeps access to the page's fetch and router state.
export const unsafeWindow = window
const storage = createGMStorage(window)

export function GM_getValue<T>(key: string, defaultValue?: T): T {
    return storage.GM_getValue(key, defaultValue) as T
}
export const GM_setValue = storage.GM_setValue
export const GM_deleteValue = storage.GM_deleteValue
