import type { SegmentType } from '../types';

const SEGMENT_ICONS: Record<string, { icon: string; label: string }> = {
  think:      { icon: 'lightbulb',      label: 'Thinking' },
  shell:      { icon: 'terminal',       label: 'Running' },
  read:       { icon: 'description',    label: 'Read' },
  write:      { icon: 'edit_note',      label: 'Write' },
  edit:       { icon: 'find_replace',   label: 'Edit' },
  glob:       { icon: 'folder_search',  label: 'Find' },
  grep:       { icon: 'search',         label: 'Search' },
  web_search: { icon: 'travel_explore', label: 'Search' },
  fetch:      { icon: 'link',           label: 'Fetch' },
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

export { SEGMENT_ICONS };
