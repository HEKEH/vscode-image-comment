import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ImageInfo {
  data: Buffer;
  extension: string;
}

// 支持的图片格式
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];

// 文件类型到注释格式的映射
const COMMENT_FORMATS: Record<string, { single: string; multi: { start: string; end: string } }> = {
  'javascript': { single: '//', multi: { start: '/*', end: '*/' } },
  'typescript': { single: '//', multi: { start: '/*', end: '*/' } },
  'javascriptreact': { single: '//', multi: { start: '/*', end: '*/' } },
  'typescriptreact': { single: '//', multi: { start: '/*', end: '*/' } },
  'python': { single: '#', multi: { start: '"""', end: '"""' } },
  'java': { single: '//', multi: { start: '/*', end: '*/' } },
  'c': { single: '//', multi: { start: '/*', end: '*/' } },
  'cpp': { single: '//', multi: { start: '/*', end: '*/' } },
  'csharp': { single: '//', multi: { start: '/*', end: '*/' } },
  'go': { single: '//', multi: { start: '/*', end: '*/' } },
  'rust': { single: '//', multi: { start: '/*', end: '*/' } },
  'ruby': { single: '#', multi: { start: '=begin', end: '=end' } },
  'php': { single: '//', multi: { start: '/*', end: '*/' } },
  'swift': { single: '//', multi: { start: '/*', end: '*/' } },
  'kotlin': { single: '//', multi: { start: '/*', end: '*/' } },
  'scala': { single: '//', multi: { start: '/*', end: '*/' } },
  'html': { single: '', multi: { start: '<!--', end: '-->' } },
  'css': { single: '', multi: { start: '/*', end: '*/' } },
  'scss': { single: '//', multi: { start: '/*', end: '*/' } },
  'less': { single: '//', multi: { start: '/*', end: '*/' } },
  'sql': { single: '--', multi: { start: '/*', end: '*/' } },
  'shellscript': { single: '#', multi: { start: ': <<\'EOF\'', end: 'EOF' } },
  'yaml': { single: '#', multi: { start: '', end: '' } },
  'json': { single: '', multi: { start: '/*', end: '*/' } },
};

/**
 * 检测剪贴板中是否为图片（macOS）
 */
async function detectImageFromClipboardMac(): Promise<ImageInfo | null> {
  let tempFile: string | null = null;
  try {
    tempFile = path.join(require('os').tmpdir(), `vscode-image-${Date.now()}.png`);
    const escapedPath = tempFile.replace(/\\/g, '/').replace(/'/g, "\\'");

    // 使用 AppleScript 尝试读取剪贴板中的图片
    // 先尝试 PNG 格式
    const pngScript = `try
  set imageData to (the clipboard as «class PNGf»)
  set filePath to POSIX file "${escapedPath}"
  set fileRef to open for access file filePath with write permission
  write imageData to fileRef
  close access fileRef
  return "png"
on error
  return "error"
end try`;

    let result = await execAsync(`osascript -e '${pngScript}'`);
    let format = result.stdout.trim();

    // 如果 PNG 失败，尝试 JPEG
    if (format === 'error') {
      const jpgScript = `try
  set imageData to (the clipboard as «class JPEG»)
  set filePath to POSIX file "${escapedPath}"
  set fileRef to open for access file filePath with write permission
  write imageData to fileRef
  close access fileRef
  return "jpg"
on error
  return "error"
end try`;
      result = await execAsync(`osascript -e '${jpgScript}'`);
      format = result.stdout.trim();
    }

    if (format === 'error' || !tempFile || !fs.existsSync(tempFile)) {
      return null;
    }

    const imageData = fs.readFileSync(tempFile);
    const extension = format.toLowerCase();
    fs.unlinkSync(tempFile);
    tempFile = null;

    if (!IMAGE_EXTENSIONS.includes(extension)) {
      return null;
    }

    return {
      data: imageData,
      extension
    };
  } catch (error) {
    // 清理临时文件
    if (tempFile && fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch {}
    }
    return null;
  }
}

/**
 * 检测剪贴板中是否为图片（Windows）
 */
async function detectImageFromClipboardWindows(): Promise<ImageInfo | null> {
  try {
    // 使用 PowerShell 检测剪贴板中的图片
    const os = require('os');
    const tempFile = path.join(os.tmpdir(), `vscode-image-${Date.now()}.png`);
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms
      $clipboard = [System.Windows.Forms.Clipboard]::GetImage()
      if ($clipboard -ne $null) {
        $format = $clipboard.RawFormat.Guid
        if ($format -eq [System.Drawing.Imaging.ImageFormat]::Png.Guid) {
          $ext = "png"
        } elseif ($format -eq [System.Drawing.Imaging.ImageFormat]::Jpeg.Guid) {
          $ext = "jpg"
        } elseif ($format -eq [System.Drawing.Imaging.ImageFormat]::Gif.Guid) {
          $ext = "gif"
        } elseif ($format -eq [System.Drawing.Imaging.ImageFormat]::Bmp.Guid) {
          $ext = "bmp"
        } else {
          $ext = "png"
        }
        $tempFile = "${tempFile.replace(/\\/g, '\\\\')}"
        $tempFile = $tempFile -replace '\\.png$', ".$ext"
        $clipboard.Save($tempFile)
        Write-Output $tempFile
      }
    `;

    const result = await execAsync(`powershell -NoProfile -Command "${psScript.replace(/"/g, '`"')}"`);
    const outputFile = result.stdout.trim();

    if (!outputFile || !fs.existsSync(outputFile)) {
      return null;
    }

    const imageData = fs.readFileSync(outputFile);
    const extension = path.extname(outputFile).slice(1).toLowerCase();
    fs.unlinkSync(outputFile);

    if (!IMAGE_EXTENSIONS.includes(extension)) {
      return null;
    }

    return {
      data: imageData,
      extension
    };
  } catch (error) {
    return null;
  }
}

