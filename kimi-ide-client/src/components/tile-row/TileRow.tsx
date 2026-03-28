/**
 * @module TileRow
 * @role Generic horizontal row of document tiles for a folder
 *
 * Fetches file list + content from the server for a given panel/folder,
 * renders each file as a scaled-down DocumentTile in a scrollable row.
 *
 * Reusable across any panel — Capture, Agents, etc.
 */

import { useEffect, useState } from 'react';
import { usePanelStore } from '../../state/panelStore';
import { DocumentTile, isImageFile } from './DocumentTile';

interface TileRowProps {
  label: string;
  panel: string;
  folder: string;
  onFileClick?: (filePath: string) => void;
  onFileSelect?: (file: FileWithContent, siblings: FileWithContent[]) => void;
}

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'folder';
  extension?: string;
}

export interface FileWithContent extends FileEntry {
  content: string;
}

export function TileRow({ label, panel, folder, onFileClick, onFileSelect }: TileRowProps) {
  const ws = usePanelStore((s) => s.ws);
  const [files, setFiles] = useState<FileWithContent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    let active = true;
    const pending = new Map<string, FileEntry>();
    const loaded: FileWithContent[] = [];

    function handleMessage(event: MessageEvent) {
      if (!active) return;
      try {
        const msg = JSON.parse(event.data);

        // File tree response — get list of files in this folder
        if (msg.type === 'file_tree_response' && msg.panel === panel && msg.path === folder) {
          const fileEntries = (msg.nodes || []).filter(
            (n: FileEntry) => n.type === 'file' && !n.name.startsWith('.')
          );

          if (fileEntries.length === 0) {
            setFiles([]);
            setLoading(false);
            return;
          }

          // Split into images (no content needed) and text files
          const imageEntries: FileWithContent[] = [];
          const textEntries: FileEntry[] = [];

          for (const entry of fileEntries) {
            if (isImageFile(entry.name)) {
              imageEntries.push({ ...entry, content: '' });
            } else {
              textEntries.push(entry);
            }
          }

          // Add images immediately (sorted newest first by name)
          imageEntries.sort((a, b) => b.name.localeCompare(a.name));
          for (const img of imageEntries) {
            loaded.push(img);
          }

          // If only images, we're done
          if (textEntries.length === 0) {
            setFiles([...loaded]);
            setLoading(false);
            return;
          }

          // Request content for text files
          for (const entry of textEntries) {
            pending.set(entry.path, entry);
            socket.send(JSON.stringify({
              type: 'file_content_request',
              panel,
              path: entry.path,
            }));
          }
        }

        // File content response — collect content
        if (msg.type === 'file_content_response' && msg.panel === panel && msg.success) {
          const entry = pending.get(msg.path);
          if (entry) {
            pending.delete(msg.path);
            loaded.push({ ...entry, content: msg.content || '' });

            // All files loaded?
            if (pending.size === 0) {
              loaded.sort((a, b) => a.name.localeCompare(b.name));
              setFiles(loaded);
              setLoading(false);
            }
          }
        }
      } catch {
        // ignore
      }
    }

    const socket = ws;
    socket.addEventListener('message', handleMessage);

    // Request the file tree for this folder
    socket.send(JSON.stringify({
      type: 'file_tree_request',
      panel,
      path: folder,
    }));

    // Timeout fallback
    const timeout = setTimeout(() => {
      if (active && loading) {
        setLoading(false);
      }
    }, 5000);

    return () => {
      active = false;
      socket.removeEventListener('message', handleMessage);
      clearTimeout(timeout);
    };
  }, [ws, panel, folder]);

  return (
    <div className="tile-row">
      <div className="tile-row-header">
        <span className="tile-row-label">{label}</span>
        <span className="tile-row-count">
          {loading ? '...' : files.length > 0 ? `${files.length}` : ''}
        </span>
      </div>
      <div className="tile-row-scroll">
        {loading ? (
          <div className="tile-row-empty">Loading...</div>
        ) : files.length === 0 ? (
          <div className="tile-row-empty">Empty</div>
        ) : (
          files.map((file) => (
            <DocumentTile
              key={file.path}
              name={file.name}
              content={file.content}
              extension={file.extension}
              panel={panel}
              folderPath={folder}
              onClick={() => {
                onFileClick?.(file.path);
                onFileSelect?.(file, files);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
