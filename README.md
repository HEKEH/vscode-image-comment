# Image Comment - VSCode Extension

A VSCode extension that automatically saves pasted images and inserts comment references.

[English](./README.md) | [简体中文](./README.zh-CN.md)

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/hekaigustav.image-comment?label=VS%20Code%20Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=hekaigustav.image-comment)

## ✨ Features

- 🖼️ **Auto-detect image paste**: Automatically detects images in clipboard (supports screenshots, copied image files, etc.)
- 💾 **Auto-save images**: Saves images to a specified folder in the project directory (default: `.image-comment`)
- 📝 **Auto-insert comments**: Automatically inserts image reference comments at the paste position
- 🔧 **Smart comment format**: Automatically selects appropriate comment format based on file type (JavaScript, Python, HTML, Markdown, etc.)
- 🌍 **Multi-platform support**: Supports macOS, Windows, and Linux

## 📦 Installation

[Install from Marketplace](https://marketplace.visualstudio.com/items?itemName=hekaigustav.image-comment) | Search "Image Comment" in VS Code Extensions panel and install

## 🚀 Usage

1. Copy an image to clipboard (screenshot, copy image file, copy from browser, etc.)
2. Right-click in the code editor and select **"Paste Image as Comment"**

   <img src="./images/context-menu.png" alt="Context Menu" width="200">
3. The extension will automatically detect the image, save it to the `.image-comment` folder, and insert a comment at the current position

## ⚙️ Configuration Options

| Configuration | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `imageComment.saveDirectory` | string | `.image-comment` | Directory name to save images (relative to workspace root) |
| `imageComment.commentTemplate` | string | `![image]({path})` | Comment template, use `{path}` as placeholder for image path |
| `imageComment.useRelativePath` | boolean | `true` | Whether to use relative path in comments |

## 🔗 Recommended Extension

For better image preview experience, we recommend installing the [Image Preview](https://marketplace.visualstudio.com/items?itemName=kisstkondoros.vscode-gutter-preview) extension to preview images directly in the editor.

## 💻 System Requirements

- **macOS**: No additional tools required
- **Windows**: Requires PowerShell (pre-installed on Windows 10+)
- **Linux**: Requires `xclip` to be installed (`sudo apt-get install xclip` or your distribution's package manager)

## ❓ FAQ

**Q: Why is "Paste Image as Comment" not showing in the context menu?**
A: Make sure the editor has focus, is not in read-only mode, and no text is selected.

**Q: Where are images saved?**
A: By default, images are saved in the `.image-comment` folder in the workspace root. You can change the save location by modifying `imageComment.saveDirectory` in settings.

**Q: What image formats are supported?**
A: Supports common image formats such as PNG, JPEG, GIF, WebP, BMP, SVG. Maximum size is 50MB.

## 📄 License

MIT License

---

If this extension is helpful to you, please give it a ⭐ Star!
