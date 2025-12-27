import * as vscode from 'vscode';
import { COMMENT_FORMATS } from './constants';

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
export function generateComment(
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

