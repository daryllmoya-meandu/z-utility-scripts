#!/bin/zsh

BIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)/z-utility-scripts"
echo "BIN_DIR=${BIN_DIR}"
export LOG_DIR="$BIN_DIR/update-all-repos-logs" # Directory for logs
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR" # Cleanup and recreate log directory
export PROCESSES=${PROCESSES:-15} # Default to 15 parallel processes

# Strategy (default to parallel)
strategy="${1:-parallel}"

# Read repo list into an array
REPO_BRANCH=()
while IFS= read -r line || [[ -n "$line" ]]; do
  REPO_BRANCH+=("$line")
done < "$BIN_DIR/mryum-repo-list.txt"

# Total number of repositories (needed for both strategies)
TOTAL_REPOS=${#REPO_BRANCH[@]}
COMPLETED_REPOS=0

display_progress() {
  local completed=$1
  local total=$2
  echo -ne "\rProgress: $((completed * 100 / total))% ($completed/$total)"
}

if [[ "$strategy" == "parallel" ]]; then
  # Parallel approach
  echo "Starting parallel updates with $PROCESSES processes ..."
  rm -f "$LOG_DIR/progress.tmp" && touch "$LOG_DIR/progress.tmp"

  for repo in "${REPO_BRANCH[@]}"; do
    (
      repo_name=$(basename "$repo")
      LOG_FILE="$LOG_DIR/${repo_name}.log"
      $BIN_DIR/fetch-latest-branch.sh "$repo" > "$LOG_FILE" 2>&1
      echo "increment" >> "$LOG_DIR/progress.tmp"
    ) &
    [[ $(jobs -r -p | wc -l) -ge $PROCESSES ]] && wait -n
  done
  wait

  while :; do
    COMPLETED_REPOS=$(wc -l < "$LOG_DIR/progress.tmp" | tr -d ' ')
    display_progress "$COMPLETED_REPOS" "$TOTAL_REPOS"
    [[ "$COMPLETED_REPOS" -ge "$TOTAL_REPOS" ]] && break
    sleep 1
  done

  echo "" # Newline for cleaner output
  echo "Parallel fetching complete. Logs saved in $LOG_DIR."
  rm -f "$LOG_DIR/progress.tmp"

elif [[ "$strategy" == "sequential" ]]; then
  # Sequential approach
  echo "Starting sequential updates..."
  for repo in "${REPO_BRANCH[@]}"; do
    repo_name=$(basename "$repo")
    LOG_FILE="$LOG_DIR/${repo_name}.log"
    $BIN_DIR/fetch-latest-branch.sh "$repo" >> "$LOG_FILE" 2>&1
    ((COMPLETED_REPOS++))
    display_progress "$COMPLETED_REPOS" "$TOTAL_REPOS"
  done
  echo "" # Newline
  echo "Sequential processing complete. Logs saved in $LOG_DIR."

else
  echo "Invalid strategy: $strategy. Use 'parallel' or 'sequential'."
  exit 1
fi
