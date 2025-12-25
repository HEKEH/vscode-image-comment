# Image Comment - VSCode Extension

A VSCode extension that automatically saves pasted images and inserts comment references.

[English](./README.md) | [简体中文](./README.zh-CN.md)

## ✨ Features

- 🖼️ **Auto-detect image paste**: Automatically detects images in clipboard (supports screenshots, copied image files, etc.)
- 💾 **Auto-save images**: Saves images to a specified folder in the project directory (default: `.image-comment`)
- 📝 **Auto-insert comments**: Automatically inserts image reference comments at the paste position
- 🌍 **Multi-platform support**: Supports macOS, Windows, and Linux
- 🔧 **Smart comment format**: Automatically selects appropriate comment format based on file type
- 🌐 **Internationalization**: Supports English, Simplified Chinese, and Traditional Chinese
- ⚙️ **Configurable options**: Supports custom save directory, comment template, etc.
- 📋 **Context menu**: Provides convenient right-click menu option

## 📦 Installation

### Install from VS Code Marketplace (Recommended)

1. Open VS Code
2. Press `Ctrl+Shift+X` (macOS: `Cmd+Shift+X`) to open the Extensions panel
3. Search for "Image Comment"
4. Click Install

### Install from Source

1. Clone or download this repository:

   ```bash
   git clone https://github.com/your-username/image-comment.git
   cd image-comment
   ```

2. Install dependencies and compile:

   ```bash
   npm install
   npm run compile
   ```

3. Press `F5` in VS Code to open the Extension Development Host for testing

4. Or package as a `.vsix` file:

   ```bash
   npm install -g vsce
   vsce package
   ```

   Then install the generated `.vsix` file in VS Code using "Install from VSIX"

## 🚀 Usage

### Method 1: Context Menu (Recommended)

1. Copy an image to clipboard (supports the following methods):
   - Take a screenshot (macOS: `Cmd+Shift+4`, Windows: `Win+Shift+S`, Linux: use system screenshot tool)
   - Copy image file (copy image file in file manager)
   - Copy image from browser or other applications

2. Right-click in the code editor and select **"Paste Image as Comment"**

3. The extension will automatically:
   - Detect the image in clipboard
   - Save the image to the `.image-comment` folder
   - Insert a comment at the current position

### Method 2: Command Palette

1. Copy an image to clipboard
2. Press `Ctrl+Shift+P` (macOS: `Cmd+Shift+P`) to open the Command Palette
3. Type "Paste Image as Comment" and select it

## 📝 Examples

### Example 1: JavaScript/TypeScript

```javascript
// ![image](.image-comment/image-20241225-120000-abc123.png)
```

### Example 2: Python

```python
# ![image](.image-comment/image-20241225-120000-abc123.png)
```

### Example 3: HTML

```html
<!-- ![image](.image-comment/image-20241225-120000-abc123.png) -->
```

### Example 4: Markdown

```markdown
![image](.image-comment/image-20241225-120000-abc123.png)
```

## ⚙️ Configuration Options

You can configure the following options in VS Code settings:

| Configuration | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `imageComment.saveDirectory` | string | `.image-comment` | Directory name to save images (relative to workspace root) |
| `imageComment.commentTemplate` | string | `![image]({path})` | Comment template, use `{path}` as placeholder for image path |
| `imageComment.useRelativePath` | boolean | `true` | Whether to use relative path in comments |

### Configuration Example

Add the following to VS Code settings (`settings.json`):

```json
{
  "imageComment.saveDirectory": ".images",
  "imageComment.commentTemplate": "<!-- Image: {path} -->",
  "imageComment.useRelativePath": true
}
```

## 🎨 Supported Comment Formats

The extension automatically selects the appropriate comment format based on file type:

| Language | Single-line | Multi-line |
| :--- | :--- | :--- |
| JavaScript/TypeScript | `//` | `/* */` |
| Python | `#` | `""" """` |
| Java/C/C++/C#/Go/Rust | `//` | `/* */` |
| HTML | - | `<!-- -->` |
| CSS/SCSS/Less | `//` | `/* */` |
| SQL | `--` | `/* */` |
| Shell/Bash | `#` | `: <<'EOF' ... EOF` |
| Ruby | `#` | `=begin =end` |
| PHP | `//` | `/* */` |
| Swift/Kotlin/Scala | `//` | `/* */` |
| YAML | `#` | - |
| JSON | - | `/* */` |

## 🖼️ Supported Image Formats

- PNG
- JPEG/JPG
- GIF
- WebP
- BMP
- SVG

**Note**: Maximum image size is 50MB.

## 🌐 Internationalization

The extension supports the following languages:

- English
- Simplified Chinese (zh-CN)
- Traditional Chinese (zh-TW)

The language will automatically switch based on VS Code's language setting.

## 💻 System Requirements

### macOS

- No additional tools required, uses system clipboard API

### Windows

- Requires PowerShell (included by default, Windows 10+ has it pre-installed)

### Linux

- Requires `xclip` to be installed:

  ```bash
  # Ubuntu/Debian
  sudo apt-get install xclip

  # Fedora/CentOS
  sudo dnf install xclip
  # or
  sudo yum install xclip

  # Arch Linux
  sudo pacman -S xclip

  # openSUSE
  sudo zypper install xclip
  ```

## 🔧 Development

### Requirements

- Node.js >= 16
- npm >= 8
- VS Code >= 1.74.0

### Development Commands

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode compilation (for development)
npm run watch

# Package extension
npm install -g vsce
vsce package
```

### Project Structure

```text
image-comment/
├── src/
│   ├── extension.ts      # Main extension file
│   ├── nls.ts           # Internationalization support
│   └── nls.*.json       # Language files
├── out/                 # Compiled output directory
├── package.json         # Extension configuration
└── tsconfig.json       # TypeScript configuration
```

## ❓ FAQ

### Q: Why is "Paste Image as Comment" not showing in the context menu?

A: Make sure:

1. The editor has focus
2. The editor is not in read-only mode
3. No text is selected

### Q: Where are images saved?

A: By default, images are saved in the `.image-comment` folder in the workspace root. You can change the save location by modifying `imageComment.saveDirectory` in settings.

### Q: How to modify the comment format?

A: Modify `imageComment.commentTemplate` in VS Code settings, using `{path}` as a placeholder for the image path.

### Q: What image formats are supported?

A: Supports common image formats such as PNG, JPEG, GIF, WebP, BMP, SVG.

### Q: Is there a size limit for images?

A: Yes, the maximum supported image size is 50MB.

## 📄 License

MIT License

## 🤝 Contributing

Issues and Pull Requests are welcome!

### Contributing Guidelines

1. Fork this repository

2. Create a feature branch (`git checkout -b feature/AmazingFeature`)

3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)

4. Push to the branch (`git push origin feature/AmazingFeature`)

5. Open a Pull Request

## 📝 Changelog

### v0.1.0

- ✨ Initial release
- 🖼️ Support for image paste and auto-save
- 📝 Support for multiple language comment formats
- 🌐 Internationalization support (English, Simplified Chinese, Traditional Chinese)
- ⚙️ Custom configuration options

## 🔗 Related Links

- [VS Code Extension API](https://code.visualstudio.com/api)
- [TypeScript](https://www.typescriptlang.org/)

---

If this extension is helpful to you, please give it a ⭐ Star!
