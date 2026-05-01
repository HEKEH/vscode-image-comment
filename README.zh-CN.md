# Image Comment - VSCode Extension

一个 VSCode 扩展，用于自动保存粘贴的图片并插入注释引用。

[English](./README.md) | [简体中文](./README.zh-CN.md)

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/hekaigustav.image-comment?label=VS%20Code%20Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=hekaigustav.image-comment)

## ✨ 功能特性

- 🖼️ **自动检测图片粘贴**：自动检测剪贴板中的图片（支持截图、复制图片文件等）
- 💾 **自动保存图片**：将图片保存到项目目录下的指定文件夹（默认：`.image-comment`）
- 📝 **自动插入注释**：在粘贴位置自动插入图片引用注释
- 🔧 **智能注释格式**：根据文件类型自动选择合适的注释格式（JavaScript、Python、HTML、Markdown 等）
- 👀 **快速预览与删除**：为图片注释提供内联 CodeLens 操作，可直接预览、删除注释与图片文件
- 🎨 **视觉装饰增强**：支持图片注释行背景高亮与行号区图标显示，便于定位

## 📦 安装

[从市场安装](https://marketplace.visualstudio.com/items?itemName=hekaigustav.image-comment) | 在 VS Code 扩展面板搜索 "Image Comment" 并安装

## 🚀 使用方法

1. 复制图片到剪贴板（截图、复制图片文件、从浏览器复制等）
2. 在代码编辑器中右键点击，选择 **"粘贴图片为注释"**

<img src="./images/context-menu.png" alt="右键菜单" width="200">
3. 插件会自动检测图片、保存到 `.image-comment` 文件夹并在当前位置插入注释
4. 对已插入的图片注释，可使用注释上方的 **“预览”** 与 **“删除”** 操作

## ⚙️ 配置选项

| 配置项 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `imageComment.saveDirectory` | string | `.image-comment` | 图片保存目录名称（相对于工作区根目录） |
| `imageComment.commentTemplate` | string | `![image-comment]({path})` | 注释模板，使用 `{path}` 作为图片路径的占位符 |
| `imageComment.useRelativePath` | boolean | `true` | 是否在注释中使用相对路径 |
| `imageComment.enableDecorations` | boolean | `true` | 是否启用图片注释的视觉装饰 |
| `imageComment.showGutterIcon` | boolean | `true` | 是否在图片注释所在行显示行号区图标 |
| `imageComment.highlightBackground` | boolean | `true` | 是否高亮图片注释行背景 |

## 🆕 最近更新

- 新增图片注释内联预览/删除能力
- 新增图片注释视觉装饰（行号区图标 + 背景高亮）
- 优化 i18n，补充多语言本地化

## 💻 系统要求

- **macOS**：无需额外工具
- **Windows**：需要 PowerShell（Windows 10+ 默认已安装）

## ❓ 常见问题

**Q: 为什么右键菜单中没有 "粘贴图片为注释" 选项？**
A: 请确保编辑器处于焦点状态、不是只读模式，且没有选中任何文本。

**Q: 为什么图片注释上方看不到“预览”/“删除”按钮？**
A: 只有当当前行能匹配你在 `imageComment.commentTemplate` 中配置的有效图片注释格式，且图片路径可正确解析时，才会显示这些内联操作。如果未显示，请检查注释内容是否仍符合模板、图片文件路径是否有效。

**Q: 图片保存在哪里？**
A: 默认保存在工作区根目录下的 `.image-comment` 文件夹中。可在设置中修改 `imageComment.saveDirectory`。

**Q: 支持哪些图片格式？**
A: 支持 PNG、JPEG、GIF、WebP、BMP、SVG 等常见格式，最大 50MB。

## 📄 许可证

MIT License

---

如果这个扩展对你有帮助，欢迎给个 ⭐ Star！
