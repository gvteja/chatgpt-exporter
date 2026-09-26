/**
 * The synchronous GM subset used by the reviewed upstream bundle.
 * Settings belong to the ChatGPT origin, NOT chrome.storage. The page can read
 * them, and clearing site data removes them. No credentials are stored here.
 * Values must be JSON-serializable. Upstream currently passes JSON strings.
 */
export function createGMStorage(page, prefix = 'chatgpt-exporter-extension:v1:') {
    const memory = new Map() // Serialized values; avoids sharing mutable objects.
    const dirty = new Set() // Failed writes/deletes take priority over stale disk data.
    let warned = false

    function storageKey(key) {
        if (typeof key !== 'string' || !key || key.length > 512) {
            throw new TypeError('GM storage keys must be nonempty strings of at most 512 characters.')
        }
        return prefix + key
    }

    function warn(error) {
        if (warned) return
        warned = true
        page.console?.warn(
            '[Exporter extension] Site storage is unavailable or invalid. Some settings may not survive a reload.',
            error?.name || 'StorageError',
        )
    }

    function decode(raw, defaultValue) {
        if (raw === null || raw === undefined) return defaultValue
        try {
            const parsed = JSON.parse(raw)
            return parsed && Object.prototype.hasOwnProperty.call(parsed, 'value')
                ? parsed.value
                : defaultValue
        }
        catch (error) {
            warn(error)
            return defaultValue
        }
    }

    function GM_getValue(key, defaultValue) {
        const fullKey = storageKey(key)
        if (dirty.has(fullKey)) return decode(memory.get(fullKey), defaultValue)
        try {
            const raw = page.localStorage.getItem(fullKey)
            if (raw === null) memory.delete(fullKey)
            else memory.set(fullKey, raw)
            return decode(raw, defaultValue)
        }
        catch (error) {
            warn(error)
            return decode(memory.get(fullKey), defaultValue)
        }
    }

    function GM_setValue(key, value) {
        const fullKey = storageKey(key)
        if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
            throw new TypeError('GM_setValue requires a JSON-serializable value.')
        }
        // Serialization errors must not silently overwrite a saved preference.
        const raw = JSON.stringify({ value })
        memory.set(fullKey, raw)
        try {
            page.localStorage.setItem(fullKey, raw)
            dirty.delete(fullKey)
        }
        catch (error) {
            dirty.add(fullKey)
            warn(error)
        }
    }

    function GM_deleteValue(key) {
        const fullKey = storageKey(key)
        memory.delete(fullKey)
        try {
            page.localStorage.removeItem(fullKey)
            dirty.delete(fullKey)
        }
        catch (error) {
            dirty.add(fullKey) // Tombstone: do not return an older persistent value.
            warn(error)
        }
    }

    return Object.freeze({ GM_getValue, GM_setValue, GM_deleteValue })
}
