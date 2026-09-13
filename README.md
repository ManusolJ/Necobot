<div align="center">

<img src="assets/img/logo.png" width="120" alt="Necobot" />

# Necobot

**A Discord bot with a points economy, minigames, and a local LLM that answers in character.**

It runs continuously on a private server and it's my testbed for whatever I want to learn next.

<br>

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Sapphire](https://img.shields.io/badge/Sapphire-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://www.sapphirejs.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Drizzle](https://img.shields.io/badge/Drizzle-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![Ollama](https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white)](https://ollama.com/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![GitHub Actions](https://img.shields.io/badge/CI-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/features/actions)

[![CI](https://github.com/ManusolJ/Necobot/actions/workflows/deploy.yml/badge.svg)](https://github.com/ManusolJ/Necobot/actions/workflows/deploy.yml)
[![Last commit](https://img.shields.io/github/last-commit/ManusolJ/Necobot?style=for-the-badge)](https://github.com/ManusolJ/Necobot/commits)

<a href="#what-it-does">What it does</a> ·
<a href="#how-it-works">How it works</a> ·
<a href="#tech-stack">Tech stack</a> ·
<a href="#running-it">Running it</a> ·
<a href="#status-and-roadmap">Roadmap</a>

</div>

---

Two things at once: a working bot with a points economy, minigames and an LLM-backed
conversational layer, and a testbed for technologies I want to try. When I want to learn
something new, I usually implement it here first.

---

## What it does

Everything hangs off a **points economy**. Points are earned, spent, wagered, gifted,
confiscated and occasionally lost to bad luck, so the features interlock instead of
sitting next to each other as unrelated toys. Penalties can push a balance below zero,
and debt has to be earned back before spending again.

- **Earning** - begging (with a daily cooldown and a chance to fail), birthday gifts and much more. Every grant from
  the bot is tracked as a lifetime total on the user's profile.
- **Spending** - planting mines in the main channel, making the bot join a voice
  channel and play a clip, slapping people, and putting someone's next few messages
  through an uwufier.
- **Wagering** - rock-paper-scissors duels against another member for a stake, or
  against the bot for a token prize.
- **Image recognition** - show the bot a picture and it says what it sees, using a
  local zero-shot classifier.
- **In-character chat** - mention the bot and a locally hosted model answers as the
  character, with a short per-channel memory.
- **Scheduled** - reminders, birthday announcements a week ahead and on the day, and a
  daily copypasta pulled from Reddit into a dedicated channel.
- **Moderation and admin** - opting users out of everything, confiscating points,
  bulk-deleting messages with an archive copy in a thread, per-guild settings for the
  main channel and purpose-specific channels, and an owner-only command to inspect and
  repair the slash-command registration.

The live command list, with descriptions, is available from the bot itself with `/info`.

---

## How it works

### Structure

[Sapphire](https://www.sapphirejs.dev/) on top of discord.js handles command
registration, preconditions and centralised error handling. The code is split by
responsibility:

- `features/` - one folder per feature, each holding its commands, listeners,
  scheduled tasks, constants and message pools.
- `core/` - services and repositories: the only layer that talks to the database.
- `infrastructure/` - configuration, logging, the database client, the AI clients and
  the domain error types.
- `shared/` - preconditions, cross-cutting listeners, utilities and types.

Guards such as "guild configured", "user not excluded", "target is not a bot" and
"target is not yourself" are preconditions composed per command rather than checks
copied into each handler. Domain errors carry a code that maps to a user-facing message,
so failures reach the user as a short ephemeral reply and reach the logs with context.

New pieces are scaffolded with `npm run g:command`, `g:listener` and `g:precondition`.

### Persistence

SQLite through **Drizzle**, with versioned migrations in `db/migrations` that run on
startup. Migrations seemed overkill at first, but between the constant schema churn and
the need to preserve points across deploys, they earned their place.

All balance changes are guarded at the SQL level (a deduction only succeeds if the balance
covers it; daily cooldowns are claimed atomically), so two quick invocations cannot both
slip through. Games that hold stakes record them in a `game_sessions` table the moment
they are taken; if the process dies mid-game, the next boot refunds every open session
and closes the message it left behind.

### Scheduling

**BullMQ** on Redis backs both the cron-style jobs (birthday sweep, daily copypasta) and
the delayed ones (reminders). Jobs survive restarts, retry with backoff, and the
birthday sweep also runs a catch-up on boot in case the bot was down at the scheduled hour.

### AI, all local

Mentions go to a persona model served by [Ollama](https://ollama.com/) (built from
`ai/necoarc.Modelfile`). Images go through a CLIP zero-shot classifier via
transformers.js, warmed up on startup and cached on disk. The uwufier is a local library
too. Nothing a user writes or posts leaves the machine; the only outbound traffic is the
copypasta fetch.

> [!NOTE]
> The chat responses are frequently incoherent and rarely useful. **This is mostly
> intentional** - the goal was a character with a voice, not a support assistant, and a
> bot that confidently answers wrong is funnier. The current model was chosen for its
> Spanish within the server's resource budget and is subject to change.

### Guardrails

- Opt-out is first-class: an excluded user is invisible to every game, listener and
  targeted command.
- The bot never pings `@everyone` or roles, no matter what a nickname, a reminder note
  or a model reply contains.
- Anything that needs Discord permissions checks them before spending points, so a
  missing permission cannot eat a stake.

### Quality

Strict TypeScript, ESLint and Prettier. Unit tests mock the boundaries; integration tests
run the real repositories against an in-memory SQLite with the real migrations. A drift
test fails whenever a command exists that `/info` does not list. CI runs typecheck, lint,
format check, tests and the build on every push, and deploys `main` to the server over an
SSH tunnel.

### Why it looks like this

This is the third rewrite. Version one worked but was a mess: no structure, errors
surfacing everywhere, command handling and business logic tangled together. Version two
improved it. Version three is where I stopped hand-rolling the plumbing and let the
framework, the ORM and the job queue do their jobs.

> What I learned: the first version taught me what the bot needed to do, and trying to
> keep extending it taught me why structure exists.

---

## Tech stack

| Layer          | Technology                                             |
| :------------- | :----------------------------------------------------- |
| **Language**   | TypeScript (strict), Node 22                           |
| **Framework**  | Sapphire on discord.js                                 |
| **Database**   | SQLite with Drizzle ORM and versioned migrations       |
| **Jobs**       | BullMQ on Redis                                        |
| **AI**         | Ollama (chat persona), transformers.js CLIP (vision)   |
| **Voice**      | @discordjs/voice with ffmpeg                           |
| **Quality**    | Vitest, ESLint, Prettier                               |
| **CI**         | GitHub Actions                                         |
| **Deployment** | Docker Compose, self-hosted on a personal Linux server |

---

## Running it

**Requirements:** Docker, and an Ollama instance reachable from the container. Redis is
part of the compose file.

```bash
git clone https://github.com/ManusolJ/Necobot.git
cd Necobot

cp .env.example .env
# BOT_TOKEN and OLLAMA_URL are required; the rest are optional or have defaults

mkdir -p db/data

docker compose up --build
```

The `mkdir` matters: the container runs as an unprivileged user and the SQLite file lives
on a bind mount, so the directory has to exist first. Migrations run automatically on
startup.

For in-character replies, build the persona model on the Ollama host. The bot requests it
by name and the feature stays silent if it is missing:

```bash
ollama create necoarc -f ai/necoarc.Modelfile
```

For local development without Docker you need Node 22, a Redis instance and the same
`.env`:

```bash
npm install
npm run dev                     # tsx watch
npm test                        # vitest
npm run db:generate -- <name>   # after changing the schema
```

> [!IMPORTANT]
> `.env.example` documents every variable. Set `DISCORD_DEV_GUILD_ID` to mirror the
> global commands into a test server instantly instead of waiting for Discord's global
> rollout.

---

## Status and roadmap

Live and in continuous use on one private server. Not built to be a public, multi-guild
bot.

- [x] Scheduled features on the task infrastructure: birthdays and the daily copypasta.
- [x] Stateful games that survive restarts.
- [ ] More scheduled features: a daily greeting, a weekly economy leaderboard and a
      weekly lottery.
- [ ] An admin `inspect` command for reading a user's raw economy record.
- [ ] Localization of all user facing messages to english.
- [ ] More minigames feeding the same economy.

---

<div align="center">

### Author

**Manuel Soler Juan** - Junior full stack developer

[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/ManusolJ)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/in/manusolerj)

</div>
