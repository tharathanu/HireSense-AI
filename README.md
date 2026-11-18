# HireSense AI

**Hiring, measured fairly.** HireSense AI runs every hiring round in one place —
resume screening, an adaptive aptitude test, a live group discussion, a voice
interview and a final report — scores every candidate the same way, and checks
the integrity of every round.

Everything runs on free services: Neon (database), Render (API), Vercel
(website), Google Gemini / Groq free tiers (optional AI), Gmail SMTP (optional
email), and in-browser TensorFlow.js, WebRTC and speech recognition.

---

## Features

### The five rounds
| Round | What happens |
|---|---|
| 1. Resume screening | PDF/DOCX upload, text extraction, skill detection, job-fit score with matched and missing skills |
| 2. Aptitude test | 15 adaptive questions in 30 minutes across quantitative, logical, verbal and technical; harder questions are worth more |
| 3. Group discussion | Live video room (2–8 candidates), live transcript, participation / relevance / leadership scores |
| 4. Voice interview | 5 questions built from the job and the candidate’s own resume, answered by speaking only, camera on |
| 5. Final report | All rounds combined (resume 20%, aptitude 20%, GD 20%, interview 30%, integrity 10%) with a recommendation and a ranking |

### Integrity checks (proctoring)
Fullscreen lock · tab-switch detection (3 strikes auto-submits the test) ·
copy / paste / right-click blocked · camera required · phone detection
(COCO-SSD) · face count and looking-away detection (BlazeFace) · every event
logged with a timestamp for the recruiter.

### What makes it different
- **Blind screening** — hide names, gender, photo, contact details and college during resume screening.
- **Resume authenticity check** — verifies the GitHub profile (public API), checks the LinkedIn link, and flags skills that no project or experience supports.
- **Feedback for every candidate** — a personal report on what went well, what to improve and what to do next, shared automatically on rejection or selection.
- **Scheduling and alerts** — time slots for tests, discussions and interviews, with in-app notifications and email.

### Roles
- **Candidate** — profile, resume, job search, applications with a stage tracker, aptitude test, GD room, voice interview, schedule, feedback, notifications.
- **Recruiter** — company profile, jobs with required/optional skills, pipeline per job, full candidate view, GD scheduling and hosting, time slots, reports and ranking.
- **Admin** — platform stats, users (activate / deactivate), all jobs, aptitude question bank, GD topics, email delivery status.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router, Axios, Recharts, Lucide icons, plain CSS |
| Real-time | Socket.IO (signalling, transcript), WebRTC (peer-to-peer video) |
| In-browser AI | TensorFlow.js with COCO-SSD and BlazeFace, Web Speech API |
| Backend | Node.js, Express, Zod validation, JWT, bcrypt, Multer, pdf.js, Mammoth, Nodemailer |
| Database | PostgreSQL with Prisma ORM (29 tables) |
| AI (optional) | Google Gemini free tier, Groq free tier as backup — with rule-based scoring when no key is set |
| Testing | Jest, Supertest, Socket.IO client — 80 tests, with every database query checked against the Prisma schema |

---

## Project structure

```
hiresense-ai/
├── client/                React website (deploy to Vercel)
│   └── src/
│       ├── pages/         candidate/, recruiter/, admin/, shared/
│       ├── hooks/         useProctoring, useSpeechRecognition, useApi
│       └── components/    shared UI
├── server/                Express API + Socket.IO (deploy to Render)
│   ├── prisma/            schema.prisma, seed.js, seed-data.js
│   ├── src/
│   │   ├── routes/        auth, candidate, recruiter, admin, public, shared
│   │   ├── services/      resume, match, authenticity, aptitude, gd, interview, report, pipeline
│   │   └── socket.js      live group discussion
│   └── tests/             80 automated tests
├── sample-data/           sample resumes for testing
├── TESTING.md             step-by-step test guide
└── render.yaml            one-click Render setup
```

---

## Run it on your laptop

You need **Node.js 20 or newer** and **Git**. Use **Google Chrome** or
**Microsoft Edge** for testing (speech recognition needs them).

