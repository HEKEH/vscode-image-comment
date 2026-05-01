import * as vscode from 'vscode';
import { DEFAULT_COMMENT_TEMPLATE } from '../utils/constants';
import { findImageCommentsInDocument, resolveImagePath } from '../utils/preview';
import * as path from 'path';
import * as fs from 'fs';

export class ImageDecorationProvider {
  private imageCommentDecoration: vscode.TextEditorDecorationType;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.imageCommentDecoration = this.createDecorationType();
  }

  private createDecorationType(): vscode.TextEditorDecorationType {
    const config = vscode.workspace.getConfiguration('imageComment');
    const showGutterIcon = config.get<boolean>('showGutterIcon', true);
    const showInlineIcon = config.get<boolean>('showInlineIcon', true);
    const highlightBackground = config.get<boolean>('highlightBackground', true);

    const decorationOptions: vscode.DecorationRenderOptions = {
      before: showInlineIcon
        ? {
            contentIconPath: this.getIconPath('icon.svg'),
            margin: '0 6px 0 0',
            width: '14px',
            height: '14px',
          }
        : undefined,
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      overviewRulerColor: 'rgba(255, 140, 0, 0.6)',
    };

    if (showGutterIcon) {
      decorationOptions.gutterIconPath = this.getIconPath('icon.svg');
      decorationOptions.gutterIconSize = '14px';
    }

    if (highlightBackground) {
      const theme = vscode.window.activeColorTheme;
      const isDark = theme.kind === vscode.ColorThemeKind.Dark || theme.kind === vscode.ColorThemeKind.HighContrast;
      
      decorationOptions.backgroundColor = isDark
        ? 'rgba(255, 140, 0, 0.08)'
        : 'rgba(255, 140, 0, 0.04)';
      
      decorationOptions.border = isDark
        ? '1px dashed rgba(255, 140, 0, 0.15)'
        : '1px dashed rgba(255, 140, 0, 0.1)';
      
      decorationOptions.borderRadius = '2px';
    }

    return vscode.window.createTextEditorDecorationType(decorationOptions);
  }

  private getIconPath(iconName: string): vscode.Uri {
    const iconPath = path.join(this.context.extensionPath, 'images', iconName);
    if (fs.existsSync(iconPath)) {
      return vscode.Uri.file(iconPath);
    }
    return vscode.Uri.file(path.join(this.context.extensionPath, 'images', 'icon.png'));
  }

  public updateDecorations(editor: vscode.TextEditor | undefined): void {
    if (!editor) {
      return;
    }

    const config = vscode.workspace.getConfiguration('imageComment');
    const template = config.get<string>('commentTemplate', DEFAULT_COMMENT_TEMPLATE);
    const enableDecorations = config.get<boolean>('enableDecorations', true);

    if (!enableDecorations) {
      editor.setDecorations(this.imageCommentDecoration, []);
      return;
    }

    const matches = findImageCommentsInDocument(editor.document, template);
    const decorations: vscode.DecorationOptions[] = [];

    for (const match of matches) {
      const imageUri = resolveImagePath(match.imagePath, editor.document.uri);
      if (imageUri) {
        const decorationRange = new vscode.Range(
          new vscode.Position(match.range.start.line, 0),
          new vscode.Position(match.range.start.line, match.range.end.character),
        );

        decorations.push({
          range: decorationRange,
          hoverMessage: this.createEnhancedHoverMessage(imageUri, match.imagePath),
        });
      }
    }

    editor.setDecorations(this.imageCommentDecoration, decorations);
  }

  private createEnhancedHoverMessage(imageUri: vscode.Uri, imagePath: string): vscode.MarkdownString {
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.supportHtml = true;

    const encodedUri = imageUri.toString(true);
    const fsPath = imageUri.fsPath;
    
    let fileSize = '';
    let imageDimensions = '';
    
    try {
      const stats = fs.statSync(fsPath);
      fileSize = this.formatFileSize(stats.size);
    } catch {}

    const theme = vscode.window.activeColorTheme;
    const isDark = theme.kind === vscode.ColorThemeKind.Dark || theme.kind === vscode.ColorThemeKind.HighContrast;
    
    const borderColor = isDark ? '#333' : '#e0e0e0';
    const textColor = isDark ? '#cccccc' : '#666666';
    const accentColor = '#ff8c00';

    markdown.appendMarkdown(`<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 320px;">`);
    
    markdown.appendMarkdown(`<div style="display: flex; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid ${borderColor};">`);
    markdown.appendMarkdown(`<span style="font-size: 16px; margin-right: 8px;">📷</span>`);
    markdown.appendMarkdown(`<span style="font-weight: 600; font-size: 14px; color: ${accentColor};">图片注释</span>`);
    markdown.appendMarkdown(`</div>`);

    markdown.appendMarkdown(`<div style="font-size: 12px; line-height: 1.6; color: ${textColor}; margin-bottom: 10px;">`);
    markdown.appendMarkdown(`<div style="margin-bottom: 4px;"><strong>路径:</strong> ${imagePath}</div>`);
    if (fileSize) {
      markdown.appendMarkdown(`<div><strong>大小:</strong> ${fileSize}</div>`);
    }
    markdown.appendMarkdown(`</div>`);

    markdown.appendMarkdown(`<div style="border: 1px solid ${borderColor}; border-radius: 4px; overflow: hidden; background: ${isDark ? '#1e1e1e' : '#fafafa'};">`);
    markdown.appendMarkdown(`<div style="padding: 4px; text-align: center;">`);
    markdown.appendMarkdown(`![Preview](${encodedUri}|width=280)`);
    markdown.appendMarkdown(`</div>`);
    markdown.appendMarkdown(`<div style="padding: 6px 8px; font-size: 11px; color: ${textColor}; text-align: center; border-top: 1px solid ${borderColor}; background: ${isDark ? '#252525' : '#f5f5f5'};">`);
    markdown.appendMarkdown(`💡 点击上方 "Preview Image" 按钮查看大图`);
    markdown.appendMarkdown(`</div>`);
    markdown.appendMarkdown(`</div>`);

    markdown.appendMarkdown(`</div>`);

    return markdown;
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  public refresh(): void {
    this.imageCommentDecoration.dispose();
    this.imageCommentDecoration = this.createDecorationType();
    
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      this.updateDecorations(editor);
    }
  }

  public dispose(): void {
    this.imageCommentDecoration.dispose();
  }
}

export function registerImageDecorationProvider(
  context: vscode.ExtensionContext,
): ImageDecorationProvider {
  const provider = new ImageDecorationProvider(context);

  if (vscode.window.activeTextEditor) {
    provider.updateDecorations(vscode.window.activeTextEditor);
  }

  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      provider.updateDecorations(editor);
    },
    null,
    context.subscriptions,
  );

  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
        provider.updateDecorations(vscode.window.activeTextEditor);
      }
    },
    null,
    context.subscriptions,
  );

  vscode.workspace.onDidChangeConfiguration(
    (event) => {
      if (event.affectsConfiguration('imageComment')) {
        provider.refresh();
      }
    },
    null,
    context.subscriptions,
  );

  context.subscriptions.push({
    dispose: () => provider.dispose(),
  });

  return provider;
}
