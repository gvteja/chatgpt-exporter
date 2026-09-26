import { readFileSync } from 'node:fs'
import { Window } from 'happy-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const script = readFileSync(new URL('../src/exporter/promptNavigation.js', import.meta.url), 'utf8')
const windows: Window[] = []

afterEach(async () => {
    await Promise.all(windows.splice(0).map(page => page.happyDOM.close()))
})

function fixture(total = 3, width = 1280) {
    const page = new Window({
        url: 'file:///exports/chat.html?theme=dark',
        width,
        height: 600,
        settings: { enableJavaScriptEvaluation: true, suppressInsecureJavaScriptEnvironmentWarning: true },
    })
    windows.push(page)
    const document = page.document
    document.body.innerHTML = `<div class="conversation">${Array.from({ length: total }, (_, i) => `
        <div class="conversation-item" id="msg-user-${i}" tabindex="-1" data-ce-prompt><div class="conversation-content">Question ${i + 1} &lt;b&gt;plain text&lt;/b&gt;</div></div>
        <div class="conversation-item" id="msg-assistant-${i}"><div class="conversation-content">Answer</div></div>
    `).join('')}</div>`
    let scrollY = 0
    Object.defineProperty(page, 'scrollY', { get: () => scrollY })
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 2000 })
    Object.defineProperty(document.documentElement, 'clientWidth', { value: width })
    const rect = (top: number) => ({ top, bottom: top + 80, left: 100, right: 800, width: 700, height: 80 })
    document.querySelector('.conversation')!.getBoundingClientRect = () => rect(0) as DOMRect
    document.querySelectorAll('[data-ce-prompt]').forEach((prompt, i) => {
        prompt.getBoundingClientRect = () => rect(200 + i * 500 - scrollY) as DOMRect
    })
    const scroll = vi.fn()
    page.scrollTo = scroll
    const frames: FrameRequestCallback[] = []
    page.requestAnimationFrame = (callback) => {
        frames.push(callback)
        return frames.length
    }
    page.eval(script)
    return {
        page,
        document,
        scroll,
        next: () => (document.querySelector('button[aria-label^="Next"]') as HTMLButtonElement).click(),
        previous: () => (document.querySelector('button[aria-label^="Previous"]') as HTMLButtonElement).click(),
        count: () => document.querySelector('output')?.textContent,
        scrollTo: (y: number) => {
            scrollY = y
            page.dispatchEvent(new page.Event('scroll'))
            frames.splice(0).forEach(callback => callback(0))
        },
    }
}

describe('exported HTML prompt navigation', () => {
    it('creates one marker per user prompt and uses plain text previews', () => {
        const { document, count } = fixture()
        expect(count()).toBe('1 / 3')
        const links = document.querySelectorAll('.ce-prompt-nav-marker')
        expect(links).toHaveLength(3)
        expect(links[0].getAttribute('aria-label')).toContain('<b>plain text</b>')
        expect(links[0].querySelector('b')).toBeNull()
        expect(links[0].getAttribute('aria-current')).toBe('step')
    })

    it('navigates forward and backward, preserves query parameters, and stops at bounds', () => {
        const f = fixture()
        f.previous()
        expect(f.scroll).not.toHaveBeenCalled()
        f.next()
        expect(f.count()).toBe('2 / 3')
        expect(f.page.location.hash).toBe('#msg-user-1')
        expect(f.page.location.search).toBe('?theme=dark')
        expect(f.scroll).toHaveBeenLastCalledWith({ top: 676, behavior: 'smooth' })
        f.next()
        f.next()
        expect(f.count()).toBe('3 / 3')
        expect(f.scroll).toHaveBeenCalledTimes(2)
        f.previous()
        expect(f.count()).toBe('2 / 3')
    })

    it('jumps directly with a marker and updates keyboard focus', () => {
        const f = fixture()
        ;(f.document.querySelectorAll('.ce-prompt-nav-marker')[2] as HTMLAnchorElement).click()
        expect(f.count()).toBe('3 / 3')
        expect(f.document.activeElement?.id).toBe('msg-user-2')
    })

    it('supports Alt arrows but leaves editing shortcuts alone', () => {
        const f = fixture()
        f.document.dispatchEvent(new f.page.KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true, cancelable: true }))
        expect(f.count()).toBe('2 / 3')
        const input = f.document.createElement('textarea')
        f.document.body.append(input)
        input.dispatchEvent(new f.page.KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true, cancelable: true }))
        expect(f.count()).toBe('2 / 3')
    })

    it('tracks the prompt being read during manual scrolling', () => {
        const f = fixture()
        f.scrollTo(650)
        expect(f.count()).toBe('2 / 3')
        f.scrollTo(1400)
        expect(f.count()).toBe('3 / 3')
        f.scrollTo(0)
        expect(f.count()).toBe('1 / 3')
    })

    it('does not let intermediate smooth-scroll positions cancel a selected prompt', () => {
        const f = fixture()
        f.next()
        f.next()
        f.scrollTo(300)
        expect(f.count()).toBe('3 / 3')
        f.page.dispatchEvent(new f.page.Event('wheel'))
        f.scrollTo(300)
        expect(f.count()).toBe('1 / 3')
    })

    it('uses a bottom bar if there is no side space', () => {
        const f = fixture(3, 390)
        expect(f.document.querySelector('nav')?.getAttribute('data-layout')).toBe('bottom')
        expect(f.document.body.dataset.cePromptNavLayout).toBe('bottom')
    })

    it('updates the reading position when resizing during navigation', () => {
        const f = fixture()
        f.next()
        expect(f.count()).toBe('2 / 3')
        f.page.dispatchEvent(new f.page.Event('resize'))
        expect(f.count()).toBe('1 / 3')
    })

    it('respects reduced motion', () => {
        const f = fixture()
        f.page.matchMedia = vi.fn(() => ({ matches: true })) as typeof f.page.matchMedia
        f.next()
        expect(f.scroll).toHaveBeenLastCalledWith({ top: 676, behavior: 'instant' })
    })

    it('has no bar with zero prompts and disables both arrows with one prompt', () => {
        expect(fixture(0).document.querySelector('nav')).toBeNull()
        const f = fixture(1)
        expect(f.count()).toBe('1 / 1')
        expect(f.document.querySelectorAll('button:disabled')).toHaveLength(2)
    })

    it('keeps the bar unique when initialized twice', () => {
        const f = fixture()
        f.page.eval(script)
        expect(f.document.querySelectorAll('#ce-prompt-navigation')).toHaveLength(1)
    })
})
