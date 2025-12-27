import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { statSync, renameSync } from 'fs';

import { messages } from './nls';

const execAsync = promisify(exec);

// 日志输出通道
let outputChannel: vscode.OutputChannel | undefined;

// 最大图片大小限制（50MB）
const MAX_IMAGE_SIZE = 50 * 1024 * 1024;

interface ImageInfo {
  tempFilePath: string;
  extension: string;
}

// 支持的图片格式
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];

// 文件类型到注释格式的映射
const COMMENT_FORMATS: Record<
  string,
  { single: string; multi: { start: string; end: string } }
> = {
  javascript: { single: '//', multi: { start: '/*', end: '*/' } },
  typescript: { single: '//', multi: { start: '/*', end: '*/' } },
  javascriptreact: { single: '//', multi: { start: '/*', end: '*/' } },
  typescriptreact: { single: '//', multi: { start: '/*', end: '*/' } },
  python: { single: '#', multi: { start: '"""', end: '"""' } },
  java: { single: '//', multi: { start: '/*', end: '*/' } },
  c: { single: '//', multi: { start: '/*', end: '*/' } },
  cpp: { single: '//', multi: { start: '/*', end: '*/' } },
  csharp: { single: '//', multi: { start: '/*', end: '*/' } },
  go: { single: '//', multi: { start: '/*', end: '*/' } },
  rust: { single: '//', multi: { start: '/*', end: '*/' } },
  ruby: { single: '#', multi: { start: '=begin', end: '=end' } },
  php: { single: '//', multi: { start: '/*', end: '*/' } },
  swift: { single: '//', multi: { start: '/*', end: '*/' } },
  kotlin: { single: '//', multi: { start: '/*', end: '*/' } },
  scala: { single: '//', multi: { start: '/*', end: '*/' } },
  html: { single: '', multi: { start: '<!--', end: '-->' } },
  css: { single: '', multi: { start: '/*', end: '*/' } },
  scss: { single: '//', multi: { start: '/*', end: '*/' } },
  less: { single: '//', multi: { start: '/*', end: '*/' } },
  sql: { single: '--', multi: { start: '/*', end: '*/' } },
  shellscript: { single: '#', multi: { start: ": <<'EOF'", end: 'EOF' } },
  yaml: { single: '#', multi: { start: '', end: '' } },
  json: { single: '', multi: { start: '/*', end: '*/' } },
};

/**
 * 检测剪贴板中是否为图片（macOS）
 * 优化版本：先检测文件路径引用，再检测图片数据
 */
