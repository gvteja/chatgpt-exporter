// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('vite-plugin-monkey/dist/client', () => ({ unsafeWindow: {} }))
vi.mock('../src/i18n', () => ({ default: { t: (key: string) => key } }))
const captured = vi.hoisted(() => ({ id: null as string | null }))
vi.mock('../src/temporaryChat', () => ({ getTemporaryChatId: () => captured.id }))
const { getCurrentChatId } = await import('../src/api')
const id = '550e8400-e29b-41d4-a716-446655440000'

afterEach(() => {
    captured.id = null
    vi.unstubAllGlobals()
})

it.each(['/', '/settings', `/c/${id}junk`, `/share/${id}/continue`])('never falls back to another chat on %s', async (path) => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('location', new URL(path, 'https://chatgpt.com'))
    await expect(getCurrentChatId()).rejects.toThrow('No chat id found')
    expect(fetch).not.toHaveBeenCalled()
})

it.each([`/c/${id}`, `/g/g-project/c/${id}`])('uses the current saved chat on %s', async (path) => {
    vi.stubGlobal('location', new URL(path, 'https://chatgpt.com'))
    await expect(getCurrentChatId()).resolves.toBe(id)
})

it('retains the shared API route', async () => {
    vi.stubGlobal('location', new URL(`/share/e/${id}`, 'https://chatgpt.com'))
    await expect(getCurrentChatId()).resolves.toBe(`__share__${id}`)
})

it('requires capture for a temporary chat even if a saved ID is in the URL', async () => {
    vi.stubGlobal('location', new URL(`/c/${id}?temporary-chat=true`, 'https://chatgpt.com'))
    await expect(getCurrentChatId()).rejects.toThrow('No temporary chat id')
    captured.id = 'captured-id'
    await expect(getCurrentChatId()).resolves.toBe('captured-id')
})
