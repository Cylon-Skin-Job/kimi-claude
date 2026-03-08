// File Explorer Utilities
// Icon mapping and name formatting for file tree display

export const FILE_ICONS: Record<string, string> = {
  // Code
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  json: 'data_object',
  css: 'style',
  scss: 'style',
  html: 'html',
  htm: 'html',

  // Docs
  md: 'description',
  mdx: 'description',
  txt: 'text_snippet',

  // Config
  yml: 'settings',
  yaml: 'settings',
  toml: 'settings',
  env: 'key',

  // Media
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  svg: 'image',
  mp4: 'videocam',
  mov: 'videocam',

  // Data
  csv: 'table',
  sql: 'database',
};

const DEFAULT_FILE_ICON = 'article';

export function getFileIcon(extension?: string): string {
  if (!extension) return DEFAULT_FILE_ICON;
  return FILE_ICONS[extension] || DEFAULT_FILE_ICON;
}

/** File names: replace hyphens/underscores with spaces */
export function formatFileName(name: string): string {
  return name.replace(/-/g, ' ').replace(/_/g, ' ');
}

/** Folder names: display as-is (disk name = display name) */
export function formatFolderName(name: string): string {
  return name;
}
