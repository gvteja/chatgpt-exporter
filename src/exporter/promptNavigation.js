// Embedded in exported HTML. Keep this script independent of the extension and CDNs.
(() => {
    const conversation = document.querySelector('.conversation')
    const prompts = Array.from(document.querySelectorAll('.conversation > .conversation-item[data-ce-prompt]'))
    if (!conversation || !prompts.length || document.getElementById('ce-prompt-navigation')) return

    const nav = document.createElement('nav')
    nav.id = 'ce-prompt-navigation'
    nav.setAttribute('aria-label', 'Navigate between your prompts')
    const heading = document.createElement('span')
    heading.className = 'ce-prompt-nav-heading'
    heading.textContent = 'Prompts'
    const button = (text, label) => {
        const element = document.createElement('button')
        element.type = 'button'
        element.textContent = text
        element.setAttribute('aria-label', label)
        element.title = label
        return element
    }
    const previous = button('↑', 'Previous prompt (Option/Alt + Up Arrow)')
    const next = button('↓', 'Next prompt (Option/Alt + Down Arrow)')
    const markers = document.createElement('div')
    markers.className = 'ce-prompt-nav-markers'
    const count = document.createElement('output')
    count.className = 'ce-prompt-nav-count'
    count.setAttribute('aria-live', 'polite')
    count.setAttribute('aria-atomic', 'true')
    let active = -1
    let pending = false
    let settleTimer
    let scrollFrame

    const links = prompts.map((prompt, index) => {
        const link = document.createElement('a')
        link.className = 'ce-prompt-nav-marker'
        link.href = `#${encodeURIComponent(prompt.id)}`
        const content = prompt.querySelector('.conversation-content')
        const excerpt = (content?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100) || 'Attachment or empty prompt'
        link.title = `${index + 1}. ${excerpt}`
        link.setAttribute('aria-label', `Go to prompt ${index + 1}: ${excerpt}`)
        link.addEventListener('click', (event) => {
            // Keep native link behavior for opening a prompt in another tab.
            if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            event.preventDefault()
            navigate(index)
        })
        markers.append(link)
        return link
    })

    function select(index) {
        if (index === active) return
        links[active]?.removeAttribute('aria-current')
        active = index
        const link = links[index]
        link.setAttribute('aria-current', 'step')
        count.textContent = `${index + 1} / ${prompts.length}`
        count.setAttribute('aria-label', `Prompt ${index + 1} of ${prompts.length}`)
        count.title = `Prompt ${index + 1} of ${prompts.length}`
        previous.disabled = index === 0
        next.disabled = index === prompts.length - 1
        // Scroll only the marker list; scrolling an ancestor can move the document.
        const item = link.getBoundingClientRect()
        const list = markers.getBoundingClientRect()
        if (item.top < list.top) markers.scrollTop -= list.top - item.top
        else if (item.bottom > list.bottom) markers.scrollTop += item.bottom - list.bottom
        if (item.left < list.left) markers.scrollLeft -= list.left - item.left
        else if (item.right > list.right) markers.scrollLeft += item.right - list.right
    }

    function syncFromScroll() {
        scrollFrame = undefined
        if (pending) return
        const readingLine = Math.min(120, window.innerHeight * 0.22)
        let index = 0
        prompts.forEach((prompt, i) => {
            if (prompt.getBoundingClientRect().top <= readingLine) index = i
        })
        const height = document.documentElement.scrollHeight
        if (height > window.innerHeight + 2 && window.scrollY + window.innerHeight >= height - 2) index = prompts.length - 1
        select(index)
    }

    function settle() {
        pending = false
        clearTimeout(settleTimer)
        // Keep the selected prompt when its position is clamped by the page end.
    }

    function navigate(index) {
        if (index < 0 || index >= prompts.length) return
        pending = true
        clearTimeout(settleTimer)
        select(index)
        const prompt = prompts[index]
        prompt.focus({ preventScroll: true })
        const url = new URL(window.location.href)
        url.hash = prompt.id
        try {
            window.history.replaceState(null, '', url)
        }
        catch { /* Some local-file viewers do not allow history changes. */ }
        window.scrollTo({
            top: Math.max(0, window.scrollY + prompt.getBoundingClientRect().top - 24),
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        })
        settleTimer = setTimeout(settle, 800)
    }

    function layout() {
        const rect = conversation.getBoundingClientRect()
        const left = rect.right + 16
        const side = left + 64 <= document.documentElement.clientWidth
        nav.dataset.layout = side ? 'side' : 'bottom'
        document.body.dataset.cePromptNavLayout = nav.dataset.layout
        nav.style.left = side ? `${left}px` : ''
    }

    previous.addEventListener('click', () => navigate(active - 1))
    next.addEventListener('click', () => navigate(active + 1))
    document.addEventListener('keydown', (event) => {
        if (event.defaultPrevented || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
        if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
        event.preventDefault()
        navigate(active + (event.key === 'ArrowUp' ? -1 : 1))
    })
    window.addEventListener('scroll', () => {
        if (pending) {
            clearTimeout(settleTimer)
            settleTimer = setTimeout(settle, 160)
        }
        else if (scrollFrame === undefined) {
            scrollFrame = requestAnimationFrame(syncFromScroll)
        }
    }, { passive: true })
    // Manual scrolling takes control immediately, including during smooth navigation.
    window.addEventListener('wheel', settle, { passive: true })
    window.addEventListener('touchstart', settle, { passive: true })
    window.addEventListener('resize', () => {
        settle()
        layout()
        syncFromScroll()
    })
    window.addEventListener('hashchange', syncFromScroll)
    window.addEventListener('load', syncFromScroll)
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(layout).observe(conversation)
    nav.append(heading, previous, markers, count, next)
    document.body.append(nav)
    layout()
    select(0)
    syncFromScroll()
})()
