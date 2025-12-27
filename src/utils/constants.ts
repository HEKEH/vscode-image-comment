// 最大图片大小限制（50MB）
export const MAX_IMAGE_SIZE = 50 * 1024 * 1024;

// 支持的图片格式
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];

// 文件类型到注释格式的映射
export const COMMENT_FORMATS: Record<
  string,
  { single: string; multi: { start: string; end: string } }
> = {
  javascript: { single: '//', multi: { start: '/*', end: '*/' } },
  typescript: { single: '//', multi: { start: '/*', end: '*/' } },
  javascriptreact: { single: '//', multi: { start: '/*', end: '*/' } },
  typescriptreact: { single: '//', multi: { start: '/*', end: '*/' } },
  python: { single: '#', multi: { start: '"""', end: '"""' } },
  java: { single: '//', multi: { start: '/*', end: '*/' } },
  c: { single: '//', multi: { start: '/*', end: '*/' } },
  cpp: { single: '//', multi: { start: '/*', end: '*/' } },
  csharp: { single: '//', multi: { start: '/*', end: '*/' } },
  go: { single: '//', multi: { start: '/*', end: '*/' } },
  rust: { single: '//', multi: { start: '/*', end: '*/' } },
  ruby: { single: '#', multi: { start: '=begin', end: '=end' } },
  php: { single: '//', multi: { start: '/*', end: '*/' } },
  swift: { single: '//', multi: { start: '/*', end: '*/' } },
  kotlin: { single: '//', multi: { start: '/*', end: '*/' } },
  scala: { single: '//', multi: { start: '/*', end: '*/' } },
  html: { single: '', multi: { start: '<!--', end: '-->' } },
  css: { single: '', multi: { start: '/*', end: '*/' } },
  scss: { single: '//', multi: { start: '/*', end: '*/' } },
  less: { single: '//', multi: { start: '/*', end: '*/' } },
  sql: { single: '--', multi: { start: '/*', end: '*/' } },
  shellscript: { single: '#', multi: { start: ": <<'EOF'", end: 'EOF' } },
  yaml: { single: '#', multi: { start: '', end: '' } },
  json: { single: '', multi: { start: '/*', end: '*/' } },
};

