# Bloom — Focus & Grow

Bloom is a cozy pixel-art productivity app that connects Pomodoro focus sessions to plant growth, tasks, quests, garden customization, analytics, friends and weekly competition.

**The existing pastel frontend is preserved as the Home dashboard.** New features are added in matching visual styling.

## Included

- Existing pixel-art plant canvas, Pomodoro timer, sound controls, garden shelf and stats
- Responsive sidebar navigation and feature screens
- FastAPI API and PostgreSQL support (SQLite is used automatically for local development)
- Account registration/sign-in with PBKDF2 password hashing and signed bearer tokens
- Per-user tasks and focus-session history
- Server-calculated focus rewards, XP, seeds, plant growth and quests
- Plant collection, garden item shop and grid placement
- Focus-world unlocks, selection preferences and matching pastel palette variants
- Progress heatmap, achievements and weekly leaderboard
- Friend requests, accepting/removing connections and garden visits
- User profile/privacy settings, friend removal and blocking
- Render Blueprint configuration

## Run locally

Requires Python 3.11+ (Python 3.12 recommended).

```bash
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Install and run:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open <http://127.0.0.1:8000>. API docs: <http://127.0.0.1:8000/docs>.

Without `DATABASE_URL`, local development uses `bloom-local.db` (SQLite). To use PostgreSQL, set `DATABASE_URL` to a PostgreSQL connection string.

## Environment variables

- `DATABASE_URL`: PostgreSQL connection string (copy `.env.example` to `.env`; it is loaded automatically). SQLite fallback is local-only.
- `BLOOM_SECRET_KEY`: set a long random secret in production. The development fallback is not safe for public deployment.
- `BLOOM_TOKEN_TTL_DAYS`: bearer token lifetime (default 14).

## Deploy on Render

1. Push the project to a Git repository.
2. In Render, create a Blueprint from the repository and review `render.yaml`.
3. The Blueprint provisions a web service and PostgreSQL database.
4. Confirm `BLOOM_SECRET_KEY` is generated and `DATABASE_URL` points to the managed database.
5. Deploy and test `/api/health`, registration, login, task creation and a completed session.

**Cost note:** the included `render.yaml` selects the `starter` web-service plan and `basic-256mb` PostgreSQL plan, which are paid plan selections. Review the current Render dashboard and pricing before approving the Blueprint. Do not assume this configuration is free.

## Important product notes

- The browser timer is designed to remain usable in local demo mode. Saved multi-device progress, social features and authoritative rewards require signing in.
- Focus rewards are based on elapsed server-recorded time, with a minimum one-minute eligibility threshold for development testing. Recorded duration is capped to the timer mode's configured length, and cancelled sessions cannot be completed for rewards. This is a portfolio MVP, not an anti-cheat system suitable for high-stakes prizes.
- The `Focus worlds` page currently persists world selection/unlocks and displays the themed scene descriptions; full unique animated backgrounds and dedicated audio packs are a future visual milestone.
- Social launch features include accounts, friend requests, friend garden visits, privacy settings and weekly leaderboard. Real-time shared focus rooms, live chat and group challenges are intentionally deferred.
- Garden placement is a basic 8×6 grid. Plants appear in the collection; decoration placement persists.
- Use database migrations (for example Alembic) before evolving an established production database. This starter creates tables on startup for straightforward local setup.
- Before public launch, add email verification, password reset, rate limiting, CSRF strategy if moving to cookie auth, robust migration/backup procedures, tests, and moderation/reporting flows for social features.

## Project layout

```text
bloom-full/
├── app/
│   ├── __init__.py
│   └── main.py
├── public/
│   ├── index.html
│   ├── css/
│   │   ├── style.css          # preserved original Bloom design
│   │   └── app-shell.css       # new navigation/features in matching style
│   └── js/
│       ├── script.js           # preserved pixel art/timer behavior, local cache
│       └── app-shell.js        # API integration and new feature screens
├── requirements.txt
├── render.yaml
└── README.md
```
