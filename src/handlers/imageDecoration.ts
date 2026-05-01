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
        });
      }
    }

    editor.setDecorations(this.imageCommentDecoration, decorations);
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
