# -*- coding: utf-8 -*-
#!/usr/bin/env python3
"""
Claude Code Status Line Script
Reads JSON status info from stdin and outputs a formatted status line.
"""
import json
import sys
import os
from pathlib import Path


def get_git_branch(project_dir):
    """Get current git branch name"""
    try:
        git_dir = Path(project_dir) / '.git'
        if git_dir.exists():
            head_file = git_dir / 'HEAD'
            if head_file.exists():
                content = head_file.read_text(encoding='utf-8').strip()
                if content.startswith('ref: refs/heads/'):
                    return content.replace('ref: refs/heads/', '')
        return "no-git"
    except Exception:
        return "unknown"


def get_git_remote(project_dir):
    """Get GitHub remote repository (owner/repo)"""
    try:
        git_dir = Path(project_dir) / '.git'
        if git_dir.exists():
            config_file = git_dir / 'config'
            if config_file.exists():
                content = config_file.read_text(encoding='utf-8')
                lines = content.split('\n')
                in_remote_origin = False
                for line in lines:
                    stripped = line.strip()
                    # Look for [remote "origin"] section
                    if stripped == '[remote "origin"]':
                        in_remote_origin = True
                        continue
                    # Exit section if new section starts
                    if in_remote_origin and stripped.startswith('['):
                        break
                    # Get url from remote origin section
                    if in_remote_origin and stripped.startswith('url = '):
                        url = stripped.split('url = ', 1)[1].strip()
                        if 'github.com' in url:
                            # Handle both SSH and HTTPS formats
                            repo = url.split('github.com')[1]
                            repo = repo.replace(':', '/').replace('.git', '').strip('/')
                            return repo
        return ""
    except Exception:
        return ""


def main():
    """Main function - read JSON from stdin and print status line"""
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print("Claude Code")
            return

        data = json.loads(raw_input)

        # Try multiple possible JSON structures
        # Structure 1: {model: {display_name: ...}}
        # Structure 2: {modelName: ...}
        # Structure 3: direct fields

        model = "Claude"
        if isinstance(data.get('model'), dict):
            model = data['model'].get('display_name', 'Claude')
        elif 'modelName' in data:
            model = data['modelName']
        elif 'model' in data and isinstance(data['model'], str):
            model = data['model']

        # Working directory and project directory
        dir_name = "root"
        project_dir = "."

        if isinstance(data.get('workspace'), dict):
            current_dir = data['workspace'].get('current_dir', '.')
            project_dir = data['workspace'].get('project_dir', '.')
            dir_name = os.path.basename(current_dir) or 'root'
        elif 'cwd' in data:
            dir_name = os.path.basename(data['cwd']) or 'root'
            project_dir = data['cwd']
        elif 'workingDirectory' in data:
            dir_name = os.path.basename(data['workingDirectory']) or 'root'
            project_dir = data['workingDirectory']

        # Git info - use absolute project_dir path
        git_branch = get_git_branch(project_dir)
        git_remote = get_git_remote(project_dir)

        # Cost info
        cost_info = ""
        cost_data = data.get('cost') or data.get('totalCost') or data.get('sessionCost')
        if cost_data:
            if isinstance(cost_data, dict):
                cost_usd = cost_data.get('total_cost') or cost_data.get('totalCost', 0)
            elif isinstance(cost_data, (int, float)):
                cost_usd = cost_data
            else:
                cost_usd = 0
            if cost_usd > 0:
                cost_info = f" | ${cost_usd:.4f}"

        # Final status line - folder and branch only (repo hidden)
        print(f"{dir_name} ({git_branch}){cost_info}")

    except Exception as e:
        # Fallback
        print("Claude Code")


if __name__ == '__main__':
    main()
