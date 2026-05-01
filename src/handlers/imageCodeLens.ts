import * as vscode from 'vscode';
import { DEFAULT_COMMENT_TEMPLATE } from '../utils/constants';
import {
  findImageCommentsInDocument,
  findImageCommentAtPosition,
  resolveImagePath,
} from '../utils/preview';
import { messages } from '../nls';
import * as fs from 'fs';

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

        const previewCodeLens = new vscode.CodeLens(lensRange, {
          title: '$(eye) Preview Image',
          command: 'imageComment.previewImage',
          arguments: [imageUri, match.imagePath],
        });

        const deleteCodeLens = new vscode.CodeLens(lensRange, {
          title: '$(trash) Delete',
          command: 'imageComment.deleteImageComment',
          arguments: [match.range, match.imagePath, document.uri],
        });

        codeLenses.push(previewCodeLens, deleteCodeLens);
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

export async function handleDeleteImageCommentCommand(
  range?: vscode.Range,
  imagePath?: string,
  documentUri?: vscode.Uri,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;

  if (!range || !imagePath || !documentUri) {
    if (!editor) {
      vscode.window.showWarningMessage(messages.noActiveEditor());
      return;
    }

    const config = vscode.workspace.getConfiguration('imageComment');
    const template = config.get<string>('commentTemplate', DEFAULT_COMMENT_TEMPLATE);

    const match = findImageCommentAtPosition(
      editor.document,
      editor.selection.active,
      template,
    );

    if (!match) {
      vscode.window.showInformationMessage('No image comment found at cursor position');
      return;
    }

    range = match.range;
    imagePath = match.imagePath;
    documentUri = editor.document.uri;
  }

  const confirm = await vscode.window.showWarningMessage(
    `确定要删除此图片注释及其关联图片吗？\n图片路径: ${imagePath}`,
    { modal: true },
    'Delete',
    'Cancel'
  );

  if (confirm !== 'Delete') {
    return;
  }

  if (editor && editor.document.uri.toString() === documentUri.toString()) {
    const editRange = new vscode.Range(
      new vscode.Position(range.start.line, 0),
      new vscode.Position(range.start.line, editor.document.lineAt(range.start.line).text.length)
    );

    const success = await editor.edit((editBuilder) => {
      editBuilder.delete(editRange);
    });

    if (!success) {
      vscode.window.showErrorMessage('Failed to delete comment from editor');
      return;
    }
  } else {
    vscode.window.showWarningMessage('Comment not in active editor, only deleting image file');
  }

  const imageUri = resolveImagePath(imagePath, documentUri);
  if (imageUri) {
    try {
      await fs.promises.unlink(imageUri.fsPath);
      vscode.window.showInformationMessage(`已删除图片注释和关联图片: ${imagePath}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showWarningMessage(`注释已删除，但删除图片时出错: ${errorMessage}`);
    }
  } else {
    vscode.window.showInformationMessage(`已删除图片注释: ${imagePath}`);
  }
}
