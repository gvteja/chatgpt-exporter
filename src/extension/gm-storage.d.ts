export function createGMStorage(page: { localStorage: Storage, console?: Pick<Console, 'warn'> }, prefix?: string): {
    GM_getValue: (key: string, defaultValue?: unknown) => unknown
    GM_setValue: (key: string, value: unknown) => void
    GM_deleteValue: (key: string) => void
}
