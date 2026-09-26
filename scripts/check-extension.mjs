import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Script } from 'node:vm'
import { Window } from 'happy-dom'

const load = file => readFile(new URL(`../extension-dist/${file}`, import.meta.url), 'utf8')
const manifest = JSON.parse(await load('manifest.json'))
assert.equal(manifest.manifest_version, 3)
assert.equal(manifest.content_scripts.length, 1)
const content = manifest.content_scripts[0]
assert.equal(content.world, 'MAIN')
assert.equal(content.all_frames, false)
assert.deepEqual(content.matches, ['https://chatgpt.com/*', 'https://chat.openai.com/*'])
assert.equal(manifest.permissions, undefined)
assert.equal(manifest.host_permissions, undefined)
for (const file of [...content.js, ...content.css, manifest.action.default_popup, 'popup.js', 'popup.css']) {
    assert.ok((await load(file)).length > 0, `Missing ${file}`)
}
const js = await load('exporter.js')
assert.doesNotThrow(() => new Script(js), 'Invalid extension JavaScript')
assert.ok(!js.includes('vite-plugin-monkey/dist/client'), 'Unresolved userscript client')
assert.ok(js.includes('chatgpt-exporter-extension:v1:'), 'Missing settings adapter')
assert.ok(js.includes('ce-message-link'), 'Missing HTML message links')
assert.ok((await load('exporter.css')).includes('[data-theme="dark"]'), 'Missing dark theme support')
const info = JSON.parse(await load('BUILD-INFO.json'))
assert.equal(info.extensionVersion, manifest.version)
assert.match(info.sourceCommit, /^[a-f0-9]{40}$/)
const notices = JSON.parse(await load('licenses/DEPENDENCIES.json'))
for (const name of ['jszip', '@zumer/snapdom', 'preact']) {
    assert.ok(notices.some(item => item.name === name && item.files.length), `Missing license: ${name}`)
}
console.log(`Extension ${manifest.version}: files, script syntax, scope, patches, and dependency notices verified.`)

// Run the compiled entry and adapter together against a synthetic page.
// No ChatGPT account or network requests are used by this check.
const page = new Window({
    url: 'https://chatgpt.com/',
    settings: { enableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true },
})
try {
    page.fetch = async () => {
        throw new Error('Unexpected network request in extension smoke check')
    }
    page.document.body.innerHTML = '<nav><div><button data-testid="accounts-profile-button">Profile</button></div></nav>'
    page.eval(js)
    page.dispatchEvent(new page.Event('load'))
    assert.equal(page.__CHATGPT_EXPORTER_EXTENSION_V1__?.status, 'loaded')
    assert.equal(page.document.querySelectorAll('.ce-nav-trigger').length, 1, 'Export button did not mount')
    page.eval(js)
    assert.equal(page.document.querySelectorAll('.ce-nav-trigger').length, 1, 'Duplicate Export button')
    console.log('Compiled extension: startup, Export button mount, and duplicate-start guard verified on a synthetic page.')
}
finally {
    await page.happyDOM.close()
}
