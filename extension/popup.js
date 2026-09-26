async function showVersion() {
    const label = document.getElementById('version')
    try {
        const response = await fetch('./BUILD-INFO.json')
        if (!response.ok) throw new Error('Missing build information')
        const info = await response.json()
        label.textContent = `Extension ${info.extensionVersion} · Exporter ${info.exporterVersion}`
    }
    catch {
        label.textContent = 'Build information missing. Rebuild and reload the extension.'
    }
}
showVersion()
