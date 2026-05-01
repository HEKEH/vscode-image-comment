import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IMAGE_EXTENSIONS } from './constants';
import { getLogger } from './logger';

export interface ImageMatchResult {
  fullMatch: string;
  imagePath: string;
  range: vscode.Range;
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createPatternFromTemplate(template: string): RegExp | null {
  const pathPlaceholder = '{path}';
  const placeholderIndex = template.indexOf(pathPlaceholder);

  if (placeholderIndex === -1) {
    return null;
  }

  const beforePath = template.substring(0, placeholderIndex);
  const afterPath = template.substring(placeholderIndex + pathPlaceholder.length);

  const escapedBefore = escapeRegex(beforePath);
  const escapedAfter = escapeRegex(afterPath);

  const patternString = `${escapedBefore}([^\\s"'\\]\\)\\n]+?)${escapedAfter}`;

  try {
    return new RegExp(patternString, 'g');
  } catch {
    return null;
  }
}

export function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  return IMAGE_EXTENSIONS.includes(ext);
}

export function resolveImagePath(
  commentPath: string,
  documentUri: vscode.Uri,
): vscode.Uri | null {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);

  if (path.isAbsolute(commentPath)) {
    if (fs.existsSync(commentPath) && isImageFile(commentPath)) {
      return vscode.Uri.file(commentPath);
    }
    return null;
  }

  if (workspaceFolder) {
    const workspacePath = path.join(workspaceFolder.uri.fsPath, commentPath);
    if (fs.existsSync(workspacePath) && isImageFile(workspacePath)) {
      return vscode.Uri.file(workspacePath);
    }
  }

  const documentDir = path.dirname(documentUri.fsPath);
  const relativeToDocPath = path.join(documentDir, commentPath);
  if (fs.existsSync(relativeToDocPath) && isImageFile(relativeToDocPath)) {
    return vscode.Uri.file(relativeToDocPath);
  }

  return null;
}

export function findImageCommentsInLine(
  line: vscode.TextLine,
  pattern: RegExp,
): ImageMatchResult[] {
  const results: ImageMatchResult[] = [];
  const text = line.text;

  let match: RegExpExecArray | null;
  const globalPattern = new RegExp(pattern.source, 'g');

  while ((match = globalPattern.exec(text)) !== null) {
    const fullMatch = match[0];
    const imagePath = match[1];

    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;

    const range = new vscode.Range(
      new vscode.Position(line.lineNumber, startIndex),
      new vscode.Position(line.lineNumber, endIndex),
    );

    results.push({
      fullMatch,
      imagePath,
      range,
    });
  }

  return results;
}

export function findImageCommentsInDocument(
  document: vscode.TextDocument,
  template: string,
): ImageMatchResult[] {
  const pattern = createPatternFromTemplate(template);
  if (!pattern) {
    return [];
  }

  const results: ImageMatchResult[] = [];
  const lineCount = document.lineCount;

  for (let i = 0; i < lineCount; i++) {
    const line = document.lineAt(i);
    const lineResults = findImageCommentsInLine(line, pattern);
    results.push(...lineResults);
  }

  return results;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function createImageHoverContent(
  imageUri: vscode.Uri,
  imagePath?: string
): vscode.MarkdownString {
  const markdown = new vscode.MarkdownString();
  markdown.isTrusted = true;

  const encodedUri = imageUri.toString(true);
  const fsPath = imageUri.fsPath;

  let fileSize = '';

  try {
    const stats = fs.statSync(fsPath);
    fileSize = formatFileSize(stats.size);
  } catch {}

  markdown.appendMarkdown(`**📷 图片注释**\n\n`);

  if (imagePath) {
    markdown.appendMarkdown(`**路径:** \`${imagePath}\`\n\n`);
  }

  if (fileSize) {
    markdown.appendMarkdown(`**大小:** ${fileSize}\n\n`);
  }

  markdown.appendMarkdown(`---\n\n`);
  markdown.appendMarkdown(`![Preview](${encodedUri}|width=600)\n\n`);
  markdown.appendMarkdown(`---\n\n`);
  markdown.appendMarkdown(`💡 *点击上方 "Preview Image" 按钮查看大图*`);

  return markdown;
}

export function findImageCommentAtPosition(
  document: vscode.TextDocument,
  position: vscode.Position,
  template: string,
): ImageMatchResult | null {
  const pattern = createPatternFromTemplate(template);
  if (!pattern) {
    return null;
  }

  const line = document.lineAt(position.line);
  const results = findImageCommentsInLine(line, pattern);

  for (const result of results) {
    if (result.range.contains(position)) {
      return result;
    }
  }

  return null;
}
