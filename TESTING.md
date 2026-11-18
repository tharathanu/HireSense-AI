# Testing HireSense AI

Two kinds of testing: the **automated tests** (one command) and a **full
manual walkthrough** of every page with sample data.

---

## 1. Automated tests (2 minutes)

```bash
cd server
npm test
```

Expected: **80 tests pass** in 5 test files.

| File | What it checks |
|---|---|
| `auth.test.js` | Register, login, wrong passwords, deactivated accounts, tokens, role checks |
| `services.test.js` | Real PDF/DOCX parsing, job match, authenticity checks, adaptive test, GD scoring, interview scoring, final report, feedback, blind screening |
| `routes.test.js` | Every API module: resume upload, applying, aptitude flow, tab-switch auto-submit, interview, jobs, pipeline, GD, scheduling, admin, dashboards |
| `socket.test.js` | Live GD room: login check, who can join, video signal relay, transcript saving |
| `schemaCheck.test.js` | Confirms the database checker catches wrong field names |

The tests use a database mock that **checks every query against the real
Prisma schema**, so a wrong table or field name fails the test, just as it
would against a real database.

---

## 2. Manual walkthrough (about 45 minutes)

### What you need
- The app running locally (see README) or deployed.
- **Google Chrome** (or Edge) with a camera and microphone.
- **Three separate browser windows that don’t share logins**: a normal Chrome
  window, a Chrome Incognito window, and a second Chrome profile (or Edge).
  Each one stays logged in as a different person.
- The sample resumes in `sample-data/`:
  - `sample-resume-strong.pdf` — Meera Iyer, full-stack skills, GitHub link
  - `sample-resume-weak.pdf` — Arjun Rao, few matching skills, no links

### Accounts used below
| Who | Email | Password |
|---|---|---|
| Admin | the `ADMIN_EMAIL` from your `.env` | `ADMIN_PASSWORD` |
| Recruiter | `recruiter.test@northwind.in` | `Recruit123` |
| Candidate A | `meera.test@gmail.com` | `Candidate123` |
| Candidate B | `arjun.test@gmail.com` | `Candidate123` |

---

### Part A — Admin (window 1)
1. Open the site → **Log in** with the admin account.
   ✅ You land on **Platform overview**: about 48 active questions and 8 GD topics.
2. **Question bank** → **Add question** → leave the question empty → **Save**.
   ✅ An error appears under “Question”.
3. Add a real question: Logical, Easy, “Which number comes next: 3, 6, 9, ?”, options 11 / 12 / 13 / 15, select **12**, then Save.
   ✅ It appears in the list and the Logical count goes up by one.
4. **GD topics** → check that the 8 starter topics are listed.
5. **Log out**.

### Part B — Recruiter posts a job (window 1)
1. **Get started** → **I’m a recruiter** → register with company “Northwind Systems”.
   - Try the password `short` first. ✅ Password error.
   - Then use `Recruit123`. ✅ You land on **Northwind Systems hiring**.
2. **Jobs** → **Post a job**:
   - Title: `Full Stack Developer`
   - Description: `Build React frontends and Node.js REST APIs backed by PostgreSQL. You will own features end to end and write tests.`
   - Required skills: type and add **React**, **Node.js**, **PostgreSQL**, **TypeScript**
   - Nice to have: **Docker**
   - Tick **Blind screening** · Status: **Open for applications**
   - **Post job** ✅ The job’s pipeline opens, empty.

### Part C — Candidates apply (windows 2 and 3)
**Window 2: Candidate A**
1. Register as a candidate: Meera Iyer, `meera.test@gmail.com`.
   ✅ Dashboard shows “Hello, Meera” and a Get-started checklist.
2. **My resume** → **Upload resume** → `sample-resume-strong.pdf`.
   ✅ After a few seconds, the tabs show the name, email, phone, GitHub and LinkedIn; about 16 skills; projects TaskFlow and BookNest.
   ✅ **Authenticity**: GitHub **verified** (the sample uses the public `octocat` profile), LinkedIn **verified**, skill evidence shown.
3. **Profile** → the GitHub link was filled in automatically → add a college → **Save profile** ✅ “Profile saved.”
4. **Find jobs** → search `react` → **View and apply** → **Apply with my resume**.
   ✅ Job-fit score around **75–85**, with **TypeScript** listed as missing.

**Window 3: Candidate B**
1. Register Arjun Rao → upload `sample-resume-weak.pdf`.
   ✅ Authenticity shows **no GitHub link** and **no LinkedIn link**.
2. Apply for the same job. ✅ Much lower job-fit score, most required skills missing.

### Part D — Screening with blind mode (window 1)
1. Recruiter → **Jobs** → **Full Stack Developer**.
   ✅ Both applicants appear as **Candidate XXXXX**, with no names or emails. A blind-screening banner is shown.
2. Open the stronger candidate → **Resume** tab: skills, projects and authenticity checks are visible, but no education or college.
3. **Move to Aptitude test** → confirm.
   ✅ The name **Meera Iyer** now appears. ✅ Candidate A gets a notification (bell count).
