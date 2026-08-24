<div align="center">

<img src="public/icon/128.png" width="96" alt="DOCode" />

# DOCode

**Your forum, now with a minimap.**

一个把社区渲染成 VS Code 工作台的 Chromium 扩展。

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/chrome-Manifest%20V3-4285F4.svg)](https://developer.chrome.com/docs/extensions)
[![TypeScript](https://img.shields.io/badge/built%20with-TypeScript-3178C6.svg)](https://www.typescriptlang.org/)
[![Release](https://img.shields.io/github/v/release/ruezo/docode)](https://github.com/ruezo/docode/releases/latest)

[English](README.md) · 简体中文

</div>

---

打开论坛，看到源码。

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

## 特性

- **完整的工作台** —— Activity Bar、资源管理器、编辑器标签页、面包屑、minimap、大纲、状态栏、底部面板，像素级还原 Dark Modern。
- **随时退出** —— 一键恢复原版 Linux DO。停用时会移除 DOCode 持有的全部监听器、观察器和样式。

## 安装

[![下载 Chrome 插件](https://img.shields.io/badge/%E2%AC%87%EF%B8%8E%20%E4%B8%8B%E8%BD%BD-%E6%9C%80%E6%96%B0%E7%89%88%E6%9C%AC-2ea44f?style=for-the-badge)](https://github.com/ruezo/docode/releases/latest)

从最新 Release 下载 `docode-x.y.z-chrome.zip` 并解压——或者自己构建：

```bash
npm ci
npm run package:extension
```

1. 打开 `chrome://extensions`，启用**开发者模式**。
2. **加载已解压的扩展程序** → 选择解压后的文件夹（或 `.output/chrome-mv3`）。
3. 访问 [linux.do](https://linux.do)。

源码构建需要 Node.js 22+；运行只需任意 Chromium 系浏览器。

## 隐私

仅一个 `storage` 权限；仅一个内容脚本，只匹配 `https://linux.do/*`。无遥测、无云端、不接触凭据、无远程代码，所有请求不离开 Linux DO 源。

## 开发

```bash
npm run dev      # WXT 开发构建
npm run check    # 格式化 + lint + 类型检查 + 测试 + 构建 + 安全审计
npm run verify:extension   # 完整的 Playwright 验收套件
```

## 许可证

[MIT](LICENSE) © 2026 ruez

与 Microsoft、Visual Studio Code、LINUX DO 均无关联。

## 友情链接

[LINUX DO](https://linux.do)
