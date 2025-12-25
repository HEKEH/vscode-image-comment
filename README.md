# Image Comment - VSCode Extension

一个 VSCode 插件，用于自动保存粘贴的图片并插入注释引用。

## 功能特性

- 🖼️ **自动检测图片粘贴**：监听粘贴事件，自动检测剪贴板中的图片
- 💾 **自动保存图片**：将图片保存到项目目录下的 `.image-comment` 文件夹
- 📝 **自动插入注释**：在粘贴位置自动插入图片引用注释
- 🌍 **多平台支持**：支持 macOS、Windows 和 Linux
- 🔧 **智能注释格式**：根据文件类型自动选择合适的注释格式
- ⚙️ **可配置选项**：支持自定义保存目录、注释模板等

## 安装

### 从源码安装

1. 克隆或下载此仓库
2. 在项目目录运行：
   ```bash
   npm install
   npm run compile
   ```
3. 在 VSCode 中按 `F5` 打开扩展开发窗口
4. 或者使用 `vsce package` 打包为 `.vsix` 文件进行安装

## 使用方法

1. 复制图片到剪贴板（支持 PNG、JPG、JPEG、GIF、WebP 等格式）
2. 在代码编辑器中按 `Ctrl+V`（macOS: `Cmd+V`）粘贴
3. 插件会自动：
   - 检测到图片
   - 保存图片到 `.image-comment` 文件夹
   - 在当前位置插入注释，例如：`// ![image](.image-comment/image-20240101-120000-abc123.png)`

## 配置选项

在 VSCode 设置中可以配置以下选项：

- `imageComment.saveDirectory`：图片保存目录名称（默认：`.image-comment`）
- `imageComment.commentTemplate`：注释模板（默认：`![image]({path})`，使用 `{path}` 作为路径占位符）
- `imageComment.useRelativePath`：是否使用相对路径（默认：`true`）

## 支持的注释格式

插件会根据文件类型自动选择合适的注释格式：

- **JavaScript/TypeScript/Java/C/C++/Go/Rust** 等：`// 注释` 或 `/* 注释 */`
- **Python**：`# 注释` 或 `""" 注释 """`
- **HTML**：`<!-- 注释 -->`
- **CSS**：`/* 注释 */`
- **SQL**：`-- 注释` 或 `/* 注释 */`
- **Shell**：`# 注释`
- 更多语言支持...

## 系统要求

- **macOS**：需要系统支持（无需额外工具）
- **Windows**：需要 PowerShell（系统自带）
- **Linux**：需要安装 `xclip`：
  ```bash
  # Ubuntu/Debian
  sudo apt-get install xclip

  # Fedora
  sudo dnf install xclip

  # Arch Linux
  sudo pacman -S xclip
  ```

## 开发

```bash
# 安装依赖
npm install

# 编译
npm run compile

# 监听模式编译
npm run watch

# 打包扩展
npm install -g vsce
vsce package
```

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

