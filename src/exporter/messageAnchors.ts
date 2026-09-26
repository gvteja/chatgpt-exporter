/** Stable, attribute-safe fragments; positions are only a last fallback. */
export function createMessageAnchor(messageId: unknown, nodeId: unknown, index: number, used: Set<string>) {
    const raw = [messageId, nodeId].find((value): value is string => typeof value === 'string' && value.length > 0)
    const base = `msg-${raw
        ? raw.replace(/[^A-Za-z0-9-]/gu, char => `_${char.codePointAt(0)!.toString(16)}_`)
        : `fallback-${index + 1}`}`
    let anchor = base
    let duplicate = 1
    while (used.has(anchor)) anchor = `${base}.${++duplicate}`
    used.add(anchor)
    return anchor
}
