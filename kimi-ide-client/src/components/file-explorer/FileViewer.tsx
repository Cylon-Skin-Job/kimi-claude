import { useFileStore } from '../../state/fileStore';
import { FileContentRenderer } from './FileContentRenderer';

// File extension to icon mapping
const FILE_ICONS: Record<string, string> = {
  js: 'javascript',
  jsx: 'code',
  ts: 'terminal',
  tsx: 'code',
  json: 'data_object',
  css: 'format_paint',
  scss: 'format_paint',
  html: 'html',
  htm: 'html',
  py: 'terminal',
  rb: 'terminal',
  go: 'terminal',
  rs: 'terminal',
  java: 'coffee',
  c: 'memory',
  cpp: 'memory',
  h: 'memory',
  sh: 'terminal',
  bash: 'terminal',
  yml: 'list',
  yaml: 'list',
  toml: 'settings',
  xml: 'code',
  sql: 'database',
  md: 'description',
  txt: 'description',
  env: 'settings',
  gitignore: 'settings',
};

// File extension to language name mapping
const LANGUAGE_NAMES: Record<string, string> = {
  js: 'JavaScript',
  jsx: 'JSX',
  ts: 'TypeScript',
  tsx: 'TSX',
  json: 'JSON',
  css: 'CSS',
  scss: 'SCSS',
  html: 'HTML',
  htm: 'HTML',
  py: 'Python',
  rb: 'Ruby',
  go: 'Go',
  rs: 'Rust',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  h: 'C Header',
  sh: 'Shell',
  bash: 'Bash',
  yml: 'YAML',
  yaml: 'YAML',
  toml: 'TOML',
  xml: 'XML',
  sql: 'SQL',
  md: 'Markdown',
  txt: 'Plain Text',
  env: 'Environment',
  gitignore: 'Git Ignore',
};

function getFileIcon(extension?: string): string {
  if (!extension) return 'description';
  return FILE_ICONS[extension] || 'description';
}

function getLanguageName(extension?: string): string {
  if (!extension) return 'Plain Text';
  return LANGUAGE_NAMES[extension] || extension.toUpperCase();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatFilePath(path: string): string {
  // Show last 2 parts of path, or full path if short
  const parts = path.split('/');
  if (parts.length <= 2) return path;
  return '.../' + parts.slice(-2).join('/');
}

export function FileViewer() {
  const selectedFile = useFileStore((s) => s.selectedFile);
  const fileContent = useFileStore((s) => s.fileContent);
  const isLoading = useFileStore((s) => s.isLoading);
  const fileSize = useFileStore((s) => s.fileSize);
  const closeFile = useFileStore((s) => s.closeFile);

  if (!selectedFile) return null;

  const fileIcon = getFileIcon(selectedFile.extension);
  const languageName = getLanguageName(selectedFile.extension);
  const displaySize = fileSize ? formatFileSize(fileSize) : 'Loading...';
  const lineCount = fileContent.split('\n').length;

  return (
    <div className={`file-viewer${isLoading ? ' loading' : ''}`}>
      {/* File Header - Tab Bar */}
      <div className="file-viewer-header">
        <div className="file-viewer-tabs">
          <div className="file-viewer-tab">
            <span className={`material-symbols-outlined tab-icon file-icon-${selectedFile.extension}`}>
              {fileIcon}
            </span>
            <span className="tab-name">{selectedFile.name}</span>
            <button 
              className="tab-close"
              onClick={closeFile}
              disabled={isLoading}
              title="Close file"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                close
              </span>
            </button>
          </div>
        </div>
        
        <div className="file-viewer-actions">
          <button 
            className="action-btn"
            onClick={() => navigator.clipboard.writeText(fileContent)}
            title="Copy content"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              content_copy
            </span>
          </button>
          <button 
            className="action-btn"
            onClick={closeFile}
            disabled={isLoading}
            title="Back to explorer"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              folder_open
            </span>
          </button>
        </div>
      </div>

      {/* File Info Bar */}
      <div className="file-viewer-info">
        <div className="info-item">
          <span className="material-symbols-outlined">folder</span>
          <span>{formatFilePath(selectedFile.path)}</span>
        </div>
        <div className="info-item" style={{ marginLeft: 'auto' }}>
          <span className="material-symbols-outlined">code</span>
          <span>{languageName}</span>
        </div>
        <div className="info-item">
          <span className="material-symbols-outlined">straighten</span>
          <span>{displaySize}</span>
        </div>
        <div className="info-item">
          <span className="material-symbols-outlined">format_list_numbered</span>
          <span>{lineCount} lines</span>
        </div>
      </div>

      {/* File Content */}
      <div className="file-viewer-content">
        <FileContentRenderer
          content={fileContent}
          extension={selectedFile.extension}
          fileName={selectedFile.name}
        />
      </div>
    </div>
  );
}
