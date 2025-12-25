# Image Comment - VSCode Extension

一个 VSCode 扩展，用于自动保存粘贴的图片并插入注释引用。

[English](./README.md) | [简体中文](./README.zh-CN.md)

## ✨ 功能特性

- 🖼️ **自动检测图片粘贴**：自动检测剪贴板中的图片（支持截图、复制图片文件等）
- 💾 **自动保存图片**：将图片保存到项目目录下的指定文件夹（默认：`.image-comment`）
- 📝 **自动插入注释**：在粘贴位置自动插入图片引用注释
- 🌍 **多平台支持**：支持 macOS、Windows 和 Linux
- 🔧 **智能注释格式**：根据文件类型自动选择合适的注释格式
- 🌐 **国际化支持**：支持英文、简体中文、繁体中文
- ⚙️ **可配置选项**：支持自定义保存目录、注释模板等
- 📋 **右键菜单**：提供便捷的右键菜单选项

## 📦 安装

### 从 VS Code 市场安装（推荐）

1. 打开 VS Code
2. 按 `Ctrl+Shift+X`（macOS: `Cmd+Shift+X`）打开扩展面板
3. 搜索 "Image Comment"
4. 点击安装

### 从源码安装

1. 克隆或下载此仓库：

   ```bash
   git clone https://github.com/your-username/image-comment.git
   cd image-comment
   ```

2. 安装依赖并编译：

   ```bash
   npm install
   npm run compile
   ```

3. 在 VS Code 中按 `F5` 打开扩展开发窗口进行测试

4. 或者打包为 `.vsix` 文件：

   ```bash
   npm install -g vsce
   vsce package
   ```

   然后在 VS Code 中使用 "从 VSIX 安装" 功能安装生成的 `.vsix` 文件

## 🚀 使用方法

### 方法一：右键菜单（推荐）

1. 复制图片到剪贴板（支持以下方式）：
   - 截图（macOS: `Cmd+Shift+4`，Windows: `Win+Shift+S`，Linux: 使用系统截图工具）
   - 复制图片文件（在文件管理器中复制图片文件）
   - 从浏览器或其他应用复制图片

2. 在代码编辑器中右键点击，选择 **"粘贴图片为注释"**（Paste Image as Comment）

3. 插件会自动：
   - 检测剪贴板中的图片
   - 保存图片到 `.image-comment` 文件夹
   - 在当前位置插入注释

### 方法二：命令面板

1. 复制图片到剪贴板
2. 按 `Ctrl+Shift+P`（macOS: `Cmd+Shift+P`）打开命令面板
3. 输入 "Paste Image as Comment" 并选择

## 📝 使用示例

### 示例 1：JavaScript/TypeScript

```javascript
// ![image](.image-comment/image-20241225-120000-abc123.png)
```

### 示例 2：Python

```python
# ![image](.image-comment/image-20241225-120000-abc123.png)
```

### 示例 3：HTML

```html
<!-- ![image](.image-comment/image-20241225-120000-abc123.png) -->
```

### 示例 4：Markdown

```markdown
![image](.image-comment/image-20241225-120000-abc123.png)
```

## ⚙️ 配置选项

在 VS Code 设置中可以配置以下选项：

| 配置项 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `imageComment.saveDirectory` | string | `.image-comment` | 图片保存目录名称（相对于工作区根目录） |
| `imageComment.commentTemplate` | string | `![image]({path})` | 注释模板，使用 `{path}` 作为图片路径的占位符 |
| `imageComment.useRelativePath` | boolean | `true` | 是否在注释中使用相对路径 |

### 配置示例

在 VS Code 设置（`settings.json`）中添加：

```json
{
  "imageComment.saveDirectory": ".images",
  "imageComment.commentTemplate": "<!-- Image: {path} -->",
  "imageComment.useRelativePath": true
}
```

## 🎨 支持的注释格式

插件会根据文件类型自动选择合适的注释格式：

| 语言 | 单行注释 | 多行注释 |
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

## 🖼️ 支持的图片格式

- PNG
- JPEG/JPG
- GIF
- WebP
- BMP
- SVG

**注意**：图片大小限制为 50MB。

## 🌐 国际化支持

插件支持以下语言：

- English（英文）
- 简体中文（zh-CN）
- 繁体中文（zh-TW）

语言会根据 VS Code 的语言设置自动切换。

## 💻 系统要求

### macOS

- 无需额外工具，使用系统自带的剪贴板 API

### Windows

- 需要 PowerShell（系统自带，Windows 10+ 默认已安装）

### Linux

- 需要安装 `xclip`：

  ```bash
  # Ubuntu/Debian
  sudo apt-get install xclip

  # Fedora/CentOS
  sudo dnf install xclip
  # 或
  sudo yum install xclip

  # Arch Linux
  sudo pacman -S xclip

  # openSUSE
  sudo zypper install xclip
  ```

## 🔧 开发

### 环境要求

- Node.js >= 16
- npm >= 8
- VS Code >= 1.74.0

### 开发命令

```bash
# 安装依赖
npm install

# 编译 TypeScript
npm run compile

# 监听模式编译（开发时使用）
npm run watch

# 打包扩展
npm install -g vsce
vsce package
```

### 项目结构

```text
image-comment/
├── src/
│   ├── extension.ts      # 主扩展文件
│   ├── nls.ts           # 国际化支持
│   └── nls.*.json       # 语言文件
├── out/                 # 编译输出目录
├── package.json         # 扩展配置
└── tsconfig.json       # TypeScript 配置
```

## ❓ 常见问题

### Q: 为什么右键菜单中没有 "粘贴图片为注释" 选项？

A: 请确保：

1. 编辑器处于焦点状态
2. 编辑器不是只读模式
3. 没有选中任何文本

### Q: 图片保存在哪里？

A: 默认保存在工作区根目录下的 `.image-comment` 文件夹中。可以在设置中修改 `imageComment.saveDirectory` 来更改保存位置。

### Q: 如何修改注释格式？

A: 在 VS Code 设置中修改 `imageComment.commentTemplate`，使用 `{path}` 作为图片路径的占位符。

### Q: 支持哪些图片格式？

A: 支持 PNG、JPEG、GIF、WebP、BMP、SVG 等常见图片格式。

### Q: 图片大小有限制吗？

A: 是的，最大支持 50MB 的图片文件。

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 贡献指南

1. Fork 本仓库

2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)

3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)

4. 推送到分支 (`git push origin feature/AmazingFeature`)

5. 开启 Pull Request

## 📝 更新日志

### v0.1.0

- ✨ 初始版本发布
- 🖼️ 支持图片粘贴和自动保存
- 📝 支持多种语言的注释格式
- 🌐 支持国际化（英文、简体中文、繁体中文）
- ⚙️ 支持自定义配置选项

## 🔗 相关链接

- [VS Code Extension API](https://code.visualstudio.com/api)
- [TypeScript](https://www.typescriptlang.org/)

---

如果这个扩展对你有帮助，欢迎给个 ⭐ Star！
