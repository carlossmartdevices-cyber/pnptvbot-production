#!/bin/bash

# Script to push all fixed branches to remote
# This script will attempt to push each resolved branch with retry logic

set +e  # Don't exit on error

echo "=========================================="
echo "Pushing All Fixed Branches"
echo "=========================================="

# List of branches that were fixed
FIXED_BRANCHES=(
  "claude/broadcast-scheduling-s3-upload-01JZm8SxDzTGaASdsF3fjSWT"
  "claude/create-pnptv-landing-page-013FFARMn68woKkCvGCwZTQc"
  "claude/enhance-members-area-menu-018BULpqhDpAkG2U1NZh3kmB"
  "claude/remove-zoom-01Rs6A2re6pjGD5ow6j37EvL"
  "claude/rules-menus-documentation-01YM2F89QcrdG8dcfCEpec9z"
  "claude/termux-deployment-guide-01C6w5sQE7SAwoQkPZLy7g11"
)

# Function to push with retry logic (exponential backoff)
push_with_retry() {
  local branch=$1
  local max_retries=4
  local retry_count=0
  local wait_time=2

  while [ $retry_count -lt $max_retries ]; do
    echo "Pushing $branch (attempt $((retry_count + 1))/$max_retries)..."

    if git push origin "$branch"; then
      echo "✅ Successfully pushed $branch"
      return 0
    fi

    retry_count=$((retry_count + 1))

    if [ $retry_count -lt $max_retries ]; then
      echo "⚠️ Push failed, retrying in ${wait_time}s..."
      sleep $wait_time
      wait_time=$((wait_time * 2))  # Exponential backoff
    fi
  done

  echo "❌ Failed to push $branch after $max_retries attempts"
  return 1
}

# Push each branch
success_count=0
failed_count=0
failed_branches=()

for branch in "${FIXED_BRANCHES[@]}"; do
  echo ""
  echo "----------------------------------------"
  echo "Branch: $branch"
  echo "----------------------------------------"

  if push_with_retry "$branch"; then
    success_count=$((success_count + 1))
  else
    failed_count=$((failed_count + 1))
    failed_branches+=("$branch")
  fi
done

# Summary
echo ""
echo "=========================================="
echo "Push Summary"
echo "=========================================="
echo "Total branches: ${#FIXED_BRANCHES[@]}"
echo "Successfully pushed: $success_count"
echo "Failed: $failed_count"

if [ $failed_count -gt 0 ]; then
  echo ""
  echo "Failed branches:"
  for branch in "${failed_branches[@]}"; do
    echo "  - $branch"
  done
  echo ""
  echo "You may need to push these manually or check permissions."
fi

echo "=========================================="
