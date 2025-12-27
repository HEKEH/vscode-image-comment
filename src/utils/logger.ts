import * as vscode from 'vscode';

// 日志输出通道
let outputChannel: vscode.OutputChannel | undefined;

export function initializeLogger(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('Image Comment');
  context.subscriptions.push(outputChannel);
}

export function getLogger(): vscode.OutputChannel | undefined {
  return outputChannel;
}

/**
 * 过滤 PowerShell 的 CLIXML 进度信息，只保留真正的错误
 */
export function filterPowerShellStderr(stderr: string): string | null {
  if (!stderr || !stderr.trim()) {
    return null;
  }

  // 过滤掉 CLIXML 格式的进度信息（以 #< CLIXML 开头）
  if (
    stderr.trim().startsWith('#< CLIXML') ||
    stderr.includes('<Objs Version=')
  ) {
    return null; // 这是进度信息，不是错误
  }

  // 过滤掉空行和只包含空白字符的内容
  const trimmed = stderr.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed;
}

