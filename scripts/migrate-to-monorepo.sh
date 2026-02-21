#!/bin/bash
# ============================================================================
# PNPtv Monorepo Migration Script
# ============================================================================
# Purpose: Automatically migrate current structure to NPM Workspaces monorepo
#
# What it does:
#   1. Create backup of current state
#   2. Create /apps/ directory structure
#   3. Create /packages/ directory structure (config, api-client)
#   4. Move webapps to apps/ with new names
#   5. Move /src/ to /apps/backend/
#   6. Update package.json files
#   7. Create workspace configuration
#
# Usage: bash scripts/migrate-to-monorepo.sh [--dry-run] [--backup-only]
#
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DRY_RUN=false
BACKUP_ONLY=false
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/repo_backup_${TIMESTAMP}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ============================================================================
# Helper Functions
# ============================================================================

log_info() {
  echo -e "${BLUE}ℹ ${NC}$1"
}

log_success() {
  echo -e "${GREEN}✓ ${NC}$1"
}

log_error() {
  echo -e "${RED}✗ ${NC}$1"
}

log_warning() {
  echo -e "${YELLOW}⚠ ${NC}$1"
}

run_cmd() {
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] $1"
  else
    eval "$1"
  fi
}

# ============================================================================
# Backup Current State
# ============================================================================

backup_repo() {
  log_info "Creating backup of current repository..."

  if [ ! -d "$BACKUP_DIR" ]; then
    run_cmd "mkdir -p $BACKUP_DIR"
  fi

  # Backup critical files
  run_cmd "cp -r $REPO_ROOT/webapps $BACKUP_DIR/ 2>/dev/null || true"
  run_cmd "cp -r $REPO_ROOT/src $BACKUP_DIR/ 2>/dev/null || true"
  run_cmd "cp -r $REPO_ROOT/packages $BACKUP_DIR/ 2>/dev/null || true"
  run_cmd "cp -r $REPO_ROOT/apps $BACKUP_DIR/ 2>/dev/null || true"
  run_cmd "cp $REPO_ROOT/package.json $BACKUP_DIR/package.json.backup"
  run_cmd "cp $REPO_ROOT/ecosystem.config.js $BACKUP_DIR/ecosystem.config.js.backup 2>/dev/null || true"

  log_success "Backup created at: $BACKUP_DIR"
}

# ============================================================================
# Create Directory Structure
# ============================================================================

create_directory_structure() {
  log_info "Creating new directory structure..."

  # Create packages/ subdirectories
  run_cmd "mkdir -p $REPO_ROOT/packages/config"
  run_cmd "mkdir -p $REPO_ROOT/packages/api-client/src"
  run_cmd "mkdir -p $REPO_ROOT/packages/ui-kit/src"

  # Create apps/ subdirectories (they will be populated later)
  run_cmd "mkdir -p $REPO_ROOT/apps"

  log_success "Directory structure created"
}

# ============================================================================
# Create Shared Packages
# ============================================================================

create_config_package() {
  log_info "Creating @pnptv/config package..."

  # Create vite.base.js
  run_cmd "cat > $REPO_ROOT/packages/config/vite.base.js << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../apps/*/src'),
    },
  },
  build: {
    target: 'es2020',
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
})
EOF
"

  # Create package.json for config
  run_cmd "cat > $REPO_ROOT/packages/config/package.json << 'EOF'
{
  \"name\": \"@pnptv/config\",
  \"version\": \"1.0.0\",
  \"private\": true,
  \"description\": \"Centralized Vite, ESLint, and TypeScript configuration\",
  \"files\": [\"vite.base.js\", \"eslint.config.js\", \"tsconfig.json\"],
  \"keywords\": [\"vite\", \"config\", \"monorepo\"],
  \"devDependencies\": {
    \"vite\": \"^7.3.1\",
    \"@vitejs/plugin-react\": \"^4.0.0\"
  }
}
EOF
"

  log_success "@pnptv/config package created"
}

create_api_client_package() {
  log_info "Creating @pnptv/api-client package..."

  # Create index.js
  run_cmd "cat > $REPO_ROOT/packages/api-client/src/index.js << 'EOF'
import axios from 'axios'

export const apiClient = axios.create({
  baseURL: '/api/webapp',
  withCredentials: true,
})

// Auto-redirect to login on 401
apiClient.interceptors.response.use(
  (res) => res.data,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/auth/'
    }
    return Promise.reject(error)
  }
)

export default apiClient
EOF
"

  # Create client.js
  run_cmd "cat > $REPO_ROOT/packages/api-client/src/client.js << 'EOF'
