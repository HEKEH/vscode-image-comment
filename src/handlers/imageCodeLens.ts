import * as vscode from 'vscode';
import { DEFAULT_COMMENT_TEMPLATE } from '../utils/constants';
import {
  findImageCommentsInDocument,
  resolveImagePath,
} from '../utils/preview';
import { messages } from '../nls';

export class ImagePreviewCodeLensProvider implements vscode.CodeLensProvider {
  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.CodeLens[]> {
    const config = vscode.workspace.getConfiguration('imageComment');
    const template = config.get<string>('commentTemplate', DEFAULT_COMMENT_TEMPLATE);

    const matches = findImageCommentsInDocument(document, template);
    const codeLenses: vscode.CodeLens[] = [];

    for (const match of matches) {
      const imageUri = resolveImagePath(match.imagePath, document.uri);
      if (imageUri) {
        const lensRange = new vscode.Range(
          new vscode.Position(match.range.start.line, 0),
          match.range.end,
        );

        const codeLens = new vscode.CodeLens(lensRange, {
          title: '$(eye) Preview Image',
          command: 'imageComment.previewImage',
          arguments: [imageUri, match.imagePath],
        });

        codeLenses.push(codeLens);
      }
    }

    return codeLenses;
  }
}

export async function handlePreviewImageCommand(
  imageUri?: vscode.Uri,
  imagePath?: string,
): Promise<void> {
  if (!imageUri) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage(messages.noActiveEditor());
      return;
    }

    const config = vscode.workspace.getConfiguration('imageComment');
    const template = config.get<string>('commentTemplate', DEFAULT_COMMENT_TEMPLATE);

    const { findImageCommentAtPosition, resolveImagePath } = await import('../utils/preview');
    const match = findImageCommentAtPosition(
      editor.document,
      editor.selection.active,
      template,
    );

    if (!match) {
      vscode.window.showInformationMessage('No image comment found at cursor position');
      return;
    }

    const resolvedUri = resolveImagePath(match.imagePath, editor.document.uri);
    if (!resolvedUri) {
      vscode.window.showErrorMessage('Could not resolve image path');
      return;
    }
    imageUri = resolvedUri;
    imagePath = match.imagePath;
  }

  if (!imageUri) {
    vscode.window.showErrorMessage('Could not resolve image path');
    return;
  }

  try {
    await vscode.commands.executeCommand(
      'vscode.open',
      imageUri,
      vscode.ViewColumn.Beside,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to open image: ${errorMessage}`);
  }
}
