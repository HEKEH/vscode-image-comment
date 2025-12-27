import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { renameSync } from 'fs';
import { ImageInfo } from '../utils/types';
import { messages } from '../nls';
import { generateFileName } from '../utils/file';
import { generateComment } from '../utils/comment';
import { getLogger } from '../utils/logger';

/**
 * 处理图片粘贴
 */
export async function handleImagePaste(
  editor: vscode.TextEditor,
  imageInfo: ImageInfo,
): Promise<void> {
  const outputChannel = getLogger();
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

    // 验证源文件存在
    if (!fs.existsSync(imageInfo.tempFilePath)) {
      throw new Error(`Source image file not found: ${imageInfo.tempFilePath}`);
    }

    try {
      if (isTempFile) {
        // 临时文件：直接移动到最终位置
        renameSync(imageInfo.tempFilePath, filePath);
      } else {
        // 原始文件：复制到最终位置（不移动原始文件）
        fs.copyFileSync(imageInfo.tempFilePath, filePath);
      }
    } catch (fileOpError) {
      const errorMessage =
        fileOpError instanceof Error
          ? fileOpError.message
          : String(fileOpError);
      outputChannel?.appendLine(
        `[Image Comment] Failed to save image file: ${errorMessage}`,
      );
      throw fileOpError;
    }

    // 验证目标文件已创建
    if (!fs.existsSync(filePath)) {
      throw new Error(`Target image file was not created: ${filePath}`);
    }

    // 生成注释路径
    let commentPath: string;
    try {
      if (useRelativePath) {
        // 使用相对于 workspace 根目录的相对路径
        const relativePath = path.relative(workspaceRoot, filePath);
        commentPath = relativePath.replace(/\\/g, '/');
      } else {
        commentPath = filePath;
      }
    } catch (pathError) {
      const errorMessage =
        pathError instanceof Error ? pathError.message : String(pathError);
      outputChannel?.appendLine(
        `[Image Comment] Failed to generate comment path: ${errorMessage}`,
      );
      throw pathError;
    }

    // 生成注释文本
    const languageId = editor.document.languageId;
    const comment = generateComment(commentPath, languageId, config);

    // 插入注释
    try {
      const position = editor.selection.active;
      await editor.edit((editBuilder: vscode.TextEditorEdit) => {
        editBuilder.insert(position, comment);
      });
    } catch (editError) {
      const errorMessage =
        editError instanceof Error ? editError.message : String(editError);
      outputChannel?.appendLine(
        `[Image Comment] Failed to insert comment: ${errorMessage}`,
      );
      // 即使插入失败，文件已经保存，所以不抛出错误
    }

    // 显示成功提示
    const statusMessage = messages.imageSaved(fileName);
    vscode.window.setStatusBarMessage(statusMessage, 5000);
  } catch (error) {
    // 捕获所有错误，包括 CodeExpectedError
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const errorStack = error instanceof Error ? error.stack : undefined;

    outputChannel?.appendLine(
      `[Image Comment] Error in handleImagePaste: [${errorName}] ${errorMessage}`,
    );
    if (errorStack) {
      outputChannel?.appendLine(`[Image Comment] Stack trace: ${errorStack}`);
    }

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
      } catch (cleanupError) {
        const cleanupErrorMessage =
          cleanupError instanceof Error
            ? cleanupError.message
            : String(cleanupError);
        outputChannel?.appendLine(
          `[Image Comment] Failed to cleanup temp file: ${cleanupErrorMessage}`,
        );
      }
    }

    // 如果是 CodeExpectedError（通常是 VS Code 尝试打开二进制文件导致的），静默处理
    if (errorName === 'CodeExpectedError') {
      outputChannel?.appendLine(
        `[Image Comment] CodeExpectedError caught (likely VS Code trying to open binary file), ignoring.`,
      );
      // 不显示错误消息给用户，因为这是 VS Code 内部行为
      return;
    }

    vscode.window.showErrorMessage(messages.failedToSaveImage(errorMessage));
    // 即使保存失败，也执行默认粘贴
    try {
      await vscode.commands.executeCommand(
        'editor.action.clipboardPasteAction',
      );
    } catch (pasteError) {
      // 忽略粘贴命令的错误
    }
  }
}