/**
 * 检测剪贴板中是否为图片（Linux）
 */
async function detectImageFromClipboardLinux(): Promise<ImageInfo | null> {
  try {
    // Linux 使用 xclip 检测剪贴板中的图片
    // 首先检查是否有图片数据
    const checkResult = await execAsync('xclip -selection clipboard -t TARGETS -o 2>/dev/null || echo ""');
    const targets = checkResult.stdout;

    if (!targets.includes('image/png') && !targets.includes('image/jpeg') && !targets.includes('image/gif')) {
      return null;
    }

    // 确定格式
    let format = 'png';
    let mimeType = 'image/png';
    if (targets.includes('image/jpeg')) {
      format = 'jpg';
      mimeType = 'image/jpeg';
    } else if (targets.includes('image/gif')) {
      format = 'gif';
      mimeType = 'image/gif';
    }

    const os = require('os');
    const tempFile = path.join(os.tmpdir(), `vscode-image-${Date.now()}.${format}`);
    await execAsync(`xclip -selection clipboard -t ${mimeType} -o > "${tempFile}" 2>/dev/null`);

    if (!fs.existsSync(tempFile)) {
      return null;
    }

    const imageData = fs.readFileSync(tempFile);
    fs.unlinkSync(tempFile);

    return {
      data: imageData,
      extension: format
    };
  } catch (error) {
    return null;
  }
}

/**
 * 根据平台检测剪贴板中的图片
 */
async function detectImageFromClipboard(): Promise<ImageInfo | null> {
  const platform = process.platform;

  if (platform === 'darwin') {
    return await detectImageFromClipboardMac();
  } else if (platform === 'win32') {
    return await detectImageFromClipboardWindows();
  } else if (platform === 'linux') {
    return await detectImageFromClipboardLinux();
  }

  return null;
}

/**
 * 生成唯一的文件名
 */
function generateFileName(extension: string): string {
  const timestamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '-');
  const random = Math.random().toString(36).substring(2, 8);
  return `image-${timestamp}-${random}.${extension}`;
}

/**
 * 获取注释格式
 */
function getCommentFormat(languageId: string): { single: string; multi: { start: string; end: string } } {
  return COMMENT_FORMATS[languageId] || { single: '//', multi: { start: '/*', end: '*/' } };
}

/**
 * 生成注释文本
 */
function generateComment(imagePath: string, languageId: string, config: vscode.WorkspaceConfiguration): string {
  const template = config.get<string>('commentTemplate', '![image]({path})');
  const commentText = template.replace('{path}', imagePath);

  const format = getCommentFormat(languageId);

  // 如果注释文本包含换行，使用多行注释
  if (commentText.includes('\n') || format.single === '') {
    return `${format.multi.start} ${commentText} ${format.multi.end}`;
  }

  return `${format.single} ${commentText}`;
}

/**
 * 处理图片粘贴
 */
async function handleImagePaste(editor: vscode.TextEditor, imageInfo: ImageInfo): Promise<void> {
  const config = vscode.workspace.getConfiguration('imageComment');
  const saveDir = config.get<string>('saveDirectory', '.image-comment');
  const useRelativePath = config.get<boolean>('useRelativePath', true);

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder found');
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;
  const imageDir = path.join(workspaceRoot, saveDir);

  // 创建目录（如果不存在）
  if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir, { recursive: true });
  }

  // 生成文件名并保存
  const fileName = generateFileName(imageInfo.extension);
  const filePath = path.join(imageDir, fileName);

  try {
    fs.writeFileSync(filePath, imageInfo.data);

    // 生成注释路径
    let commentPath: string;
    if (useRelativePath) {
      // 使用相对于 workspace 根目录的相对路径
      const relativePath = path.relative(workspaceRoot, filePath);
      commentPath = relativePath.replace(/\\/g, '/');
    } else {
      commentPath = filePath;
    }

    // 生成注释文本
    const languageId = editor.document.languageId;
    const comment = generateComment(commentPath, languageId, config);

    // 插入注释
    const position = editor.selection.active;
    await editor.edit((editBuilder: vscode.TextEditorEdit) => {
      editBuilder.insert(position, comment);
    });

    // 显示成功提示
    vscode.window.setStatusBarMessage(`Image saved: ${fileName}`, 3000);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to save image: ${error}`);
    // 即使保存失败，也执行默认粘贴
    await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
  }
}

/**
 * 处理粘贴命令
 */
async function handlePasteCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    // 没有活动编辑器，执行默认粘贴
    await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
    return;
  }

  // 检测剪贴板中是否有图片（带超时保护）
  const imageDetectionPromise = detectImageFromClipboard();
  const timeoutPromise = new Promise<ImageInfo | null>((resolve) => {
    const timer = global.setTimeout(() => resolve(null), 1000); // 1秒超时
    // 清理定时器（虽然 Promise 完成后会自动清理，但显式清理更安全）
    imageDetectionPromise.finally(() => clearTimeout(timer));
  });

  const imageInfo = await Promise.race([imageDetectionPromise, timeoutPromise]);

  if (imageInfo) {
    // 是图片，处理图片粘贴
    await handleImagePaste(editor, imageInfo);
  } else {
    // 不是图片，执行默认粘贴
    await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Image Comment extension is now active!');

  // 注册粘贴命令
  const pasteCommand = vscode.commands.registerCommand('imageComment.paste', handlePasteCommand);
  context.subscriptions.push(pasteCommand);
}

export function deactivate() {}

