/**
 * 生成唯一的文件名
 */
export function generateFileName(extension: string): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '-');
  const random = Math.random().toString(36).substring(2, 8);
  return `image-${timestamp}-${random}.${extension}`;
}

