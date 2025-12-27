import * as vscode from 'vscode';
import { detectImageFromClipboard } from './utils/clipboard';
import { handleImagePaste } from './handlers/imagePaste';
import { initializeLogger } from './utils/logger';
import { messages } from './nls';
import { ImageInfo } from './utils/types';

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
    const timer = global.setTimeout(() => resolve(null), 10000); // 10秒超时
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

  // 初始化日志记录器
  initializeLogger(context);

  // 注册粘贴图片命令（从右键菜单触发）
  const pasteImageCommand = vscode.commands.registerCommand(
    'imageComment.pasteImage',
    handlePasteImageCommand,
  );
  context.subscriptions.push(pasteImageCommand);
}

export function deactivate() {}
