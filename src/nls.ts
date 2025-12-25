import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import defaultMessages from './nls.json';

// 简单的占位符替换函数
function replacePlaceholders(text: string, ...args: any[]): string {
  let result = text;
  args.forEach((arg, index) => {
    result = result.replace(`{${index}}`, String(arg));
  });
  return result;
}

// 加载本地化消息
let localizedMessages: Record<string, string> | null = null;

function loadLocalizedMessages(): Record<string, string> {
  if (localizedMessages) {
    return localizedMessages;
  }

  try {
    // 获取 VS Code 的语言设置
    const locale = vscode.env.language;

    // 确定要加载的语言文件
    let localeFile = 'nls.json'; // 默认英文
    if (locale.startsWith('zh-CN') || locale === 'zh-cn') {
      localeFile = 'nls.zh-cn.json';
    } else if (locale.startsWith('zh-TW') || locale === 'zh-tw') {
      localeFile = 'nls.zh-tw.json';
    }

    // 尝试加载对应的语言文件
    const nlsPath = path.join(__dirname, localeFile);
    if (fs.existsSync(nlsPath)) {
      try {
        const content = fs.readFileSync(nlsPath, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object') {
          localizedMessages = parsed as Record<string, string>;
          return localizedMessages;
        }
      } catch (error) {
        console.warn(`Failed to load ${localeFile}, using default messages:`, error);
      }
    }
  } catch (error) {
    console.warn('Failed to load localized messages, using default messages:', error);
  }

  // 如果加载失败，使用默认消息
  localizedMessages = defaultMessages;
  return localizedMessages;
}

// 本地化函数
function localize(key: string, defaultValue: string, ...args: any[]): string {
  try {
    const messages = loadLocalizedMessages();
    const message = messages[key] || defaultValue;
    const result = replacePlaceholders(message, ...args);
    // 调试：如果结果为空，记录警告
    if (!result || result.trim() === '') {
      console.warn(`[nls] Empty result for key "${key}", defaultValue: "${defaultValue}"`);
    }
    return result;
  } catch (error) {
    console.error(`[nls] Error localizing key "${key}":`, error);
    return replacePlaceholders(defaultValue, ...args);
  }
}

// 导出本地化函数，使用 nls.json 中的默认值
export const messages = {
  noWorkspaceFolder: () =>
    localize('message.noWorkspaceFolder', defaultMessages['message.noWorkspaceFolder']),
  failedToSaveImage: (error: string) =>
    localize('message.failedToSaveImage', defaultMessages['message.failedToSaveImage'], error),
  noActiveEditor: () =>
    localize('message.noActiveEditor', defaultMessages['message.noActiveEditor']),
  imageTooLarge: (size: string, maxSize: string) =>
    localize('message.imageTooLarge', defaultMessages['message.imageTooLarge'], size, maxSize),
  noImageFound: () =>
    localize('message.noImageFound', defaultMessages['message.noImageFound']),
  detectingImage: () =>
    localize('message.detectingImage', defaultMessages['message.detectingImage']),
  imageSaved: (fileName: string) =>
    localize('message.imageSaved', defaultMessages['message.imageSaved'], fileName),
};
