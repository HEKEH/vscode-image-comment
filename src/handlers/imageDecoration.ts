import * as vscode from 'vscode';
import { DEFAULT_COMMENT_TEMPLATE } from '../utils/constants';
import { findImageCommentsInDocument, resolveImagePath } from '../utils/preview';
import { messages } from '../nls';
import * as path from 'path';
import * as fs from 'fs';

export class ImageDecorationProvider {
  private imageCommentDecoration: vscode.TextEditorDecorationType;
  private context: vscode.ExtensionContext;
  private previousImageComments: Map<string, { line: number; text: string; range: vscode.Range }[]> = new Map();

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.imageCommentDecoration = this.createDecorationType();
  }

  private createDecorationType(): vscode.TextEditorDecorationType {
    const config = vscode.workspace.getConfiguration('imageComment');
    const showGutterIcon = config.get<boolean>('showGutterIcon', true);
    const highlightBackground = config.get<boolean>('highlightBackground', true);

    const decorationOptions: vscode.DecorationRenderOptions = {
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

  private saveImageCommentsState(document: vscode.TextDocument): void {
    const config = vscode.workspace.getConfiguration('imageComment');
    const template = config.get<string>('commentTemplate', DEFAULT_COMMENT_TEMPLATE);
    const matches = findImageCommentsInDocument(document, template);

    const comments = matches.map(match => ({
      line: match.range.start.line,
      text: document.lineAt(match.range.start.line).text,
      range: match.range,
    }));

    this.previousImageComments.set(document.uri.toString(), comments);
  }

  private getImageCommentsState(documentUri: string): { line: number; text: string; range: vscode.Range }[] {
    return this.previousImageComments.get(documentUri) || [];
  }

  public checkAndWarnAboutModification(event: vscode.TextDocumentChangeEvent): void {
    const documentUri = event.document.uri.toString();
    const previousComments = this.getImageCommentsState(documentUri);

    if (previousComments.length === 0) {
      this.saveImageCommentsState(event.document);
      return;
    }

    for (const change of event.contentChanges) {
      const changeStartLine = change.range.start.line;
      const changeEndLine = change.range.end.line;

      for (const comment of previousComments) {
        const commentLine = comment.line;

        if (changeStartLine <= commentLine && changeEndLine >= commentLine) {
          const currentLineText = event.document.lineAt(commentLine).text;

          if (currentLineText !== comment.text) {
            vscode.window.showWarningMessage(messages.readonlyWarning());
            break;
          }
        }
      }
    }

    this.saveImageCommentsState(event.document);
  }

  public updateDecorations(editor: vscode.TextEditor | undefined): void {
    if (!editor) {
      return;
    }

    this.saveImageCommentsState(editor.document);

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

    const encodedUri = imageUri.toString(true);
    const fsPath = imageUri.fsPath;

    let fileSize = '';

    try {
      const stats = fs.statSync(fsPath);
      fileSize = this.formatFileSize(stats.size);
    } catch {}

    markdown.appendMarkdown(`**📷 图片注释**\n\n`);
    markdown.appendMarkdown(`**路径:** \`${imagePath}\`\n\n`);

    if (fileSize) {
      markdown.appendMarkdown(`**大小:** ${fileSize}\n\n`);
    }

    markdown.appendMarkdown(`---\n\n`);
    markdown.appendMarkdown(`![Preview](${encodedUri}|width=300)\n\n`);
    markdown.appendMarkdown(`---\n\n`);
    markdown.appendMarkdown(`💡 *点击上方 "Preview Image" 按钮查看大图*`);

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
        provider.checkAndWarnAboutModification(event);
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
