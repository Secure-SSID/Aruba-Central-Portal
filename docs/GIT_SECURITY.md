# Git Security Guide

This document provides guidance on maintaining security when working with git repositories, especially regarding sensitive data.

## Preventing Accidental Commits

### Files Already Protected

The following files and patterns are already excluded via `.gitignore`:

- `.env*` - Environment variable files
- `*.token_cache.json` - Token cache files
- `*.key`, `*.pem`, `*.crt` - Certificate and key files
- `credentials.json`, `secrets.json` - Credential files
- `*.csv`, `*.xlsx` - Exported data files
- `*.log` - Log files
- `data/` - Data directory
- `sessions.json` - Session storage

### .gitattributes Protection

The `.gitattributes` file ensures that sensitive file types are handled correctly and prevents accidental commits of binary or sensitive data.

## If Sensitive Data Was Committed

If you accidentally committed sensitive data (credentials, API keys, etc.) to the repository, follow these steps:

### Option 1: Remove from Recent Commit (Not Yet Pushed)

If the commit hasn't been pushed yet:

```bash
# Remove the file from the last commit
git rm --cached .env
git commit --amend

# Or remove from staging
git reset HEAD .env
```

### Option 2: Remove from Git History (Already Pushed)

**⚠️ WARNING:** This rewrites git history. Coordinate with your team before doing this.

#### Using git filter-branch (Built-in)

```bash
# Remove a file from entire history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (coordinate with team first!)
git push origin --force --all
git push origin --force --tags
```

#### Using BFG Repo-Cleaner (Recommended - Faster)

1. Install BFG: `brew install bfg` (macOS) or download from https://rtyley.github.io/bfg-repo-cleaner/

2. Remove sensitive file:
```bash
# Clone a fresh copy
git clone --mirror https://github.com/your-repo.git repo-clean.git

# Remove the file
bfg --delete-files .env repo-clean.git

# Clean up
cd repo-clean.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Push (coordinate with team!)
git push
```

#### Remove Specific Strings from History

If you need to remove a specific API key or password that was committed:

```bash
# Using git filter-branch
git filter-branch --force --tree-filter \
  "find . -type f -exec sed -i '' 's/YOUR_ACTUAL_API_KEY/REMOVED/g' {} +" \
  --prune-empty --tag-name-filter cat -- --all
```

### Option 3: Rotate Credentials (Recommended)

If sensitive data was exposed:

1. **Immediately rotate all exposed credentials:**
   - API keys
   - Client secrets
   - Passwords
   - Tokens

2. **Notify affected parties** if credentials were shared

3. **Review access logs** for any unauthorized usage

4. **Update documentation** to prevent future incidents

## Best Practices

### Before Committing

1. **Review changes:**
   ```bash
   git diff
   git status
   ```

2. **Check for sensitive patterns:**
   ```bash
   # Search for potential API keys
   git diff | grep -i "api.*key\|client.*secret\|password"
   ```

3. **Use pre-commit hooks** (optional):
   - Install `pre-commit`: `pip install pre-commit`
   - Add hooks to detect secrets: https://github.com/Yelp/detect-secrets

### Environment Variables

- **Never commit** `.env` files
- Use `.env.example` as a template with placeholders
- Document required variables in `docs/ENV_VARIABLES.md`
- Use environment-specific files: `.env.development`, `.env.production`

### Configuration Files

- Use `config.yaml` for non-sensitive defaults
- Use `config.local.yaml` (gitignored) for local overrides
- Never commit files with real credentials

### Code Review

- Review all commits before merging
- Look for hardcoded credentials
- Check for accidental inclusion of `.env` files
- Verify sensitive data is properly masked in logs

## Pre-commit Hook Example

Create `.git/hooks/pre-commit`:

```bash
#!/bin/sh
# Check for sensitive patterns
if git diff --cached | grep -E "(api_key|client_secret|password|token)\s*[:=]\s*['\"][^'\"]+['\"]"; then
    echo "ERROR: Potential sensitive data detected in commit!"
    echo "Please review your changes and remove any credentials."
    exit 1
fi
```

## Resources

- [Git Documentation - filter-branch](https://git-scm.com/docs/git-filter-branch)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [GitHub - Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [detect-secrets](https://github.com/Yelp/detect-secrets) - Tool to detect secrets in code

---

**Last Updated:** 2025-01-27  
**Version:** 2.0.0

