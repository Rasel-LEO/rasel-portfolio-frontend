# Setup — Windows, PowerShell, GitHub

Author: Rasel Al Mamun

Every command is for **PowerShell 7** (`pwsh`) unless marked otherwise. Run PowerShell as
your normal user, not Administrator.

## 1. Install the tools (one time)

```powershell
winget install --id Git.Git -e
winget install --id GitHub.cli -e
winget install --id OpenJS.NodeJS.LTS -e            # Node 24 LTS
winget install --id Microsoft.PowerShell -e         # PowerShell 7
winget install --id Microsoft.VisualStudioCode -e   # optional editor
winget install --id Docker.DockerDesktop -e         # optional, for npm run test:linux
```

Close and reopen PowerShell 7, then check:

```powershell
git --version; gh --version; node --version; npm --version
```

Node must print `v24.x`.

## 2. Git identity (one time)

```powershell
git config --global user.name  "Md Rasel Al Mamun"
git config --global user.email "<the email you use on GitHub>"
git config --global init.defaultBranch main
git config --global core.autocrlf input
```

In GitHub → Settings → Emails the `…@users.noreply.github.com` address keeps the real email
out of public commits.

## 3. Sign in to GitHub CLI (one time)

```powershell
gh auth login
```

Choose GitHub.com → HTTPS → Yes (authenticate Git) → Login with a web browser, then approve
the one-time code in the browser. Check with `gh auth status`.

## 4. Clone and install

```powershell
Set-Location "E:\WebDev\Frontend Design"
gh repo clone Rasel-LEO/rasel-portfolio-frontend
Set-Location rasel-portfolio-frontend
npm ci
npx playwright install chromium
npm run dev                               # http://localhost:5173
```

The folder name "Frontend Design" contains a space: always quote the path.

## 5. Repository settings (GitHub → Settings)

- **General → Features**: Issues on, Wiki off.
- **Code security**: Secret scanning, Push protection and Dependabot alerts on. Version
  updates come from `.github/dependabot.yml` in the public repository (FD-138).
- **Branches → Add branch ruleset** for `main`: require a pull request before merging,
  require the `ci` status check, block force pushes.

## 6. Everyday work

One change or release per branch, one pull request, squash merge with the pull request title
as the message (FD-06). Update `CHANGELOG.md` and the version for a release.

```powershell
git switch main; git pull
git switch -c release/x.y.z-short-name
# … edit …
npm run lint; npm run build; npm test
git push -u origin release/x.y.z-short-name
gh pr create --fill --base main
gh pr checks --watch                      # wait for green CI
gh pr merge --squash --delete-branch
git switch main; git pull
```

### Linux run before pushing (`npm run test:linux`)

CI runs on ubuntu-24.04, whose Chromium and fonts differ from Windows (layout-shift and
font-swap tests can pass here and fail there). `npm run test:linux` runs the suite inside the
official Playwright image that matches `@playwright/test` in `package.json`
(`mcr.microsoft.com/playwright:v<version>-noble`). It needs Docker Desktop running
(`docker desktop start`). The repository is mounted read-only and copied into the container
without `node_modules` / `dist`, so `npm ci` there never touches the Windows install; the
container is removed when it exits.

```powershell
npm run test:linux                                                          # full suite on Linux
npm run test:linux -- tests/inner-pages.spec.js -g "CLS" --repeat-each=5   # build + one test
```

## 7. Troubleshooting

| Symptom                              | Fix                                                             |
| ------------------------------------ | --------------------------------------------------------------- |
| `running scripts is disabled`        | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`           |
| Path errors with "Frontend Design"   | put the path in double quotes                                   |
| `npm ci` fails after a branch switch | delete `node_modules` and run `npm ci` again                    |
| Playwright cannot find a browser     | `npx playwright install chromium`                               |
| CI red, local green                  | `gh run view --log-failed`; reproduce with `npm run test:linux` |
