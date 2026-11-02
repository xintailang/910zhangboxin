---
name: commit-push-910
description: Commit this project and push it to github.com/xintailang/910zhangboxin over SSH using the existing ed25519 key. Use when the user asks to commit, push, sync, 提交 or 推送 this project to that GitHub repo. Do not use for other repositories.
---

# Commit and Push to 910zhangboxin

Push the current project in `d:\wangyesheji` to:

- SSH remote (required): `git@github.com:xintailang/910zhangboxin.git`
- Browser URL: `https://github.com/xintailang/910zhangboxin.git`
- Identity: `~/.ssh/id_ed25519`, routed by `~/.ssh/config` (`Host github.com` → `ssh.github.com:443`). Never regenerate or replace this key, and never edit the `config` file.

Always use the SSH URL. HTTPS would bypass the configured key.

## Steps

### 1. Inspect repository state

```powershell
git rev-parse --is-inside-work-tree
git remote -v
git status --short
git branch --show-current
```

- Not a Git repo → initialize with `git init -b main`.
- No `origin` → add it. `origin` pointing at another repo → remove it first, then add the correct one:

```powershell
git remote add origin git@github.com:xintailang/910zhangboxin.git
```

### 2. Align with the remote branch

```powershell
git ls-remote --symref origin HEAD
```

- Empty output means the remote repo is empty: stay on `main`.
- Remote reports `refs/heads/main` → use `main`; `refs/heads/master` → rename locally with `git branch -M master`.

### 3. Stage and commit

```powershell
git status --short
git add <specific files>
git commit -m "<message>"
```

- Stage files by name or directory, not `git add -A`.
- Never commit `.env`, credentials, private keys, or build caches.
- Message: 1–2 sentences, why-focused, Chinese or English, following `git log` style.
- Nothing staged after review → skip the commit and say so.

### 4. Push

```powershell
git push -u origin main
```

Use `git push` when the upstream is already set. Never force push to `main`.

### 5. Verify

```powershell
git status -sb
git log -1 --oneline
git ls-remote --heads origin
```

Report the commit hash, branch, and remote confirmation. Claim success only after `ls-remote` shows the pushed commit.

## Failure handling

- `Permission denied (publickey)` → run `ssh -T git@github.com`; success prints `Hi xintailang! You've successfully authenticated`. If it fails, tell the user the public key `~/.ssh/id_ed25519.pub` must be added to the GitHub account. Do not create a new key.
- `Repository not found` → the repo or access is missing; ask the user instead of retrying.
- Non-fast-forward → `git pull --rebase origin main`, then push. Never `--force`.
- Files over 50 MB → report them before committing.