import apiClient from './index.js'

export const profileAPI = {
  getProfile: () => apiClient.get('/profile'),
  updateProfile: (data) => apiClient.put('/profile', data),
  uploadAvatar: (formData) => apiClient.post('/profile/avatar', formData),
}

export const mediaAPI = {
  getVideorama: () => apiClient.get('/media/videorama'),
  getLiveStreams: () => apiClient.get('/live/streams'),
  getRadioNowPlaying: () => apiClient.get('/radio/now-playing'),
}

export const chatAPI = {
  getChatHistory: (room) => apiClient.get('/chat/' + room + '/history'),
  sendMessage: (room, msg) => apiClient.post('/chat/' + room + '/send', { message: msg }),
}

export default { profileAPI, mediaAPI, chatAPI }
EOF
"

  # Create package.json
  run_cmd "cat > $REPO_ROOT/packages/api-client/package.json << 'EOF'
{
  \"name\": \"@pnptv/api-client\",
  \"version\": \"1.0.0\",
  \"private\": true,
  \"description\": \"Centralized API client with Axios and interceptors\",
  \"main\": \"src/index.js\",
  \"exports\": {
    \".\": \"./src/index.js\",
    \"./client\": \"./src/client.js\"
  },
  \"keywords\": [\"api\", \"axios\", \"client\"],
  \"dependencies\": {
    \"axios\": \"^1.13.2\"
  }
}
EOF
"

  log_success "@pnptv/api-client package created"
}

create_ui_kit_package() {
  log_info "Creating @pnptv/ui-kit package..."

  run_cmd "cat > $REPO_ROOT/packages/ui-kit/package.json << 'EOF'
{
  \"name\": \"@pnptv/ui-kit\",
  \"version\": \"1.0.0\",
  \"private\": true,
  \"description\": \"Design system and reusable React components\",
  \"main\": \"src/index.js\",
  \"keywords\": [\"ui\", \"design-system\", \"components\"],
  \"peerDependencies\": {
    \"react\": \"^18.0.0\",
    \"react-dom\": \"^18.0.0\"
  }
}
EOF
"

  log_success "@pnptv/ui-kit package created"
}

# ============================================================================
# Migrate Webapps to Apps
# ============================================================================

migrate_webapps_to_apps() {
  log_info "Migrating webapps to apps/..."

  # Mapping: old_name → new_name
  declare -A app_mapping=(
    ["prime-hub"]="hub"
    ["hangouts"]="hangouts"
    ["live"]="media-live"
    ["radio"]="media-radio"
    ["videorama"]="media-videorama"
    ["portal"]="portal"
  )

  for old_name in "${!app_mapping[@]}"; do
    new_name="${app_mapping[$old_name]}"
    old_path="$REPO_ROOT/webapps/$old_name"
    new_path="$REPO_ROOT/apps/$new_name"

    if [ -d "$old_path" ]; then
      log_info "  Moving webapps/$old_name → apps/$new_name"

      if [ "$DRY_RUN" = true ]; then
        log_info "[DRY-RUN] mv $old_path $new_path"
      else
        mkdir -p "$REPO_ROOT/apps"
        mv "$old_path" "$new_path"
      fi
    fi
  done

  log_success "Webapps migrated to apps/"
}

# ============================================================================
# Migrate Backend
# ============================================================================

migrate_backend() {
  log_info "Migrating backend (src/ → apps/backend/)..."

  if [ -d "$REPO_ROOT/src" ]; then
    if [ "$DRY_RUN" = true ]; then
      log_info "[DRY-RUN] mv $REPO_ROOT/src $REPO_ROOT/apps/backend"
    else
      mv "$REPO_ROOT/src" "$REPO_ROOT/apps/backend"
    fi

    # Create basic package.json for backend if missing
    if [ ! -f "$REPO_ROOT/apps/backend/package.json" ]; then
      run_cmd "cat > $REPO_ROOT/apps/backend/package.json << 'EOF'
{
  \"name\": \"@pnptv/backend\",
  \"version\": \"1.0.0\",
  \"private\": true,
  \"description\": \"PNPtv Express.js backend and Telegram bot\",
  \"main\": \"src/bot/core/bot.js\",
  \"scripts\": {
    \"start\": \"node src/bot/core/bot.js\",
    \"dev\": \"nodemon src/bot/core/bot.js\"
  }
}
EOF
"
    fi

    log_success "Backend migrated to apps/backend/"
  fi
}

# ============================================================================
# Update Root package.json
# ============================================================================