4. Do the same for the other candidate.
5. **Schedule** → **New time slot** → Aptitude test · this job · open now and close tomorrow · select both → **Schedule and notify**.
   ✅ The slots are listed. Emails are sent if SMTP is set up, otherwise logged as skipped on the admin page.

### Part E — Aptitude test with proctoring (window 2)
1. Candidate A → bell → the notification opens **My applications** → **Start aptitude test**.
2. Read the rules → tick the box → **Turn on camera and start** → allow the camera.
   ✅ Fullscreen opens. Camera preview with “Camera on · being monitored”.
3. Answer 3 questions. ✅ The difficulty badge changes with your answers (easy / medium / hard).
4. **Integrity checks — try each one:**
   - Right-click or press Ctrl+C → ✅ warning “Copying, pasting…”
   - Press Esc to leave fullscreen → ✅ warning + **Return to fullscreen** button
   - Hold a phone up to the camera for a few seconds → ✅ “A phone was detected…”
   - Move out of the camera view for about 5 seconds → ✅ “Your face is not visible…”
   - Switch to another tab and back **three times** → ✅ “tab switches: 1 of 3”, then on the third the test **auto-submits** and shows your score.
5. ✅ The result page shows the overall score and four category bars.

Repeat with Candidate B, but answer all 15 questions without breaking any rules (✅ the test finishes on its own after question 15).

### Part F — Recruiter reviews (window 1)
1. Open each candidate → **Aptitude** tab.
   ✅ Score, categories, each question with Correct/Wrong, and the pass mark badge.
   ✅ **Integrity** tab for Candidate A lists every event with times.
2. Move both candidates to **Group discussion**.

### Part G — Live group discussion (all three windows)
> **Tip:** one laptop usually can’t give its camera and microphone to three
> windows at once, and Chrome listens to speech in only one window at a time.
> For this part, ask a friend to join as Candidate B from their own laptop,
> or use a second computer.

1. Recruiter → **Group discussions** → **Schedule discussion** → job, a topic, time = now, tick both candidates → **Schedule**.
   ✅ Both candidates get a notification and see it in **Schedule**.
2. Recruiter → **Open room** → **Turn on camera and join**.
3. Both candidates → **My applications** → **Join discussion** → join.
   ✅ Everyone sees everyone’s video. The participants list is filled.
4. Recruiter → **Start discussion**. ✅ The timer starts for everyone.
5. Each candidate speaks 3–4 sentences about the topic.
   ✅ Their words appear in the **Live transcript** within a few seconds.
6. Recruiter → **End and score** → confirm.
   ✅ Each candidate’s **Group discussion** tab shows impact, relevance and leadership scores plus what they said.

### Part H — Voice interview (window 2)
1. Recruiter moves Candidate A to **Interview**.
2. Candidate A → **Start voice interview** → tick → start.
   ✅ The question is read aloud. ✅ No text box anywhere.
3. **Start answering** → speak for 30–60 seconds → **Finish answer**.
   ✅ Your words appeared live while you spoke, and the next question loads.
4. Finish all 5 questions. ✅ “Interview complete.”
5. Recruiter → candidate → **Interview** tab.
   ✅ Each question shows the transcript and technical, communication and confidence scores, with specific feedback.

### Part I — Final report, decision and feedback
1. Recruiter → **Move to Final review**.
   ✅ **Report & feedback** tab: overall score, recommendation, strengths and concerns.
2. **Reports** → choose the job. ✅ Ranking table and bar chart.
3. Candidate A → **Select candidate**. Candidate B → **Reject**.
4. Candidate B → **Feedback**.
   ✅ A personal report: what went well, areas to improve (e.g. missing skills, weak aptitude categories), and concrete next steps.
5. Candidate A → notification “Offer update” and a feedback report starting with “Congratulations”.

### Part J — Admin controls (window 1)
1. Log in as admin → **Users** → deactivate Candidate B.
2. In window 3, refresh. ✅ Candidate B is logged out and cannot log back in (“This account has been deactivated.”).
3. Activate them again.

### Part K — Phone layout
Open the site on your phone, or use Chrome DevTools → device toolbar (iPhone).
✅ The menu becomes a scrollable row, cards stack, and wide tables scroll inside their own box.

---

## Common problems

| Problem | Fix |
|---|---|
| “Cannot reach the server” | Backend not running, or `VITE_API_URL` is wrong. On Render the first request can take a minute. |
| “This website is not allowed to use the API” | Add your website address to `CLIENT_URL` in the backend settings. |
| Speech not appearing | Use Chrome or Edge, allow the microphone, and check your internet connection (Chrome’s speech recognition is online). |
| Videos don’t connect in the GD | A strict network is blocking peer-to-peer video. Try another network or add a free TURN server. |
| “Camera checks unavailable on this device” | The AI models could not load (slow internet or blocked). The camera and other checks still work. |
| Aptitude says the question bank is not ready | Run `npm run db:seed`. |
