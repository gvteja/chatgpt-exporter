# Personal Chrome extension fork

This fork builds the original exporter source as a Chrome extension. It also keeps
the upstream userscript build. The local development branch is `chrome-extension`.

Initial upstream base: `e59449ab7ff428ad86aa95e2d0be444db221ab5d`, exporter 2.36.2.
The extension version is 0.3.0. It replaces the separate wrapper version 0.2.2.

## Local changes

| Change | Source |
| --- | --- |
| Chrome Manifest V3, popup, and packaged licenses | `extension/` |
| Separate extension build; bundle dependencies locally | `vite.extension.config.ts`, `scripts/extension-metadata.ts` |
| Shared startup with separate entries | `src/main.tsx`, `src/userscript.ts`, `src/extension/entry.ts` |
| Synchronous settings adapter | `src/extension/client.ts`, `src/extension/gm-storage.js` |
| Saved-chat detection without rendered message elements | `src/page.ts` |
| Strict URL validation and no fallback to the latest chat | `src/page.ts`, `src/api.ts` |
| Stable native HTML message links | `src/exporter/messageAnchors.ts`, `src/exporter/html.ts`, `src/template.html` |

Upstream already includes support for `data-theme="dark"`, theme tests, and the new
sidebar. This fork uses those fixes directly. No build-time text patches are used.

## Build and install

Use Node.js 22.12 or newer and the pnpm version in `package.json` (8.14.1).

```sh
pnpm install --frozen-lockfile
pnpm run check:extension
```

In `chrome://extensions`, disable the old wrapper, select **Load unpacked**, and
select this repository's `extension-dist/` folder. Reload ChatGPT. Use only one
exporter at a time. The old scaffold remains available as a recovery copy.

The extension keeps the old `chatgpt-exporter-extension:v1:` settings namespace and
serialization format. Settings remain in localStorage on the ChatGPT origin, so
the same browser profile and origin can keep its existing settings. Page scripts
can read these settings. They are not stored in `chrome.storage`.

The extension runs in the MAIN world and matches only the two ChatGPT origins. It
adds no extension API permissions. The extension scripts and CSS are local. The
exported HTML can still load remote scripts, styles, and images, as upstream does.

For later rebuilds:

```sh
pnpm run build:extension
```

Reload the extension and ChatGPT after each rebuild. `extension-dist/` is generated
and ignored by Git. `BUILD-INFO.json` records the source commit and whether the
working tree had changes at build time. Package license notices are included.

## Maintain the fork

`origin` points to your GitHub fork. `upstream` points to pionxzh/chatgpt-exporter.
The original `master` branch is separate from your `chrome-extension` branch.

To view your changes:

```sh
git log --oneline upstream/master..chrome-extension
git diff upstream/master...chrome-extension
```

Before an upstream update, commit current work. Then use a new update branch:

```sh
git fetch upstream
git switch chrome-extension
git switch -c update/upstream-YYYY-MM-DD
git merge upstream/master
pnpm install --frozen-lockfile
pnpm run check:extension
pnpm run lint
```

Resolve conflicts in the source files. Check a small HTML and Markdown export,
HTML message links, and both themes in ChatGPT. When the result works, merge the
update branch into `chrome-extension` and push it to `origin`.

Keep extension packaging and exporter behavior changes in separate commits when
possible. This makes source fixes easier to submit upstream. Change the extension
version in `extension/manifest.json` for a new extension release. Keep the upstream
exporter version in `package.json` separate.

The upstream userscript build is available with `pnpm run build`. It writes to the
upstream `dist/` directory. Review those generated changes before committing.

## Validation

Initial migration: 140 source tests passed. Type checking, the userscript build,
and the Chrome extension build passed. The generated extension check verifies
packaged files, permissions, licenses, and startup against a synthetic DOM. It
checks that the Export button mounts and a second start does not add another one.
These checks do not use a ChatGPT account. Check a signed-in Chrome export after
installation.
