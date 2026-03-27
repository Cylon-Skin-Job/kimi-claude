#!/bin/sh
# Sync wiki workspace to GitLab wiki repo.
#
# Usage: ./scripts/sync-wiki.sh [commit message]
#
# Walks ai/workspaces/wiki/*/PAGE.md, assembles flat markdown files
# in the .wiki-repo staging area, and pushes to GitLab.
#
# Slug resolution (in order):
#   1. .slug file in topic folder (custom override)
#   2. Auto-titlecase from folder name (secrets → Secrets, wiki-system → Wiki-System)

set -e

WIKI_WORKSPACE="$(cd "$(dirname "$0")/../ai/workspaces/wiki" && pwd)"
REPO_DIR="$WIKI_WORKSPACE/.wiki-repo"
MSG="${1:-Update wiki}"

if [ ! -d "$REPO_DIR" ]; then
  echo "Error: .wiki-repo not found. Clone the wiki repo first."
  exit 1
fi

# Convert folder name to GitLab slug (kebab-case → Title-Case)
to_slug() {
  echo "$1" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1' | sed 's/ /-/g'
}

# Resolve slug for a topic folder
get_slug() {
  local topic_dir="$1"
  local topic="$(basename "$topic_dir")"
  if [ -f "$topic_dir/.slug" ]; then
    cat "$topic_dir/.slug" | tr -d '\n'
  else
    to_slug "$topic"
  fi
}

# Create a temp work tree from the bare-ish repo
export GIT_DIR="$REPO_DIR"
export GIT_WORK_TREE="$REPO_DIR/_stage"
mkdir -p "$GIT_WORK_TREE"

# Clean staging area
rm -f "$GIT_WORK_TREE"/*.md

# Copy PAGE.md files as Slug.md
for topic_dir in "$WIKI_WORKSPACE"/*/; do
  page="$topic_dir/PAGE.md"
  [ -f "$page" ] || continue
  slug="$(get_slug "$topic_dir")"
  cp "$page" "$GIT_WORK_TREE/${slug}.md"
done

# Commit and push if changed
cd "$GIT_WORK_TREE"
git add -A
if git diff --cached --quiet; then
  echo "Wiki is clean — nothing to push."
else
  git commit -m "$MSG"
  git push origin main 2>/dev/null || git push origin master
  echo "Wiki synced to GitLab."
fi

# Clean up staging
rm -rf "$GIT_WORK_TREE"
