<div align="center">

<img src="public/icon/128.png" width="96" alt="DOCode" />

# DOCode

**Your forum, now with a minimap.**

A Chromium and Firefox extension that renders community as a VS Code workbench.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/chrome-Manifest%20V3-4285F4.svg)](https://developer.chrome.com/docs/extensions)
[![Firefox](https://img.shields.io/badge/firefox-128%2B-FF7139.svg)](https://www.mozilla.org/firefox/)
[![TypeScript](https://img.shields.io/badge/built%20with-TypeScript-3178C6.svg)](https://www.typescriptlang.org/)
[![Release](https://img.shields.io/github/v/release/ruezo/docode)](https://github.com/ruezo/docode/releases/latest)

English · [简体中文](README.zh-CN.md)

</div>

---

Open the forum. See source code.

```java
import LinuxDo.Community;

public class LinuxDo {

    private final Community community = new Community();

    private void @neo() {
        // /t/topic/2723223/9527 · pinned
        community.post("社区贴子标题")
            .at("1 hour")
            .comments(567)
            .views(20,018);
    }
}
```


## Demo

https://github.com/user-attachments/assets/ac8673c9-1cd4-4bfe-9631-542461a1bb06



## Features

- **The full workbench** — Activity Bar, Explorer, editor tabs, breadcrumbs, minimap, Outline, status bar, and a bottom panel, faithful to Dark Modern down to the pixel.
- **Instant exit** — one click restores the original Linux DO. Disabling removes every listener, observer, and style DOCode owns.

## Install

[![Download latest release](https://img.shields.io/badge/%E2%AC%87%EF%B8%8E%20Download-latest%20release-2ea44f?style=for-the-badge)](https://github.com/ruezo/docode/releases/latest)

Grab the file for your browser from the latest release — or build both yourself:

```bash
npm ci
npm run package:extension
```

**Chrome / Edge / Brave** — `docode-x.y.z-chrome.zip`

1. Unzip it, open `chrome://extensions`, and enable **Developer mode**.
2. **Load unpacked** → select the unzipped folder (or `.output/chrome-mv3`).
3. Visit [linux.do](https://linux.do).

**Firefox 128+** — `docode-x.y.z-firefox.xpi`

The add-on is unsigned, so Firefox Release and Beta refuse to install it permanently. Either
load it for the session, or use a build that allows unsigned add-ons:

1. *Any Firefox, until restart:* open `about:debugging#/runtime/this-firefox` →
   **Load Temporary Add-on…** → pick the `.xpi` (or `.output/firefox-mv3/manifest.json`).
2. *Developer Edition, Nightly, or ESR, permanently:* set `xpinstall.signatures.required` to
   `false` in `about:config`, then open the `.xpi` with `about:addons` → gear → **Install
   Add-on From File…**.
3. Visit [linux.do](https://linux.do).

Building from source requires Node.js 22+. The `.xpi` and `docode-x.y.z-firefox.zip` are the same
archive under two names — Firefox wants the `.xpi` extension, add-on stores want the `.zip`.


## Privacy

One `storage` permission. One content script, matched to `https://linux.do/*` only. No telemetry, no cloud, no credential access, no remote code. Requests never leave the Linux DO origin.

## Development

```bash
npm run dev              # WXT dev build (Chrome)
npm run dev -- -b firefox --mv3   # WXT dev build (Firefox)
npm run check            # format + lint + typecheck + tests + both builds + security audits
npm run verify:extension # full Playwright acceptance suite
npm run verify:package           # Chrome archive integrity + install/uninstall lifecycle
npm run verify:package:firefox   # Firefox archive integrity + add-on manifest
npx web-ext lint --source-dir .output/firefox-mv3   # optional Mozilla add-on linter
```

## License

[MIT](LICENSE) © 2026 ruez

Not affiliated with Microsoft, Visual Studio Code, or LINUX DO.


## Friendship Links

[LINUX DO](https://linux.do)