update_root_package_json() {
  log_info "Updating root package.json with workspace configuration..."

  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] Would update root package.json"
    return
  fi

  # Read current package.json
  local current_json=$(cat "$REPO_ROOT/package.json")

  # Create new package.json with workspaces (keeping existing content)
  local new_json=$(echo "$current_json" | jq \
    '.workspaces = {
      "packages": ["packages/*", "apps/*"]
    } |
    .scripts.build = "npm run build --workspace=\"@pnptv/*\"" |
    .scripts["build:hub"] = "npm run build --workspace=@pnptv/hub" |
    .scripts["build:backend"] = "npm run build --workspace=@pnptv/backend" |
    .scripts["dev:backend"] = "npm run dev --workspace=@pnptv/backend" |
    .scripts["dev:hub"] = "npm run dev --workspace=@pnptv/hub" |
    .scripts.lint = "npm run lint --workspace=\"@pnptv/*\"" |
    .scripts.test = "npm run test --workspace=\"@pnptv/*\"" ')

  run_cmd "echo '$new_json' > $REPO_ROOT/package.json"

  log_success "Root package.json updated with workspace configuration"
}

# ============================================================================
# Create pnpm-workspace.yaml (optional)
# ============================================================================

create_pnpm_workspace() {
  log_info "Creating pnpm-workspace.yaml for pnpm support..."

  run_cmd "cat > $REPO_ROOT/pnpm-workspace.yaml << 'EOF'
packages:
  - 'packages/*'
  - 'apps/*'
EOF
"

  log_success "pnpm-workspace.yaml created"
}

# ============================================================================
# Cleanup
# ============================================================================

cleanup_old_structure() {
  log_info "Cleaning up old directory structure..."

  if [ "$DRY_RUN" = false ]; then
    # Remove empty webapps/ directory if it exists
    if [ -d "$REPO_ROOT/webapps" ] && [ -z "$(ls -A $REPO_ROOT/webapps 2>/dev/null)" ]; then
      run_cmd "rmdir $REPO_ROOT/webapps"
      log_success "Removed empty webapps/ directory"
    fi
  fi
}

# ============================================================================
# Summary & Instructions
# ============================================================================

print_summary() {
  echo ""
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║             Monorepo Migration Complete! ✓                    ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo ""
  echo -e "${GREEN}Migration Changes:${NC}"
  echo "  ✓ Created /packages/ (config, api-client, ui-kit)"
  echo "  ✓ Moved /src/ → /apps/backend/"
  echo "  ✓ Moved /webapps/{app} → /apps/{app}"
  echo "  ✓ Updated root package.json with workspace config"
  echo "  ✓ Created pnpm-workspace.yaml"
  echo ""
  echo -e "${GREEN}Backup Location:${NC}"
  echo "  $BACKUP_DIR"
  echo ""
  echo -e "${BLUE}Next Steps:${NC}"
  echo "  1. Verify changes:"
  echo "     npm workspaces list"
  echo ""
  echo "  2. Install dependencies:"
  echo "     npm install"
  echo ""
  echo "  3. Build all apps:"
  echo "     npm run build"
  echo ""
  echo "  4. Test development server:"
  echo "     npm run dev:backend &"
  echo "     npm run dev:hub"
  echo ""
  echo "  5. Commit to git:"
  echo "     git add -A"
  echo "     git commit -m 'chore: migrate to npm workspaces monorepo'"
  echo ""
  echo -e "${YELLOW}Reverting Migration (if needed):${NC}"
  echo "  cp -r $BACKUP_DIR/* ."
  echo "  git reset --hard"
  echo ""
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
  echo ""
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║         PNPtv NPM Workspaces Monorepo Migration               ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo ""

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --dry-run)
        DRY_RUN=true
        log_warning "DRY-RUN MODE: No changes will be made"
        shift
        ;;
      --backup-only)
        BACKUP_ONLY=true
        log_info "BACKUP-ONLY MODE: Will create backup and exit"
        shift
        ;;
      *)
        echo "Unknown option: $1"
        exit 1
        ;;
    esac
  done

  log_info "Repository root: $REPO_ROOT"
  echo ""

  # Backup current state
  backup_repo

  if [ "$BACKUP_ONLY" = true ]; then
    log_success "Backup created. Exiting."
    exit 0
  fi

  # Create new structure
  create_directory_structure
  create_config_package
  create_api_client_package
  create_ui_kit_package

  # Migrate existing code
  migrate_webapps_to_apps
  migrate_backend

  # Update configuration
  update_root_package_json
  create_pnpm_workspace

  # Cleanup
  cleanup_old_structure

  # Print summary
  print_summary
}

# Run main
main "$@"
