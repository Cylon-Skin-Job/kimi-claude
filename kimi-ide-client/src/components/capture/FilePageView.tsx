/**
 * @module FilePageView
 * @role Full-content file viewer for the Capture workspace
 *
 * Displays a single file at readable size filling the content area.
 * Back arrow top-left, sibling files in a ribbon at the bottom.
 *
 * Content rendering is intentionally basic — the inner renderer
 * will be replaced by a unified content module later.
 */

import type { FileWithContent } from '../tile-row/TileRow';
import { isImageFile } from '../tile-row/DocumentTile';

interface FilePageViewProps {
  file: FileWithContent;
  siblings: FileWithContent[];
  panel: string;
  folder: string;
  onBack: () => void;
  onSelectSibling: (file: FileWithContent) => void;
}

export function FilePageView({
  file,
  siblings,
  panel,
  folder,
  onBack,
  onSelectSibling,
}: FilePageViewProps) {
  const isImage = isImageFile(file.name);

  return (
    <div className="file-page-view">
      {/* Top bar — back arrow + filename */}
      <div className="file-page-topbar">
        <button className="file-page-back" onClick={onBack} title="Back to tiles">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <span className="file-page-filename">{file.name}</span>
      </div>

      {/* Content area — fills remaining space */}
      <div className="file-page-content">
        {isImage ? (
          <img
            src={`/api/panel-file/${panel}/${folder}/${encodeURIComponent(file.name)}`}
            alt={file.name}
            className="file-page-image"
          />
        ) : (
          <pre className="file-page-text"><code>{file.content}</code></pre>
        )}
      </div>

      {/* Bottom ribbon — sibling tiles */}
      <div className="file-page-ribbon">
        <div className="file-page-ribbon-scroll">
          {siblings.map((sib) => {
            const sibIsImage = isImageFile(sib.name);
            const isActive = sib.path === file.path;
            return (
              <div
                key={sib.path}
                className={`file-page-ribbon-tile${isActive ? ' active' : ''}`}
                onClick={() => onSelectSibling(sib)}
                title={sib.name}
              >
                <div className="ribbon-tile-preview">
                  {sibIsImage ? (
                    <img
                      src={`/api/panel-file/${panel}/${folder}/${encodeURIComponent(sib.name)}`}
                      alt={sib.name}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span className="ribbon-tile-text">{sib.content.slice(0, 200)}</span>
                  )}
                </div>
                <div className="ribbon-tile-label">{sib.name}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
