import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { statSync } from 'fs';
import { ImageInfo } from './types';
import { MAX_IMAGE_SIZE, IMAGE_EXTENSIONS } from './constants';
import { messages } from '../nls';
import { getLogger, filterPowerShellStderr } from './logger';

const execAsync = promisify(exec);

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
  const outputChannel = getLogger();
  let tempFile: string | null = null;
  try {
    // 第一步：检测剪贴板中是否有文件路径（当用户复制文件时）
    // 使用 Base64 编码避免转义问题
    // 设置 $ProgressPreference 来抑制进度输出
    const filePathScript = `$ProgressPreference = 'SilentlyContinue'; Add-Type -AssemblyName System.Windows.Forms; $fileList = [System.Windows.Forms.Clipboard]::GetFileDropList(); if ($fileList.Count -gt 0) { Write-Output $fileList[0] }`;
    const encodedScript = Buffer.from(filePathScript, 'utf16le').toString(
      'base64',
    );

    try {
      const filePathResult = await execAsync(
        `powershell -NoProfile -EncodedCommand ${encodedScript}`,
      );

      // 调试信息：只记录真正的错误，过滤掉 CLIXML 进度信息
      const filteredStderr = filterPowerShellStderr(filePathResult.stderr);
      if (filteredStderr) {
        outputChannel?.appendLine(
          `[Image Comment] PowerShell stderr: ${filteredStderr}`,
        );
      }

      let filePath = filePathResult.stdout.trim();
      outputChannel?.appendLine(
        `[Image Comment] Detected file path: ${filePath || '(empty)'}`,
      );

      // 清理和验证文件路径（防止注入攻击）
      if (filePath) {
        // 移除控制字符和换行符
        filePath = filePath.replace(/[\x00-\x1F\x7F]/g, '').trim();
        // 路径规范化（处理 .. 和 . 以及多余的斜杠）
        filePath = path.normalize(filePath);
      }

      if (filePath) {
        try {
          if (!fs.existsSync(filePath)) {
            return null;
          }

          let stats;
          try {
            stats = statSync(filePath);
          } catch (statError) {
            const errorMessage =
              statError instanceof Error
                ? statError.message
                : String(statError);
            outputChannel?.appendLine(
              `[Image Comment] Failed to get file stats: ${errorMessage}`,
            );
            return null;
          }

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
        } catch (fileError) {
          const errorMessage =
            fileError instanceof Error ? fileError.message : String(fileError);
          outputChannel?.appendLine(
            `[Image Comment] File validation error: ${errorMessage}`,
          );
          return null;
        }
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

    // 使用 Base64 编码避免转义问题
    // 将临时文件路径作为变量嵌入脚本中
    // 设置 $ProgressPreference 来抑制进度输出
    const escapedTempFile = tempFile.replace(/'/g, "''").replace(/"/g, '`"');
    const psScript = `$ProgressPreference = 'SilentlyContinue'; $TempFile = "${escapedTempFile}"; Add-Type -AssemblyName System.Windows.Forms; $clipboard = [System.Windows.Forms.Clipboard]::GetImage(); if ($clipboard -ne $null) { $format = $clipboard.RawFormat.Guid; if ($format -eq [System.Drawing.Imaging.ImageFormat]::Png.Guid) { $ext = "png" } elseif ($format -eq [System.Drawing.Imaging.ImageFormat]::Jpeg.Guid) { $ext = "jpg" } elseif ($format -eq [System.Drawing.Imaging.ImageFormat]::Gif.Guid) { $ext = "gif" } elseif ($format -eq [System.Drawing.Imaging.ImageFormat]::Bmp.Guid) { $ext = "bmp" } else { $ext = "png" }; $tempFile = $TempFile -replace '\\.png$', ".$ext"; try { $clipboard.Save($tempFile); Write-Output $tempFile } catch { Write-Error $_.Exception.Message } }`;
    const encodedImageScript = Buffer.from(psScript, 'utf16le').toString(
      'base64',
    );

    let result;
    try {
      result = await execAsync(
        `powershell -NoProfile -EncodedCommand ${encodedImageScript}`,
      );
    } catch (execError) {
      const errorMessage =
        execError instanceof Error ? execError.message : String(execError);
      outputChannel?.appendLine(
        `[Image Comment] PowerShell execution failed: ${errorMessage}`,
      );
      if (execError instanceof Error && execError.stack) {
        outputChannel?.appendLine(
          `[Image Comment] PowerShell error stack: ${execError.stack}`,
        );
      }
      return null;
    }

    // 调试信息：只记录真正的错误，过滤掉 CLIXML 进度信息
    const filteredStderr = filterPowerShellStderr(result.stderr);
    if (filteredStderr) {
      outputChannel?.appendLine(
        `[Image Comment] PowerShell stderr: ${filteredStderr}`,
      );
    }

    let outputFile: string | null = null;
    try {
      outputFile = result.stdout.trim();

      // 清理和验证输出文件路径
      if (outputFile) {
        // 移除控制字符
        outputFile = outputFile.replace(/[\x00-\x1F\x7F]/g, '').trim();
        // 路径规范化
        outputFile = path.normalize(outputFile);
      }

      if (!outputFile || !fs.existsSync(outputFile)) {
        outputChannel?.appendLine(
          `[Image Comment] PowerShell output file not found or invalid: ${
            outputFile || 'empty'
          }`,
        );
        return null;
      }

      // 验证输出文件路径在临时目录内（防止路径遍历攻击）
      const normalizedTempDir = path.normalize(os.tmpdir());
      const normalizedOutputFile = path.normalize(outputFile);
      if (
        !normalizedOutputFile.startsWith(normalizedTempDir + path.sep) &&
        normalizedOutputFile !== normalizedTempDir
      ) {
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
      let stats;
      try {
        stats = statSync(outputFile);
      } catch (statError) {
        const errorMessage =
          statError instanceof Error ? statError.message : String(statError);
        outputChannel?.appendLine(
          `[Image Comment] Failed to get file stats: ${errorMessage}`,
        );
        return null;
      }

      if (stats.size > MAX_IMAGE_SIZE) {
        try {
          fs.unlinkSync(outputFile);
        } catch (unlinkError) {
          const errorMessage =
            unlinkError instanceof Error
              ? unlinkError.message
              : String(unlinkError);
          outputChannel?.appendLine(
            `[Image Comment] Failed to delete oversized file: ${errorMessage}`,
          );
        }
        vscode.window.showWarningMessage(
          `Image is too large (${(stats.size / 1024 / 1024).toFixed(
            2,
          )}MB). Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB.`,
        );
        return null;
      }

      const extension = path.extname(outputFile).slice(1).toLowerCase();
      if (!IMAGE_EXTENSIONS.includes(extension)) {
        try {
          fs.unlinkSync(outputFile);
        } catch (unlinkError) {
          const errorMessage =
            unlinkError instanceof Error
              ? unlinkError.message
              : String(unlinkError);
          outputChannel?.appendLine(
            `[Image Comment] Failed to delete unsupported file: ${errorMessage}`,
          );
        }
        return null;
      }

      // 直接返回临时文件路径，避免读取到内存
      return {
        tempFilePath: outputFile,
        extension,
      };
    } catch (fileError) {
      const errorMessage =
        fileError instanceof Error ? fileError.message : String(fileError);
      outputChannel?.appendLine(
        `[Image Comment] File processing error: ${errorMessage}`,
      );
      if (fileError instanceof Error && fileError.stack) {
        outputChannel?.appendLine(
          `[Image Comment] File processing stack: ${fileError.stack}`,
        );
      }
      // 清理可能创建的文件
      if (outputFile && fs.existsSync(outputFile)) {
        try {
          fs.unlinkSync(outputFile);
        } catch (cleanupError) {
          // 忽略清理错误
        }
      }
      return null;
    }
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
export async function detectImageFromClipboard(): Promise<ImageInfo | null> {
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

