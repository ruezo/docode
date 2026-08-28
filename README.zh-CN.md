<div align="center">

<img src="public/icon/128.png" width="96" alt="DOCode" />

# DOCode

**Your forum, now with a minimap.**

一个把社区渲染成 VS Code 工作台的 Chromium / Firefox 扩展。

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/chrome-Manifest%20V3-4285F4.svg)](https://developer.chrome.com/docs/extensions)
[![Firefox](https://img.shields.io/badge/firefox-128%2B-FF7139.svg)](https://www.mozilla.org/firefox/)
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

## 演示

https://github.com/user-attachments/assets/ac8673c9-1cd4-4bfe-9631-542461a1bb06



## 特性

- **完整的工作台** —— Activity Bar、资源管理器、编辑器标签页、面包屑、minimap、大纲、状态栏、底部面板，像素级还原 Dark Modern。
- **随时退出** —— 一键恢复原版 Linux DO。停用时会移除 DOCode 持有的全部监听器、观察器和样式。

## 安装

[![下载 Chrome 插件](https://img.shields.io/badge/%E2%AC%87%EF%B8%8E%20%E4%B8%8B%E8%BD%BD-%E6%9C%80%E6%96%B0%E7%89%88%E6%9C%AC-2ea44f?style=for-the-badge)](https://github.com/ruezo/docode/releases/latest)

从最新 Release 下载对应浏览器的文件——或者自己构建（一次产出两个包）：

```bash
npm ci
npm run package:extension
```

**Chrome / Edge / Brave** —— `docode-x.y.z-chrome.zip`

1. 解压后打开 `chrome://extensions`，启用**开发者模式**。
2. **加载已解压的扩展程序** → 选择解压后的文件夹（或 `.output/chrome-mv3`）。
3. 访问 [linux.do](https://linux.do)。

**Firefox 128+** —— `docode-x.y.z-firefox.xpi`

插件未经签名，所以正式版和 Beta 版 Firefox 不允许永久安装。二选一：

1. *任意 Firefox，重启前有效：* 打开 `about:debugging#/runtime/this-firefox` → **临时载入附加组件**
   → 选择该 `.xpi`（或 `.output/firefox-mv3/manifest.json`）。
2. *Developer Edition / Nightly / ESR，可永久安装：* 在 `about:config` 把
   `xpinstall.signatures.required` 设为 `false`，然后在 `about:addons` → 齿轮 → **从文件安装附加组件**
   选择该 `.xpi`。
3. 访问 [linux.do](https://linux.do)。

源码构建需要 Node.js 22+。`.xpi` 与 `docode-x.y.z-firefox.zip` 是同一个压缩包的两个名字——Firefox
认 `.xpi` 后缀，附加组件商店要 `.zip`。

## 隐私

仅一个 `storage` 权限；仅一个内容脚本，只匹配 `https://linux.do/*`。无遥测、无云端、不接触凭据、无远程代码，所有请求不离开 Linux DO 源。

## 开发

```bash
npm run dev              # WXT 开发构建（Chrome）
npm run dev -- -b firefox --mv3   # WXT 开发构建（Firefox）
npm run check            # 格式化 + lint + 类型检查 + 测试 + 双浏览器构建 + 安全审计
npm run verify:extension # 完整的 Playwright 验收套件
npm run verify:package           # Chrome 包完整性 + 安装/卸载生命周期
npm run verify:package:firefox   # Firefox 包完整性 + 附加组件 manifest
npx web-ext lint --source-dir .output/firefox-mv3   # 可选：Mozilla 官方附加组件检查
```

## 许可证

[MIT](LICENSE) © 2026 ruez

与 Microsoft、Visual Studio Code、LINUX DO 均无关联。

## 友情链接

[LINUX DO](https://linux.do)
