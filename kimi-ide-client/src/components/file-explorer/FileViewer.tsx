import { useFileStore } from '../../state/fileStore';
import { FileContentRenderer } from './FileContentRenderer';

export function FileViewer() {
  const selectedFile = useFileStore((s) => s.selectedFile);
  const fileContent = useFileStore((s) => s.fileContent);
  const isLoading = useFileStore((s) => s.isLoading);
  const closeFile = useFileStore((s) => s.closeFile);

  if (!selectedFile) return null;

  return (
    <div className={`file-viewer${isLoading ? ' loading' : ''}`}>
      <div className="file-viewer-nav">
        <button
          className="back-btn"
          onClick={closeFile}
          disabled={isLoading}
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <span className="filename">{selectedFile.name}</span>
      </div>
      <div className="file-viewer-content">
        <FileContentRenderer
          content={fileContent}
          extension={selectedFile.extension}
        />
      </div>
    </div>
  );
}
