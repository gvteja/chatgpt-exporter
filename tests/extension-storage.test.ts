import assert from 'node:assert/strict'
import { it as test } from 'vitest'
import { createGMStorage } from '../src/extension/gm-storage.js'

function fakePage() {
    const disk = new Map()
    const failures = { read: false, write: false, remove: false }
    let warningCount = 0
    const page = {
        console: { warn() { warningCount++ }, info() {}, error() {} },
        localStorage: {
            getItem(key) {
                if (failures.read) throw new Error('Read denied')
                return disk.get(key) ?? null
            },
            setItem(key, value) {
                if (failures.write) throw new Error('Quota exceeded')
                disk.set(key, value)
            },
            removeItem(key) {
                if (failures.remove) throw new Error('Remove denied')
                disk.delete(key)
            },
        },
    }
    return { page, disk, failures, warnings: () => warningCount }
}

test('storage: missing values return the exact supplied default', () => {
    const { page } = fakePage()
    const api = createGMStorage(page)
    const fallback = {}
    assert.equal(api.GM_getValue('missing', fallback), fallback)
    assert.equal(api.GM_getValue('missing'), undefined)
})

test('storage: falsy values and structured values round-trip', () => {
    const { page } = fakePage()
    const api = createGMStorage(page)
    for (const value of [false, 0, '', null, '"upstream-json"', [1, 2], { a: 1 }]) {
        api.GM_setValue('key', value)
        assert.deepEqual(api.GM_getValue('key', 'default'), value)
    }
})

test('storage: upstream double-serialized strings keep their meaning', () => {
    const { page } = fakePage()
    const api = createGMStorage(page)
    const settings = { export_format: 'Markdown', enabled: true }
    api.GM_setValue('exporter:settings', JSON.stringify(settings))
    assert.deepEqual(JSON.parse(api.GM_getValue('exporter:settings', '')), settings)
})

test('storage: values survive a new adapter instance', () => {
    const { page } = fakePage()
    createGMStorage(page).GM_setValue('exporter:language', 'en-US')
    assert.equal(createGMStorage(page).GM_getValue('exporter:language'), 'en-US')
})

test('storage: adapter keys cannot collide with ChatGPT keys', () => {
    const { page, disk } = fakePage()
    disk.set('exporter:language', 'DO NOT MODIFY')
    const api = createGMStorage(page)
    api.GM_setValue('exporter:language', 'en-US')
    assert.equal(disk.get('exporter:language'), 'DO NOT MODIFY')
    assert.equal(disk.size, 2)
    api.GM_deleteValue('exporter:language')
    assert.equal(disk.get('exporter:language'), 'DO NOT MODIFY')
})

test('storage: malformed JSON returns the default and reports a warning', () => {
    const { page, disk, warnings } = fakePage()
    disk.set('chatgpt-exporter-extension:v1:key', 'not json')
    assert.equal(createGMStorage(page).GM_getValue('key', 9), 9)
    assert.equal(warnings(), 1)
})

test('storage: failed writes use memory instead of returning stale disk values', () => {
    const { page, failures } = fakePage()
    const api = createGMStorage(page)
    api.GM_setValue('key', 'old')
    failures.write = true
    api.GM_setValue('key', 'new')
    assert.equal(api.GM_getValue('key'), 'new')
})

test('storage: failed deletion does not resurrect a disk value', () => {
    const { page, failures } = fakePage()
    const api = createGMStorage(page)
    api.GM_setValue('key', 'old')
    failures.remove = true
    api.GM_deleteValue('key')
    assert.equal(api.GM_getValue('key', 'missing'), 'missing')
})

test('storage: denied storage works in memory and warns only once', () => {
    const { page, failures, warnings } = fakePage()
    failures.read = failures.write = failures.remove = true
    const api = createGMStorage(page)
    api.GM_setValue('key', false)
    assert.equal(api.GM_getValue('key', true), false)
    api.GM_deleteValue('key')
    assert.equal(api.GM_getValue('key', 'missing'), 'missing')
    assert.equal(warnings(), 1)
})

test('storage: successful writes recover from an earlier quota failure', () => {
    const { page, failures } = fakePage()
    const api = createGMStorage(page)
    failures.write = true
    api.GM_setValue('key', 1)
    failures.write = false
    api.GM_setValue('key', 2)
    assert.equal(createGMStorage(page).GM_getValue('key'), 2)
})

test('storage: successful reads see writes and removals from another tab', () => {
    const { page } = fakePage()
    const a = createGMStorage(page)
    const b = createGMStorage(page)
    a.GM_setValue('key', 1)
    b.GM_setValue('key', 2)
    assert.equal(a.GM_getValue('key'), 2)
    b.GM_deleteValue('key')
    assert.equal(a.GM_getValue('key', 0), 0)
})

test('storage: mutation of returned objects does not mutate stored settings', () => {
    const { page } = fakePage()
    const api = createGMStorage(page)
    api.GM_setValue('key', { a: 1 })
    api.GM_getValue('key').a = 100
    assert.deepEqual(api.GM_getValue('key'), { a: 1 })
})

test('storage: invalid keys and unserializable values fail explicitly', () => {
    const { page } = fakePage()
    const api = createGMStorage(page)
    for (const key of ['', null, {}, 'x'.repeat(513)]) assert.throws(() => api.GM_getValue(key), TypeError)
    for (const value of [undefined, () => {}, Symbol('x'), 1n]) assert.throws(() => api.GM_setValue('key', value), TypeError)
    const cycle = {}
    cycle.self = cycle
    assert.throws(() => api.GM_setValue('key', cycle), TypeError)
})
