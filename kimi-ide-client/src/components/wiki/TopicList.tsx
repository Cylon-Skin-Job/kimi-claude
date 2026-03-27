/**
 * @module TopicList
 * @role Left sidebar — lists wiki topics, highlights active
 * @reads wikiStore: topics, activeTopic
 */

import { useWikiStore } from '../../state/wikiStore';

export function TopicList() {
  const topics = useWikiStore((s) => s.topics);
  const activeTopic = useWikiStore((s) => s.activeTopic);
  const navigateToTopic = useWikiStore((s) => s.navigateToTopic);

  const topicIds = Object.keys(topics).sort((a, b) => {
    // Home always first
    if (a === 'home') return -1;
    if (b === 'home') return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="wiki-topic-list">
      <div className="wiki-topic-list-header">
        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>full_coverage</span>
        <span>Topics</span>
      </div>
      <div className="wiki-topic-list-items">
        {topicIds.map((id) => {
          const meta = topics[id];
          const isActive = id === activeTopic;
          return (
            <button
              key={id}
              className={`wiki-topic-item ${isActive ? 'active' : ''}`}
              onClick={() => navigateToTopic(meta.slug)}
            >
              <span className="wiki-topic-indicator">{isActive ? '\u25C9' : '\u25CB'}</span>
              <span className="wiki-topic-name">{meta.slug}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
