import { describe, expect, it } from 'vitest'
import { createMessageAnchor } from '../src/exporter/messageAnchors'

describe('message anchors', () => {
    it('keeps message identity across reordering and falls back to node identity', () => {
        expect(createMessageAnchor('message-1', 'node-1', 0, new Set())).toBe('msg-message-1')
        expect(createMessageAnchor('message-1', 'node-1', 42, new Set())).toBe('msg-message-1')
        expect(createMessageAnchor('', 'node-1', 42, new Set())).toBe('msg-node-1')
        expect(createMessageAnchor(null, null, 2, new Set())).toBe('msg-fallback-3')
    })

    it('encodes unsafe characters without collisions with literal encoded values', () => {
        const used = new Set<string>()
        const unsafe = createMessageAnchor('"<a>#', null, 0, used)
        expect(unsafe).toMatch(/^msg-[A-Za-z0-9_-]+$/)
        expect(createMessageAnchor('_22_', null, 0, used)).not.toBe(createMessageAnchor('"', null, 0, used))
    })

    it('makes duplicate and fallback identities unique', () => {
        const used = new Set<string>()
        expect(createMessageAnchor('fallback-1', null, 0, used)).toBe('msg-fallback-1')
        expect(createMessageAnchor(null, null, 0, used)).toBe('msg-fallback-1.2')
        expect(createMessageAnchor('fallback-1', null, 0, used)).toBe('msg-fallback-1.3')
    })
})
