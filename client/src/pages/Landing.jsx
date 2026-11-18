import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Github } from 'lucide-react';

// Real screenshots of the running app live in /public/images
const STEPS = [
  {
    n: '01',
    title: 'Resumes are read, not skimmed',
    text: 'Candidates upload a PDF or Word resume. Skills, projects and experience are pulled out and matched against the skills the job actually needs, so the recruiter sees why a score is what it is.',
    details: ['Matched and missing skills', 'GitHub and LinkedIn checked', 'Optional blind screening'],
    image: '/images/shot-resume.webp',
    alt: 'Resume match screen showing a job-fit score with matched and missing skills',
  },
  {
    n: '02',
    title: 'One test, adapted to each person',
    text: 'Fifteen questions in thirty minutes across quantitative, logical, verbal and technical topics. Each correct answer brings a harder question, and harder questions are worth more.',
    details: ['Camera on, fullscreen, no copy-paste', 'Three tab switches ends the test', 'Every event time-stamped'],
    image: '/images/shot-aptitude.webp',
    alt: 'Aptitude test question with answer options',
    photo: '/images/photo-lab.webp',
  },
  {
    n: '03',
    title: 'A real discussion, fairly measured',
    text: 'Shortlisted candidates meet in a live video room. What each person says is transcribed, and the score looks at how much they contributed, how relevant it was and whether they moved the discussion forward.',
    details: ['2–8 candidates per room', 'Live transcript for the recruiter', 'Participation, relevance, leadership'],
    image: '/images/shot-gd.webp',
    alt: 'Group discussion scores and transcript for one candidate',
  },
  {
    n: '04',
    title: 'An interview about their own work',
    text: 'Questions are written from the job and the candidate’s own projects. Candidates answer out loud with the camera on — there is no text box to paste into.',
    details: ['Five spoken questions', 'Technical, communication and confidence scores', 'Specific feedback on every answer'],
    image: '/images/shot-interview.webp',
    alt: 'Interview review showing a question, the spoken answer and three scores',
  },
  {
    n: '05',
    title: 'One report, and a reason for every decision',
    text: 'All rounds come together in a single report with strengths, concerns and a recommendation. Candidates who are not selected still receive a personal report on what to improve.',
    details: ['Ranking across all applicants', 'Integrity score included', 'Feedback shared automatically'],
    image: '/images/shot-report.webp',
    alt: 'Final report with an overall score, round scores and recommendation',
  },
];

function Shot({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className={`shot shot-missing ${className}`} role="img" aria-label={alt} />;
  return <img className={`shot ${className}`} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

function MakerPhoto() {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="maker-photo maker-initials" aria-hidden="true">TR</div>;
  return <img className="maker-photo" src="/images/maker.jpg" alt="Thanushri R" onError={() => setFailed(true)} />;
}

export default function Landing() {
  return (
    <div className="landing">
      <section className="hero2">
        <div className="container hero2-grid">
          <div className="hero2-copy">
            <p className="kicker">For campus and fresher hiring</p>
            <h1 className="serif">
              Hire people for what they <em className="mark">can do</em>, not where they studied.
            </h1>
            <p className="lead">
              HireSense AI runs the whole hiring drive — resume screening, an aptitude test, a group discussion and an
              interview — with the same rules for every candidate and a written reason behind every score.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" to="/register?role=recruiter">Start a hiring drive <ArrowRight size={16} aria-hidden="true" /></Link>
              <Link className="btn btn-outline" to="/register">I’m applying for jobs</Link>
            </div>
            <p className="hero-note">Free to use. Works in Chrome and Edge, on any laptop with a camera.</p>
          </div>

          <div className="hero2-visual" aria-label="Screenshots of HireSense AI">
            <figure className="browser">
              <div className="browser-bar" aria-hidden="true"><span /><span /><span /><em>hiresense · Full Stack Developer</em></div>
              <Shot src="/images/shot-pipeline.webp" alt="Recruiter pipeline listing candidates with scores for every round" />
            </figure>
            <figure className="float-card">
              <Shot src="/images/shot-score.webp" alt="A candidate’s job-fit score card" />
            </figure>
          </div>
        </div>
      </section>

      <section className="campus">
        <div className="container">
          <figure className="campus-photo">
            <img src="/images/photo-placement.webp" alt="Students in formal clothes waiting with their files at a campus placement drive" loading="lazy" />
            <figcaption>
              <strong>Placement day, without the chaos.</strong>
              <span>Hundreds of applicants, one corridor, a few recruiters. HireSense gives every one of them the same rounds — and gives recruiters a clear reason to shortlist.</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="drive" id="how-it-works">
        <div className="container">
          <div className="drive-head">
            <h2 className="serif">One hiring drive, start to finish.</h2>
            <p>Five rounds that feed into each other, so nobody is judged on a single screen.</p>
          </div>

          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.n} className={`step${i % 2 ? ' flip' : ''}`}>
                <div className="step-copy">
                  <span className="step-n serif" aria-hidden="true">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                  <ul>{s.details.map((d) => <li key={d}>{d}</li>)}</ul>
                </div>
                {s.photo ? (
                  <figure className="step-shot step-photo">
                    <img className="photo" src={s.photo} alt="Students taking an online test in a college computer lab" loading="lazy" />
                    <div className="step-photo-card"><Shot src={s.image} alt={s.alt} /></div>
                  </figure>
                ) : (
                  <figure className="step-shot">
                    <Shot src={s.image} alt={s.alt} />
                  </figure>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="fair" id="recruiters" style={{ '--fair-photo': 'url(/images/photo-seminar.webp)' }}>
        <div className="container fair-grid">
          <blockquote className="serif">
            “Every candidate gets the same questions, the same rules, and a written reason for the result.”
          </blockquote>
          <dl className="fair-list">
            <div>
              <dt>Blind screening</dt>
              <dd>Names, gender, photos and colleges stay hidden until a candidate clears the first round.</dd>
            </div>
            <div>
              <dt>Resume authenticity</dt>
              <dd>GitHub profiles are checked, and skills that no project or internship supports are flagged.</dd>
            </div>
            <div>
              <dt>Feedback for everyone</dt>
              <dd>Rejected candidates get specific next steps instead of a one-line email.</dd>
            </div>
            <div>
              <dt>Scheduling and alerts</dt>
              <dd>Test windows, discussion slots and interviews, with email and in-app reminders.</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="maker" id="candidates">
        <div className="container">
          <div className="maker-card">
            <MakerPhoto />
            <div>
              <p className="maker-note">
                HireSense AI is designed around one idea: every candidate should face the same rounds and rules, be
                judged on what they can actually do, and leave with feedback they can use — whether or not they get
                the job.
              </p>
              <p className="maker-sign">
                <strong>Thanushri R</strong> · Final-year B.Tech Computer Science, Puducherry ·{' '}
                <a href="https://github.com/tharathanu" target="_blank" rel="noreferrer"><Github size={14} aria-hidden="true" /> tharathanu</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="closing">
        <div className="container closing-inner">
          <h2 className="serif">Running a placement drive this season?</h2>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/register?role=recruiter">Create a recruiter account</Link>
            <Link className="btn btn-outline" to="/login">Log in</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
