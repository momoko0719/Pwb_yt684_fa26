# Git and GitHub Tutorial

A short starter guide for version control in this course. Use Git locally, then push to GitHub so your work is backed up and shareable.

---

## What are Git and GitHub?

| Tool | What it is |
| --- | --- |
| **Git** | Software on your computer that tracks changes to files over time |
| **GitHub** | A website that hosts Git repositories online (backup + collaboration) |

Think of Git as a save history for your project, and GitHub as the cloud copy of that history.

---

## 1. One-time setup

### Install Git

- **Windows:** Download from [git-scm.com](https://git-scm.com/)
- **Mac:** `brew install git` (or install Xcode Command Line Tools)
- Check it worked:

```bash
git --version
```

### Tell Git who you are

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

Use the same email as your GitHub account.

### Create a GitHub account

1. Go to [github.com](https://github.com) and sign up
2. Create a new repository (or accept/clone the course one)
3. Keep the repo private or public — either is fine for class work

---

## 2. Core ideas (in plain language)

- **Repository (repo):** Your project folder tracked by Git
- **Commit:** A snapshot of your files with a short message explaining *why* you changed them
- **Branch:** A parallel line of work (beginners usually stay on `main`)
- **Remote:** The online copy on GitHub (often named `origin`)
- **Push:** Send your local commits to GitHub
- **Pull:** Download new commits from GitHub to your computer

---

## 3. Everyday workflow

Do this whenever you finish a chunk of work (notes, code, an experiment):

### Check status

```bash
git status
```

Shows which files are new, changed, or ready to commit.

### Stage files

```bash
git add .
```

Or stage one file:

```bash
git add path/to/file.md
```

### Commit

```bash
git commit -m "Add class 02 notes on Git basics"
```

Good messages are short and say *why*, not just "update".

### Push to GitHub

```bash
git push
```

If this is the first push on a new branch:

```bash
git push -u origin main
```

### Pull before you start (good habit)

```bash
git pull
```

Especially useful if you edit from more than one computer.

---

## 4. Clone an existing repo

If the project already lives on GitHub:

```bash
git clone https://github.com/USERNAME/REPO-NAME.git
cd REPO-NAME
```

Then use the everyday workflow above.

---

## 5. Useful commands cheat sheet

| Command | What it does |
| --- | --- |
| `git status` | See current changes |
| `git add .` | Stage everything |
| `git commit -m "message"` | Save a snapshot |
| `git push` | Upload commits to GitHub |
| `git pull` | Download latest from GitHub |
| `git log --oneline` | View recent commit history |
| `git diff` | See unstaged changes line by line |
| `git restore filename` | Discard local changes to a file |

---

## 6. Simple weekly habit for this class

1. Make your changes (notes, experiments, docs)
2. `git status` — confirm what changed
3. `git add .`
4. `git commit -m "Short clear message"`
5. `git push`
6. Optionally write a short progress note in the repo

That matches the backlog goal: **weekly GitHub push + short progress report**.

---

## 7. Common problems

### "Nothing to commit"

Nothing is staged, or there are no changes. Run `git status` and `git add` first.

### Push rejected / out of date

Someone (or another computer) pushed first. Run:

```bash
git pull
```

Fix any conflicts if Git asks, then commit and push again.

### Forgot to pull before editing

Still run `git pull`. If Git reports conflicts, open the marked files, keep the correct text, then:

```bash
git add .
git commit -m "Resolve merge conflict"
git push
```

### Don't commit secrets

Avoid committing passwords, API keys, or `.env` files. If unsure, ask before pushing.

---

## 8. Quick practice exercise

1. Create or open this course repo
2. Add a small note file (or edit this tutorial)
3. Run:

```bash
git status
git add .
git commit -m "Practice: first Git commit for class"
git push
```

4. Refresh the repo page on GitHub and confirm your commit appears

---

## Next steps (optional)

- Learn branches (`git branch`, `git checkout -b feature-name`) when you want to try experiments safely
- Use GitHub Issues or a `BACKLOG.md` to track ideas
- Open a Pull Request when collaborating with others

For more depth later: [Git Handbook (GitHub Docs)](https://docs.github.com/en/get-started/git-basics/git-workflows)
