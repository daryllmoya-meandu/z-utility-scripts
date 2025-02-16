#!/bin/zsh

set -e

echo "===================================================================================================="

# Load NVM directly from common installation path
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh"
    echo "NVM loaded from $HOME/.nvm/nvm.sh"
elif [ -s "/usr/local/opt/nvm/nvm.sh" ]; then
    source "/usr/local/opt/nvm/nvm.sh"
    echo "NVM loaded from /usr/local/opt/nvm/nvm.sh"
else
    echo "NVM is not installed. Skipping Node version setup."
fi

repo_name=${1%%:*}
repo_branch=${1#*:}

# Debugging output to confirm variable values
echo "Repo name:branch >>>>>>>>>> $repo_name:$repo_branch <<<<<<<<<<<<"

# Resolve the absolute path of the repository
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
TARGET_DIR="$BASE_DIR/$repo_name"

# Change to the specified directory
if [ -d "$TARGET_DIR" ]; then
    cd "$TARGET_DIR" || { echo "Failed to change to directory: $TARGET_DIR"; exit 1; }
else
    echo "Directory does not exist: $TARGET_DIR"
    exit 1
fi

echo "Updating repository ($TARGET_DIR) ..."
git fetch --all -p

# Track if package.json was updated
package_json_changed=false

# Check if the branch exists before switching
if git show-ref --quiet "refs/heads/$repo_branch" || git ls-remote --exit-code --heads origin "$repo_branch"; then
    echo "Switching to branch $repo_branch ..."
    git checkout "$repo_branch"

    # Ensure we have the latest remote changes
    git fetch origin "$repo_branch"

    # Determine the SHA of the remote branch
    remote_branch_sha=$(git rev-parse "origin/$repo_branch")

    # Ensure the SHA exists before using it
    if [[ -z "$remote_branch_sha" ]]; then
        echo "Error: Could not determine remote branch SHA for $repo_branch."
        exit 1
    fi

    # Check for changes in package.json compared to the remote branch
    if git diff --quiet "$remote_branch_sha" -- package.json; then
        echo "No changes detected in package.json."
    else
        echo "Changes detected in package.json."
        package_json_changed=true
    fi

    git pull origin "$repo_branch"
    git gc --aggressive

    # Automatically delete local branches with no remote tracking
    echo "Cleaning up local branches with no remote tracking ..."
    git branch -vv | awk '/: gone]/ {print $1}' | xargs -r git branch -D

    echo "Branch cleanup completed."
else
    echo "Branch $repo_branch not found in $TARGET_DIR"
    exit 1
fi

# Use Node.js version specified in .nvmrc
nvm use || echo "Warning: NVM setup failed. Using default Node.js version."
echo "Using Node.js version: $(node -v)"

# Optional: Check for .nvmrc file to notify about missing version control
if [[ ! -f ".nvmrc" ]]; then
    echo "No .nvmrc file found in $TARGET_DIR; using default Node.js version."
fi

# If package.json changed, run npm install/yarn install
if [ "$package_json_changed" = true ]; then

    # Remove node_modules folder entirely to keep all dependencies up tcdo date
    if command -v remove-node-modules &> /dev/null; then
        remove-node-modules
    else
        echo "Warning: remove-node-modules command not found. Skipping cleanup."
    fi

    if [[ -f "yarn.lock" ]]; then
        echo "Installing dependencies using Yarn..."
        yarn install
    elif [[ -f "package-lock.json" ]]; then
        echo "Installing dependencies using NPM..."
        npm install
    else
        echo "No lock file found in $TARGET_DIR; dependencies were not installed."
    fi
fi

# Final confirmation message
echo "Repository $TARGET_DIR is up-to-date and dependencies are handled."