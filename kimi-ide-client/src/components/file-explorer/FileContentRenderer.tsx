interface FileContentRendererProps {
  content: string;
  extension?: string;
  fileName?: string;
}

// Simple code-like extensions that get monospace treatment
const CODE_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'json', 'css', 'scss', 'html', 'htm',
  'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'sh', 'bash',
  'yml', 'yaml', 'toml', 'xml', 'sql', 'env',
]);

export function FileContentRenderer({ content, extension }: FileContentRendererProps) {
  const isCode = extension ? CODE_EXTENSIONS.has(extension) : false;

  return (
    <div className="file-content-renderer">
      <pre className={isCode ? 'file-content-code' : 'file-content-text'}>
        <code>{content}</code>
      </pre>
    </div>
  );
}
