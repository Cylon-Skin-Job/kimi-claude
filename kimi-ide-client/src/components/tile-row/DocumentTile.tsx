/**
 * @module DocumentTile
 * @role Single file rendered as a scaled-down document thumbnail
 *
 * Renders the actual file content at full size inside a container,
 * then scales it down with CSS transform. The tile shows real content,
 * not a placeholder.
 *
 * Reusable across any workspace that wants a tile view.
 */

import type { ReactElement } from 'react';

interface DocumentTileProps {
  name: string;
  content: string;
  extension?: string;
  panel?: string;
  folderPath?: string;
  onClick?: () => void;
}

const ICON_MAP: Record<string, string> = {
  md: 'description',
  html: 'html',
  json: 'data_object',
  js: 'javascript',
  ts: 'javascript',
  css: 'css',
  txt: 'text_snippet',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  svg: 'image',
  pdf: 'picture_as_pdf',
};

function renderMarkdown(content: string): ReactElement {
  const lines = content.split('\n');
  const elements: ReactElement[] = [];
  let inFrontmatter = false;
  let frontmatterLines: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Frontmatter detection
    if (i === 0 && line.trim() === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (line.trim() === '---') {
        elements.push(
          <div key={`fm-${i}`} className="doc-tile-frontmatter">
            {frontmatterLines.map((fl, j) => <div key={j}>{fl}</div>)}
          </div>
        );
        inFrontmatter = false;
        continue;
      }
      frontmatterLines.push(line);
      continue;
    }

    // Code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${i}`}><code>{codeLines.join('\n')}</code></pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      elements.push(<h1 key={i}>{line.slice(2)}</h1>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i}>{line.slice(3)}</h2>);
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i}>{line.slice(4)}</h3>);
    } else if (line.startsWith('---') && i > 0) {
      elements.push(<hr key={i} />);
    } else if (line.startsWith('- ')) {
      elements.push(<div key={i} style={{ paddingLeft: 12 }}>• {line.slice(2)}</div>);
    } else if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: 6 }} />);
    } else {
      elements.push(<p key={i}>{line}</p>);
    }
  }

  return <>{elements}</>;
}

function renderPlainText(content: string): ReactElement {
  return <code>{content}</code>;
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']);

export function isImageFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTENSIONS.has(ext);
}

export function DocumentTile({ name, content, extension, panel, folderPath, onClick }: DocumentTileProps) {
  const ext = extension || name.split('.').pop()?.toLowerCase() || '';
  const icon = ICON_MAP[ext] || 'draft';
  const isMarkdown = ext === 'md';
  const isImage = IMAGE_EXTENSIONS.has(ext);

  return (
    <div className="doc-tile" onClick={onClick} title={name}>
      <div className="doc-tile-preview">
        {isImage ? (
          <img
            src={`/api/panel-file/${panel}/${folderPath}/${encodeURIComponent(name)}`}
            alt={name}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : isMarkdown ? (
          renderMarkdown(content)
        ) : (
          renderPlainText(content)
        )}
      </div>
      <div className="doc-tile-footer">
        <span className="material-symbols-outlined doc-tile-icon">{icon}</span>
        <span className="doc-tile-name">{name}</span>
      </div>
    </div>
  );
}
