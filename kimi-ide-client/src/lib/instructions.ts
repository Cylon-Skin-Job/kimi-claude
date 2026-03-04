import type { SegmentType } from '../types';

const SEGMENT_ICONS: Record<string, { icon: string; label: string }> = {
  think:      { icon: 'lightbulb',      label: 'Thinking' },
  shell:      { icon: 'terminal',       label: 'Shell' },
  read:       { icon: 'description',    label: 'Read' },
  write:      { icon: 'edit_note',      label: 'Write' },
  edit:       { icon: 'edit_note',      label: 'Edit' },
  glob:       { icon: 'folder_data',     label: 'Globs' },
  grep:       { icon: 'document_search', label: 'Grep' },
  web_search: { icon: 'travel_explore', label: 'Web Search' },
  fetch:      { icon: 'link_2',         label: 'Fetch-URL' },
  subagent:   { icon: 'smart_toy',      label: 'Subagent' },
  todo:       { icon: 'checklist',      label: 'Planning' },
};

/** Map wire tool name to our segment type */
export function toolNameToSegmentType(toolName: string): SegmentType {
  const map: Record<string, SegmentType> = {
    Shell: 'shell',
    ReadFile: 'read',
    WriteFile: 'write',
    StrReplaceFile: 'edit',
    Glob: 'glob',
    Grep: 'grep',
    SearchWeb: 'web_search',
    FetchURL: 'fetch',
    Task: 'subagent',
    SetTodoList: 'todo',
  };
  return map[toolName] || 'read';
}

/** Build a label for a tool call from its type and args */
export function toolLabel(segType: SegmentType, args?: Record<string, unknown>): string {
  const base = SEGMENT_ICONS[segType]?.label || segType;
  if (!args) return base;

  switch (segType) {
    case 'read':  return `Read \`${args.path || ''}\``;
    case 'write': return `Write \`${args.path || ''}\``;
    case 'edit':  return `Edit \`${args.path || ''}\``;
    case 'glob':  return `Find \`${args.pattern || ''}\``;
    case 'grep':  return `Search \`${args.pattern || ''}\``;
    case 'web_search': return `Search \`${args.query || ''}\``;
    case 'fetch': return `Fetch \`${args.url || ''}\``;
    case 'shell': return `Running \`${(args.command as string || '').slice(0, 40)}\``;
    default: return base;
  }
}

/** Categorize a segment type for block routing */
export type SegmentCategory = 'collapsible' | 'inline';

const COLLAPSIBLE_TYPES = new Set(['think', 'shell', 'write', 'edit']);

export function getSegmentCategory(segType: string): SegmentCategory {
  return COLLAPSIBLE_TYPES.has(segType) ? 'collapsible' : 'inline';
}

export { SEGMENT_ICONS };
