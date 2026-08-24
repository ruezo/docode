<div align="center">

<img src="public/icon/128.png" width="96" alt="DOCode" />

# DOCode

**Your forum, now with a minimap.**

A Chromium extension that renders community as a VS Code workbench.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/chrome-Manifest%20V3-4285F4.svg)](https://developer.chrome.com/docs/extensions)
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


## Features

- **The full workbench** — Activity Bar, Explorer, editor tabs, breadcrumbs, minimap, Outline, status bar, and a bottom panel, faithful to Dark Modern down to the pixel.
- **Instant exit** — one click restores the original Linux DO. Disabling removes every listener, observer, and style DOCode owns.

## Install

[![Download for Chrome](https://img.shields.io/badge/%E2%AC%87%EF%B8%8E%20Download-latest%20release-2ea44f?style=for-the-badge)](https://github.com/ruezo/docode/releases/latest)

Grab `docode-x.y.z-chrome.zip` from the latest release and unzip it — or build it yourself:

```bash
npm ci
npm run package:extension
```

1. Open `chrome://extensions` and enable **Developer mode**.
2. **Load unpacked** → select the unzipped folder (or `.output/chrome-mv3`).
3. Visit [linux.do](https://linux.do).

Building from source requires Node.js 22+; running requires any Chromium-based browser.


## Privacy

One `storage` permission. One content script, matched to `https://linux.do/*` only. No telemetry, no cloud, no credential access, no remote code. Requests never leave the Linux DO origin.

## Development

```bash
npm run dev      # WXT dev build
npm run check    # format + lint + typecheck + tests + build + security audit
npm run verify:extension   # full Playwright acceptance suite
```

## License

[MIT](LICENSE) © 2026 ruez

Not affiliated with Microsoft, Visual Studio Code, or LINUX DO.


## Friendship Links

[LINUX DO](https://linux.do)