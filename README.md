# z-utils-scripts

This repository contains a set of utility scripts designed to automate and streamline the process of managing multiple repositories. These scripts help with tasks such as updating repositories, fetching the latest branches, and managing dependencies.

## 📂 Script Overview

### 1. **update-all-repos.sh**

- **Purpose:** Updates all repositories listed in `mryum-repo-list.txt`.
- **Features:**
  - Supports **parallel** and **sequential** execution modes.
  - Logs output to a dedicated directory.
  - Tracks progress dynamically.
  - Calls `fetch-latest-branch.sh` internally; it is **not meant to be run manually**.
- **Usage:**

  ```sh
  ./update-all-repos.sh [parallel|sequential]
  ```

### 2. **fetch-latest-branch.sh**

- **Purpose:** Fetches the latest branch of a specified repository.
- **Note:** This script is **not intended to be run manually**. It is called internally by `update-all-repos.sh`.
- **Features:**
  - Ensures the correct Node.js version is used via `.nvmrc`.
  - Cleans up old branches.
  - Detects changes in `package.json` to decide whether dependencies need reinstallation.

### 3. **mryum-repo-list.txt**

- **Purpose:** A text file containing a list of repositories to be updated.
- **Format:**

  ```sh
  repo1
  repo2
  repo3
  ```

### 4. **release-reporter.js**

- **Purpose:** Generates a report of recent releases across repositories.
- **Features:**
  - Fetches commit history.
  - Identifies tagged releases.
  - Outputs structured data.
- **Usage:**

  ```sh
  BUILDKITE_API_TOKEN="replace_buildkite_api_token" ./release-reporter.js | pbcopy
  ```

- **Purpose:** Generates a report of recent releases across repositories.
- **Features:**
  - Fetches commit history.
  - Identifies tagged releases.
  - Outputs structured data.
- **Usage:**

  ```sh
  node release-reporter.js
  ```

## 🛠 Setup & Installation

1. **Clone this repository:**

   ```sh
   git clone <repo-url>
   cd z-utils-scripts
   ```

2. **Ensure dependencies are installed:**

   - Requires `git`, `zsh`, and `Node.js` (managed via NVM).
   - Install necessary npm dependencies if using `release-reporter.js`:

     ```sh
     npm install
     ```

3. **Set permissions:**

   ```sh
   chmod +x *.sh
   ```

## 🚀 Best Practices

- Always **review changes** before running `update-all-repos.sh` to avoid unintended resets.
- Run `fetch-latest-branch.sh` in a separate test repo before using it in production.
- Use `release-reporter.js` for tracking new features and bug fixes efficiently.