### 1. Database (free)
Create a project at [neon.tech](https://neon.tech) and copy the connection string.

### 2. Backend
```bash
cd server
npm install
copy .env.example .env          # Mac/Linux: cp .env.example .env
```
Open `server/.env` and set at least `DATABASE_URL`, `JWT_SECRET`,
`ADMIN_EMAIL` and `ADMIN_PASSWORD`. Then:
```bash
npx prisma generate                  # builds the database client (Prisma 7)
npx prisma migrate dev --name init   # creates all tables (and the migrations folder)
npm run db:seed                      # skills, 48 aptitude questions, 8 GD topics, admin account
npm run dev
```
The project uses Prisma 7: the database address is read from `DATABASE_URL`
through `server/prisma.config.ts`, not from `schema.prisma`.

Check http://localhost:5000/api/health — it should say `"status":"ok"`.

### 3. Frontend (second terminal)
```bash
cd client
npm install
copy .env.example .env
npm run dev
```
Open http://localhost:5173

### 4. Automated tests
```bash
cd server
npm test
```

### Optional free extras
| Feature | Setting in `server/.env` | Where to get it |
|---|---|---|
| Smarter AI scoring | `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Backup AI | `GROQ_API_KEY` | [console.groq.com/keys](https://console.groq.com/keys) |
| Real emails | `SMTP_USER`, `SMTP_PASS` | Gmail → Google Account → Security → App passwords |
| More GitHub checks | `GITHUB_TOKEN` | GitHub → Settings → Developer settings → Tokens |

Without these, the app still works fully: scoring uses the built-in rules and
emails are logged as “skipped”.

> **Privacy note:** on Gemini’s free tier, Google may use the text you send to
> improve its products. That includes candidates’ resumes and answers. Mention
> this in your privacy notice, or leave the AI keys empty to keep everything
> on your own server.

---

## Push to GitHub

1. Create an empty repository `hiresense-ai` on GitHub (no README).
2. In the `hiresense-ai` folder:
```bash
git init
git add .
git commit -m "HireSense AI: complete hiring platform"
git branch -M main
git remote add origin https://github.com/tharathanu/hiresense-ai.git
git push -u origin main
```
`.env` files are in `.gitignore`, so your passwords and keys are never uploaded.
**Make sure `server/prisma/migrations/` is committed** — Render needs it.

---

## Deploy for free

### 1. Database — Neon
Use your Neon database (or create a separate one for production).

### 2. Backend — Render
1. [render.com](https://render.com) → **New + → Blueprint** → choose your GitHub repo. Render reads `render.yaml`.
2. Fill in `DATABASE_URL`, and `CLIENT_URL` (your Vercel link — you can update it after step 3). Add the optional keys if you have them.
3. Deploy. Your API will be at something like `https://hiresense-api.onrender.com`.
4. Create the admin account and starter content once, from your laptop, against the production database:
   ```bash
   cd server
   # temporarily set DATABASE_URL in .env to the production database, then:
   npm run db:seed
   ```

### 3. Website — Vercel
1. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
2. **Root directory:** `client` (Vercel detects Vite).
3. **Environment variable:** `VITE_API_URL` = your Render link.
4. Deploy. Copy the Vercel link into Render’s `CLIENT_URL` and redeploy the backend.

### Free-plan notes
- Render’s free plan sleeps after 15 minutes without traffic, so the first request can take up to a minute. Open the site once before a demo.
- Group discussions use free STUN servers. On very strict networks, add a free TURN server (`VITE_TURN_*` in `client/.env`).
- Uploaded resume files are not stored; only the extracted text is saved, so nothing is lost when Render restarts.

---

## How scoring works

| Score | How it is calculated |
|---|---|
| Job fit | 60% required-skill coverage + job-description keyword overlap + nice-to-have skills + evidence of projects/experience (AI adjusts the non-skill part when enabled) |
| Aptitude | Weighted by difficulty (easy 1, medium 2, hard 3) and broken down by category |
| Group discussion | Participation compared to an equal share (40%) + relevance to the topic (35%) + leadership signals (25%) |
| Interview answer | Key points covered (technical 50%) + structure and filler words (communication 30%) + pace and hedging (confidence 20%) |
| Integrity | Starts at 100; each event deducts points (phone or extra person −15, camera off −10, tab switch −8, …) |
| Recommendation | 80+ strong hire · 65+ hire · 50+ maybe · below 50 not recommended |

Every score shows its reasons, so recruiters can explain every decision.
