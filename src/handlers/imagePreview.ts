import * as vscode from 'vscode';
import {
  findImageCommentAtPosition,
  resolveImagePath,
  createImageHoverContent,
} from '../utils/preview';

export class ImagePreviewHoverProvider implements vscode.HoverProvider {
  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.Hover> {
    const config = vscode.workspace.getConfiguration('imageComment');
    const template = config.get<string>('commentTemplate', '![image]({path})');

    const match = findImageCommentAtPosition(document, position, template);
    if (!match) {
      return null;
    }

    const imageUri = resolveImagePath(match.imagePath, document.uri);
    if (!imageUri) {
      return null;
    }

    const hoverContent = createImageHoverContent(imageUri);

    return new vscode.Hover(hoverContent, match.range);
  }
}