async function detectImageFromClipboardMac(): Promise<ImageInfo | null> {
  let tempFile: string | null = null;
  try {
    // 第一步：检测剪贴板中是否有文件路径引用（当用户复制文件时）
    // 检测文件路径：通过 Finder 获取当前选中的文件
    // 这是最可靠的方法，因为当用户在 Finder 中复制文件时，文件通常仍处于选中状态
    const filePathScript = `try
  tell application "Finder"
    set selectedFiles to selection as alias list
    if (count of selectedFiles) > 0 then
      set filePath to POSIX path of (item 1 of selectedFiles)
      return filePath
    end if
  end tell
on error
  -- Finder 方法失败，返回 no-file，继续检测图片数据
end try

return "no-file"`;

    const filePathResult = await execAsync(`osascript -e '${filePathScript}'`, {
      maxBuffer: 10240,
    });
    let filePath = filePathResult.stdout.trim();

    // 如果检测到文件路径，检查是否是图片文件
    if (filePath && filePath !== 'no-file') {
      let actualPath = filePath;

      // 1. 处理 file:// URL（使用 URL 对象正确解析）
      if (actualPath.startsWith('file://')) {
        try {
          // 使用 URL 对象解析，自动处理 URL 编码
          const url = new URL(actualPath);
          actualPath = url.pathname;
          // 处理 macOS 的本地路径格式（file:///）
          if (actualPath.startsWith('//')) {
            actualPath = actualPath.substring(2);
          }
        } catch (e) {
          // URL 解析失败，使用简单替换作为回退
          actualPath = actualPath.replace(/^file:\/\//, '');
          // 解码 URL 编码（处理空格等）
          try {
            actualPath = decodeURIComponent(actualPath);
          } catch {
            // 如果解码失败，至少处理常见的 %20
            actualPath = actualPath.replace(/%20/g, ' ');
          }
        }
      }

      // 2. 移除所有控制字符和换行符（包括 \x00-\x1F 和 \x7F）
      actualPath = actualPath.replace(/[\x00-\x1F\x7F]/g, '').trim();

      // 3. 路径规范化（处理 .. 和 . 以及多余的斜杠）
      actualPath = path.normalize(actualPath);

      // 4. 验证文件存在且是文件（不是目录）
      if (fs.existsSync(actualPath)) {
        const stats = statSync(actualPath);

        // 检查是否为文件（不是目录、符号链接等）
        if (!stats.isFile()) {
          return null; // 不是普通文件，跳过处理
        }

        // 5. 检查文件扩展名
        const ext = path.extname(actualPath).slice(1).toLowerCase();
        if (!IMAGE_EXTENSIONS.includes(ext)) {
          return null; // 不是支持的图片格式
        }

        // 6. 检查文件大小
        if (stats.size > MAX_IMAGE_SIZE) {
          vscode.window.showWarningMessage(
            messages.imageTooLarge(
              (stats.size / 1024 / 1024).toFixed(2),
              (MAX_IMAGE_SIZE / 1024 / 1024).toString(),
            ),
          );
          return null;
        }

        // 7. 直接返回原始文件路径（作为临时文件路径）
        return {
          tempFilePath: actualPath,
          extension: ext,
        };
      }
    }

    // 第二步：如果没有文件路径，检测剪贴板中是否有图片数据（截图等）
    const detectScript = `try
  set imageData to (the clipboard as «class PNGf»)
  return "png"
on error
  try
    set imageData to (the clipboard as «class JPEG»)
    return "jpg"
  on error
    try
      set imageData to (the clipboard as «class GIFf»)
      return "gif"
    on error
      return "error"
    end try
  end try
end try`;

    const detectResult = await execAsync(`osascript -e '${detectScript}'`, {
      maxBuffer: 1024,
    });
    const format = detectResult.stdout.trim().toLowerCase();

    if (format === 'error' || !IMAGE_EXTENSIONS.includes(format)) {
      return null;
    }

    // 第二步：将图片数据保存到临时文件（AppleScript 的限制，无法直接输出到 stdout）
    const os = require('os');
    tempFile = path.join(
      os.tmpdir(),
      `vscode-image-${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}.${format}`,
    );

    const readScript =
      format === 'png'
        ? `the clipboard as «class PNGf»`
        : format === 'jpg' || format === 'jpeg'
        ? `the clipboard as «class JPEG»`
        : `the clipboard as «class GIFf»`;

    const escapedPath = tempFile.replace(/'/g, "\\'");
    const saveScript = `try
  set imageData to ${readScript}
  set filePath to POSIX file "${escapedPath}"
  set fileRef to open for access file filePath with write permission
  write imageData to fileRef
  close access fileRef
  return "success"
on error
  return "error"
end try`;

    const saveResult = await execAsync(`osascript -e '${saveScript}'`);

    if (
      saveResult.stdout.trim() !== 'success' ||
      !tempFile ||
      !fs.existsSync(tempFile)
    ) {
      if (tempFile && fs.existsSync(tempFile)) {
        try {
          fs.unlinkSync(tempFile);
        } catch {}
      }
      return null;
    }

    // 第三步：检查文件大小，防止处理过大的文件
    const stats = statSync(tempFile);
    if (stats.size > MAX_IMAGE_SIZE) {
      fs.unlinkSync(tempFile);
      vscode.window.showWarningMessage(
        messages.imageTooLarge(
          (stats.size / 1024 / 1024).toFixed(2),
          (MAX_IMAGE_SIZE / 1024 / 1024).toString(),
        ),
      );
      return null;
    }

    // 直接返回临时文件路径，避免读取到内存
    return {
      tempFilePath: tempFile,
      extension: format,
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
 * 优化版本：先检测文件路径，再检测图片数据
 */
async function detectImageFromClipboardWindows(): Promise<ImageInfo | null> {
  let tempFile: string | null = null;
  try {
    // 第一步：检测剪贴板中是否有文件路径（当用户复制文件时）
    const filePathScript = `
      Add-Type -AssemblyName System.Windows.Forms
      $fileList = [System.Windows.Forms.Clipboard]::GetFileDropList()
      if ($fileList.Count -gt 0) {
        $filePath = $fileList[0]
        Write-Output $filePath
      }
    `;

    try {
      const filePathResult = await execAsync(
        `powershell -NoProfile -Command "${filePathScript.replace(/"/g, '`"')}"`,
      );
      let filePath = filePathResult.stdout.trim();

      // 清理和验证文件路径（防止注入攻击）
      if (filePath) {
        // 移除控制字符和换行符
        filePath = filePath.replace(/[\x00-\x1F\x7F]/g, '').trim();
        // 路径规范化（处理 .. 和 . 以及多余的斜杠）
        filePath = path.normalize(filePath);
      }

      if (filePath && fs.existsSync(filePath)) {
        const stats = statSync(filePath);
        if (!stats.isFile()) {
          return null;
        }

        const ext = path.extname(filePath).slice(1).toLowerCase();
        if (!IMAGE_EXTENSIONS.includes(ext)) {
          return null;
        }

        if (stats.size > MAX_IMAGE_SIZE) {
          vscode.window.showWarningMessage(
            messages.imageTooLarge(
              (stats.size / 1024 / 1024).toFixed(2),
              (MAX_IMAGE_SIZE / 1024 / 1024).toString(),
            ),
          );
          return null;
        }

        return {
          tempFilePath: filePath,
          extension: ext,
        };
      }
    } catch (e) {
      // 文件路径检测失败，继续检测图片数据
      const errorMessage = e instanceof Error ? e.message : String(e);
      outputChannel?.appendLine(
        `[Image Comment] File path detection failed: ${errorMessage}`,
      );
    }

    // 第二步：检测剪贴板中的图片数据
    const os = require('os');
    tempFile = path.join(os.tmpdir(), `vscode-image-${Date.now()}.png`);

    // 使用参数化方式传递文件路径，避免字符串插值注入风险
    const psScript = `
      param([string]$TempFile)
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
        $tempFile = $TempFile -replace '\\.png$', ".$ext"
        $clipboard.Save($tempFile)
        Write-Output $tempFile
      }
    `;

    // 安全地转义 PowerShell 参数中的双引号
    const escapedTempFile = tempFile.replace(/"/g, '`"');
    let result;
    try {
      result = await execAsync(
        `powershell -NoProfile -Command "${psScript.replace(/"/g, '`"')}" -ArgumentList "${escapedTempFile}"`,
      );
    } catch (execError) {
      const errorMessage = execError instanceof Error ? execError.message : String(execError);
      outputChannel?.appendLine(
        `[Image Comment] PowerShell execution failed: ${errorMessage}`,
      );
      if (execError instanceof Error && execError.stack) {
        outputChannel?.appendLine(`[Image Comment] PowerShell error stack: ${execError.stack}`);
      }
      return null;
    }
    let outputFile = result.stdout.trim();

    // 清理和验证输出文件路径
    if (outputFile) {
      // 移除控制字符
      outputFile = outputFile.replace(/[\x00-\x1F\x7F]/g, '').trim();
      // 路径规范化
      outputFile = path.normalize(outputFile);
    }

    if (!outputFile || !fs.existsSync(outputFile)) {
      outputChannel?.appendLine(
        `[Image Comment] PowerShell output file not found or invalid: ${outputFile || 'empty'}`,
      );
      return null;
    }

    // 验证输出文件路径在临时目录内（防止路径遍历攻击）
    const normalizedTempDir = path.normalize(os.tmpdir());
    const normalizedOutputFile = path.normalize(outputFile);
    if (!normalizedOutputFile.startsWith(normalizedTempDir + path.sep) &&
        normalizedOutputFile !== normalizedTempDir) {
      // 文件不在临时目录中，可能是安全问题，删除并返回
      outputChannel?.appendLine(
        `[Image Comment] Security warning: Output file is outside temp directory. TempDir: ${normalizedTempDir}, OutputFile: ${normalizedOutputFile}`,
      );
      try {
        if (fs.existsSync(normalizedOutputFile)) {
          fs.unlinkSync(normalizedOutputFile);
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        outputChannel?.appendLine(
          `[Image Comment] Failed to delete suspicious file: ${errorMessage}`,
        );
      }
      return null;
    }

    // 检查文件大小
    const stats = statSync(outputFile);
    if (stats.size > MAX_IMAGE_SIZE) {
      fs.unlinkSync(outputFile);
      vscode.window.showWarningMessage(
        `Image is too large (${(stats.size / 1024 / 1024).toFixed(
          2,
        )}MB). Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB.`,
      );
      return null;
    }

    const extension = path.extname(outputFile).slice(1).toLowerCase();
    if (!IMAGE_EXTENSIONS.includes(extension)) {
      fs.unlinkSync(outputFile);
      return null;
    }

    // 直接返回临时文件路径，避免读取到内存
    return {
      tempFilePath: outputFile,
      extension,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    outputChannel?.appendLine(
      `[Image Comment] Error in detectImageFromClipboardWindows: ${errorMessage}`,
    );
    if (errorStack) {
      outputChannel?.appendLine(`[Image Comment] Stack trace: ${errorStack}`);
    }
    if (tempFile && fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch (cleanupError) {
        const cleanupErrorMessage =
          cleanupError instanceof Error
            ? cleanupError.message
            : String(cleanupError);
        outputChannel?.appendLine(
          `[Image Comment] Failed to cleanup temp file ${tempFile}: ${cleanupErrorMessage}`,
        );
      }
    }
    return null;
  }
}

/**
 * 检测剪贴板中是否为图片（Linux）
 * 优化版本：先检测文件路径，再检测图片数据
 */
async function detectImageFromClipboardLinux(): Promise<ImageInfo | null> {
  let tempFile: string | null = null;
  try {
    // 第一步：检测剪贴板中是否有文件路径（当用户复制文件时）
    // Linux 使用 xclip 检测文件路径
    try {
      const filePathCheck = await execAsync(
        'xclip -selection clipboard -t text/uri-list -o 2>/dev/null || echo ""',
      );
      let filePath = filePathCheck.stdout.trim();

      if (filePath) {
        // 处理 file:// URL
        if (filePath.startsWith('file://')) {
          try {
            const url = new URL(filePath);
            filePath = url.pathname;
            if (filePath.startsWith('//')) {
              filePath = filePath.substring(2);
            }
          } catch (e) {
            filePath = filePath.replace(/^file:\/\//, '');
            try {
              filePath = decodeURIComponent(filePath);
            } catch {
              filePath = filePath.replace(/%20/g, ' ');
            }
          }
        }

        filePath = filePath.replace(/[\x00-\x1F\x7F]/g, '').trim();
        filePath = path.normalize(filePath);

        if (filePath && fs.existsSync(filePath)) {
          const stats = statSync(filePath);
          if (!stats.isFile()) {
            return null;
          }

          const ext = path.extname(filePath).slice(1).toLowerCase();
          if (!IMAGE_EXTENSIONS.includes(ext)) {
            return null;
          }

          if (stats.size > MAX_IMAGE_SIZE) {
            vscode.window.showWarningMessage(
              `Image is too large (${(stats.size / 1024 / 1024).toFixed(
                2,
              )}MB). Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB.`,
            );
            return null;
          }

          return {
            tempFilePath: filePath,
            extension: ext,
          };
        }
      }
    } catch (e) {
      // 文件路径检测失败，继续检测图片数据
    }

    // 第二步：检测剪贴板中的图片数据
    // Linux 使用 xclip 检测剪贴板中的图片
    // 首先检查是否有图片数据
    const checkResult = await execAsync(
      'xclip -selection clipboard -t TARGETS -o 2>/dev/null || echo ""',
    );
    const targets = checkResult.stdout;

    if (
      !targets.includes('image/png') &&
      !targets.includes('image/jpeg') &&
      !targets.includes('image/gif')
    ) {
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
    tempFile = path.join(os.tmpdir(), `vscode-image-${Date.now()}.${format}`);
    await execAsync(
      `xclip -selection clipboard -t ${mimeType} -o > "${tempFile}" 2>/dev/null`,
    );

    if (!tempFile || !fs.existsSync(tempFile)) {
      return null;
    }

    // 检查文件大小
    const stats = statSync(tempFile);
    if (stats.size > MAX_IMAGE_SIZE) {
      fs.unlinkSync(tempFile);
      vscode.window.showWarningMessage(
        `Image is too large (${(stats.size / 1024 / 1024).toFixed(
          2,
        )}MB). Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB.`,
      );
      return null;
    }

    // 直接返回临时文件路径，避免读取到内存
    return {
      tempFilePath: tempFile,
      extension: format,
    };
  } catch (error) {
    if (tempFile && fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch {}
    }
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
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '-');
  const random = Math.random().toString(36).substring(2, 8);
  return `image-${timestamp}-${random}.${extension}`;
}

/**
 * 获取注释格式
 */
function getCommentFormat(languageId: string): {
  single: string;
  multi: { start: string; end: string };
} {
  return (
    COMMENT_FORMATS[languageId] || {
      single: '//',
      multi: { start: '/*', end: '*/' },
    }
  );
}

/**
 * 生成注释文本
 */
function generateComment(
  imagePath: string,
  languageId: string,
  config: vscode.WorkspaceConfiguration,
): string {
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
async function handleImagePaste(
  editor: vscode.TextEditor,
  imageInfo: ImageInfo,
): Promise<void> {
  const config = vscode.workspace.getConfiguration('imageComment');
  const saveDir = config.get<string>('saveDirectory', '.image-comment');
  const useRelativePath = config.get<boolean>('useRelativePath', true);

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(
    editor.document.uri,
  );
  if (!workspaceFolder) {
    // 清理临时文件（只删除临时文件，不删除原始文件）
    const os = require('os');
    const tempDir = os.tmpdir();
    if (
      imageInfo.tempFilePath.startsWith(tempDir) &&
      fs.existsSync(imageInfo.tempFilePath)
    ) {
      try {
        fs.unlinkSync(imageInfo.tempFilePath);
      } catch {}
    }
    vscode.window.showErrorMessage(messages.noWorkspaceFolder());
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;
  const imageDir = path.join(workspaceRoot, saveDir);

  // 创建目录（如果不存在）
  if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir, { recursive: true });
  }

  // 生成文件名
  const fileName = generateFileName(imageInfo.extension);
  const filePath = path.join(imageDir, fileName);

  try {
    // 检查是否是临时文件（在系统临时目录中）还是原始文件路径
    const os = require('os');
    const tempDir = os.tmpdir();
    const isTempFile = imageInfo.tempFilePath.startsWith(tempDir);

    if (isTempFile) {
      // 临时文件：直接移动到最终位置
      renameSync(imageInfo.tempFilePath, filePath);
    } else {
      // 原始文件：复制到最终位置（不移动原始文件）
      fs.copyFileSync(imageInfo.tempFilePath, filePath);
    }

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
    const statusMessage = messages.imageSaved(fileName);
    vscode.window.setStatusBarMessage(statusMessage, 5000);
  } catch (error) {
    // 清理临时文件（如果移动/复制失败）
    // 只删除临时文件，不删除原始文件
    const os = require('os');
    const tempDir = os.tmpdir();
    if (
      imageInfo.tempFilePath.startsWith(tempDir) &&
      fs.existsSync(imageInfo.tempFilePath)
    ) {
      try {
        fs.unlinkSync(imageInfo.tempFilePath);
      } catch {}
    }
    vscode.window.showErrorMessage(messages.failedToSaveImage(String(error)));
    // 即使保存失败，也执行默认粘贴
    await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
  }
}

/**
 * 处理粘贴图片命令（从右键菜单触发）
 */
async function handlePasteImageCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage(messages.noActiveEditor());
    return;
  }

  // 显示进度提示
  vscode.window.setStatusBarMessage(messages.detectingImage(), 1000);

  // 检测剪贴板中是否有图片（带超时保护）
  const imageDetectionPromise = detectImageFromClipboard();
  const timeoutPromise = new Promise<ImageInfo | null>(resolve => {
    const timer = global.setTimeout(() => resolve(null), 2000); // 2秒超时
    imageDetectionPromise.finally(() => clearTimeout(timer));
  });

  const imageInfo = await Promise.race([imageDetectionPromise, timeoutPromise]);

  if (imageInfo) {
    // 是图片，处理图片粘贴
    await handleImagePaste(editor, imageInfo);
  } else {
    // 不是图片，显示提示信息
    vscode.window.showInformationMessage(messages.noImageFound());
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Image Comment extension is now active!');

  // 创建输出通道用于日志记录
  outputChannel = vscode.window.createOutputChannel('Image Comment');
  context.subscriptions.push(outputChannel);

  // 注册粘贴图片命令（从右键菜单触发）
  const pasteImageCommand = vscode.commands.registerCommand(
    'imageComment.pasteImage',
    handlePasteImageCommand,
  );
  context.subscriptions.push(pasteImageCommand);
}

export function deactivate() {}
