/**
 * Grouped-Summary Reveal — instant display, no typing.
 *
 * Used by: read, glob, grep, web_search, fetch
 *
 * These are just filenames/patterns/URLs. Show immediately.
 */

import type { RevealController } from './types';

export const groupedSummaryReveal: RevealController = {
  async run(contentRef, setDisplayed, _cancelRef, _completeRef) {
    setDisplayed(contentRef.current);
  },
};
