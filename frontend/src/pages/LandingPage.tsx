import type { ReactNode } from "react";
import { appUi } from "../components/ui";
import { MAX_RESPONSES_PER_SESSION } from "../components/GlossaryChatWidget";

interface Props {
  onStartQuiz: () => void;
  onPlan: () => void;
  onCompare: () => void;
}

/** The quiz asks 18 screening questions and 2 closing questions. */
const QUIZ_QUESTION_COUNT = 20;

// Mockup content. Course names, fees, rankings and employment rates are real (2026–27 fee guide,
// QS 2027, QILT 2025); the quiz scores and match percentages are examples. Update when the data changes.
const PROFILE = [
  { name: "Realistic", score: 88, colour: "#15803d" },
  { name: "Conventional", score: 74, colour: "#1d4ed8" },
  { name: "Artistic", score: 69, colour: "#c2410c" },
];
const MATCHES = [
  { score: 94, name: "Bachelor of Design in Product Design", university: "UTS" },
  { score: 91, name: "Bachelor of Architecture and Environments", university: "USYD" },
  { score: 86, name: "Bachelor of Construction Project Management", university: "UTS" },
  { score: 84, name: "Bachelor of Design in Interior Architecture", university: "UTS" },
];
const COMPARISON: Array<[label: string, uts: string, usyd: string]> = [
  ["Course", "Design in Product Design", "Design"],
  ["Duration", "3 years", "3 years"],
  ["Annual fee", "A$9,880", "A$9,537"],
  ["QS world ranking", "#87", "#28"],
  ["QS Art and Design", "#85", "101–150"],
  ["Employment rate", "72.2%", "74.3%"],
];
const COVERAGE = [
  { value: "271", label: "Undergraduate courses with fee data" },
  { value: "2026–27", label: "Domestic and international fee guide" },
  { value: "2", label: "Sydney universities: USYD and UTS" },
];
const ANSWERS = ["Not at all", "Not really", "Neutral", "Like it", "Love it"];

const Arrow = () => <span aria-hidden="true">→</span>;

const ScoreBar = ({ score, colour }: { score: number; colour: string }) => (
  <span className={appUi.landingBarTrack}>
    <span className={appUi.landingBar} style={{ width: `${score}%`, background: colour }} />
  </span>
);

interface StepProps { number: number; label: string; title: string; text: string; flip?: boolean; children: ReactNode; }

/** One "how it works" step: copy on one side, a decorative mockup of that screen on the other. */
const Step = ({ number, label, title, text, flip = false, children }: StepProps) => (
  <div className={appUi.landingStep}>
    <div className={flip ? "md:order-last" : undefined}>
      <p className={appUi.landingEyebrow}>Step {number} · {label}</p>
      <h3 className={appUi.landingStepTitle}>{title}</h3>
      <p className={appUi.landingBody}>{text}</p>
    </div>
    <div className={appUi.landingMock} aria-hidden="true">{children}</div>
  </div>
);

/** Introduces UniXPrep and routes students to the quiz, the planner or the comparison. */
export const LandingPage = ({ onStartQuiz, onPlan, onCompare }: Props) => {
  const quizButton = <button className={appUi.landingPrimary} type="button" onClick={onStartQuiz}>Take the interest quiz</button>;
  const features = [
    { title: "Find courses that fit", text: "See which USYD and UTS courses match what you enjoy.", action: "Browse courses", onClick: onPlan },
    { title: "Compare universities", text: "Fees, QS rankings and graduate employment, side by side.", action: "Compare universities", onClick: onCompare },
    { title: "Plan every semester", text: "Lay out your core subjects and electives year by year.", action: "Plan a degree", onClick: onPlan },
  ];

  return (
    <div className={appUi.landing}>
      <section className={appUi.landingHero} aria-labelledby="landing-title">
        <div>
          <p className={appUi.landingPill}>For students choosing a degree in Sydney</p>
          <h1 className={appUi.landingTitle} id="landing-title">Build your university path</h1>
          <p className={appUi.landingLead}>
            Find out what you're suited to, pick a course that fits, compare universities and see your degree semester by semester.
          </p>
          <div className={appUi.landingActions}>
            {quizButton}
            <a className={appUi.landingLink} href="#how-it-works">See how it works <Arrow /></a>
          </div>
          <p className={appUi.landingNote}>
            {QUIZ_QUESTION_COUNT} questions · About 5 minutes · Free · Built on the official USYD and UTS handbooks
          </p>
          <div className={appUi.landingShortcut}>
            <div>
              <p className="font-bold">Already got a path in mind?</p>
              <p className={appUi.landingMuted}>Skip the quiz and go straight to your study plan.</p>
            </div>
            <button className={appUi.landingSecondary} type="button" onClick={onPlan}>Plan it out <Arrow /></button>
          </div>
        </div>

        <div className={appUi.landingVisual} aria-hidden="true">
          <div className={appUi.landingCard}>
            <p className={appUi.landingMuted}>Example result</p>
            <p className="font-bold">Your Holland Code is</p>
            <p className={appUi.landingCode}>R – C – A</p>
            <div className={appUi.landingScores}>
              {PROFILE.map((item, index) => (
                <div className="grid gap-2 text-[length:.82rem]" key={item.name}>
                  <span className="flex justify-between font-semibold">
                    <span>{index + 1}. {item.name}</span><span style={{ color: item.colour }}>{item.score}%</span>
                  </span>
                  <ScoreBar score={item.score} colour={item.colour} />
                </div>
              ))}
            </div>
          </div>
          <div className={appUi.landingCard}>
            <span className={appUi.landingTag}>{MATCHES[0].score}% match</span>
            <p className="font-bold">{MATCHES[0].name}</p>
            <p className={appUi.landingMuted}>{MATCHES[0].university} · Compare with USYD →</p>
          </div>
        </div>
      </section>

      <section className={appUi.landingSection} aria-labelledby="features-title">
        <h2 className={appUi.landingSectionTitle} id="features-title">What you can do</h2>
        <div className={appUi.landingFeatures}>
          {features.map((feature) => (
            <div className={appUi.landingCard} key={feature.title}>
              <h3 className="m-0 text-[length:1.1rem]">{feature.title}</h3>
              <p className={appUi.landingMuted}>{feature.text}</p>
              <button className={appUi.landingLink} type="button" onClick={feature.onClick}>{feature.action} <Arrow /></button>
            </div>
          ))}
        </div>
      </section>

      <section className={appUi.landingBand} id="how-it-works" aria-labelledby="how-title">
        <div className={appUi.landingSection}>
          <p className={appUi.landingEyebrow}>How it works</p>
          <h2 className={appUi.landingSectionTitle} id="how-title">From “no idea” to a semester-by-semester plan</h2>
          <p className={appUi.landingBody}><em>Five steps, each one feeding the next.</em></p>

          <Step number={1} label="Quiz" title="Take the interest quiz"
            text={`${QUIZ_QUESTION_COUNT} quick questions about what you naturally enjoy, like being active, building things or organising information. There are no right or wrong answers.`}>
            <div className={appUi.landingMockCard}>
              <p className="flex justify-between text-[length:.8rem]">
                <span>Question 4 of {QUIZ_QUESTION_COUNT}</span><span className="text-[#15803d] font-semibold">15% completed</span>
              </p>
              <ScoreBar score={15} colour="#2563eb" />
              <p className="text-center font-bold text-[length:1.2rem]">Do you like being active?</p>
              <p className="text-center text-[#4b5563] text-[length:.8rem]">Physical activities, outdoor work, sports or hands-on tools.</p>
              <div className={appUi.landingAnswers}>
                {ANSWERS.map((answer, index) => (
                  <span className={index === 3 ? appUi.landingAnswerSelected : appUi.landingAnswer} key={answer}>
                    <strong className="block">{index + 1}</strong>{answer}
                  </span>
                ))}
              </div>
            </div>
          </Step>

          <Step number={2} label="Result" title="Get your Holland Code" flip
            text="Your answers become a three-letter profile, like R-C-A, with a score for each of your strongest dimensions and a plain-English summary of what it means for you.">
            <div className={appUi.landingMockCard}>
              <p className={appUi.landingMuted}>Your top 3</p>
              {PROFILE.map((item, index) => (
                <div className={appUi.landingScoreRow} key={item.name}>
                  <span className="font-semibold">{index + 1}. {item.name}</span>
                  <ScoreBar score={item.score} colour={item.colour} />
                  <span className="text-right font-bold">{item.score}%</span>
                </div>
              ))}
              <p className={appUi.landingMuted}>You thrive when combining hands-on making with structured systems and creative, visual problem-solving.</p>
            </div>
          </Step>

          <Step number={3} label="Courses" title="See courses that fit you"
            text="Courses are ranked by how well they match your profile. Each one shows its match score and what you'd actually study, so you can shortlist quickly.">
            <div className={appUi.landingMatches}>
              {MATCHES.map((match) => (
                <div className={appUi.landingMockCard} key={match.name}>
                  <span className={appUi.landingTag}>{match.score}% match</span>
                  <p className="font-bold text-[length:.9rem]">{match.name}</p>
                  <p className={appUi.landingMuted}>{match.university}</p>
                </div>
              ))}
            </div>
          </Step>

          <Step number={4} label="Universities" title="Compare universities side by side" flip
            text="Put the same kind of course at USYD and UTS next to each other: duration, fees, QS rankings and how many graduates find full-time work.">
            <table className={appUi.landingTable}>
              <thead>
                <tr>
                  <td />
                  <th className={appUi.landingTableCell}>University of Technology Sydney</th>
                  <th className={appUi.landingTableCell}>The University of Sydney</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(([label, uts, usyd], index) => {
                  const cell = index % 2 === 1 ? appUi.landingTableCellHighlight : appUi.landingTableCell;
                  return (
                    <tr key={label}>
                      <th className={cell}>{label}</th><td className={cell}>{uts}</td><td className={cell}>{usyd}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[#4b5563] text-[length:.72rem]">Domestic students · 2026–27 fee guide · QS 2027 · QILT 2025 full-time employment</p>
          </Step>

          <Step number={5} label="Study plan" title="Map out every semester"
            text="See the whole degree year by year: the core subjects you have to take, their credit points, and the slots where you choose your own electives.">
            <p className="mb-3 text-center font-bold text-[length:1.1rem]">Year 1</p>
            <div className={appUi.landingPlan}>
              <p className={appUi.landingEyebrow}>Autumn</p>
              <p className={appUi.landingEyebrow}>Spring</p>
              <span className={appUi.landingPlanSlot}><strong>Core subject</strong>6 cp</span>
              <span className={appUi.landingPlanSlot}><strong>Core subject</strong>6 cp</span>
              <span className={appUi.landingPlanSlot}><strong>Core subject</strong>6 cp</span>
              <span className={appUi.landingPlanElective}>Choose an elective<span>6 cp</span></span>
            </div>
          </Step>
        </div>
      </section>

      <section className={appUi.landingSection} aria-labelledby="assistant-title">
        <div className={appUi.landingStep}>
          <div>
            <p className={appUi.landingEyebrow}>AI assistant</p>
            <h2 className={appUi.landingSectionTitle} id="assistant-title">Stuck on a term? Just ask.</h2>
            <p className={appUi.landingBody}>
              University handbooks are full of jargon. The assistant is on every page to explain electives, credit points, majors
              and prerequisites in plain words. You can ask up to {MAX_RESPONSES_PER_SESSION} questions per visit.
            </p>
          </div>
          <div className={appUi.landingChat} aria-hidden="true">
            <p className="m-0 font-bold">UniXPrep assistant</p>
            <span className={appUi.landingBubbleBot}>Hi! How can I help you?</span>
            <span className={appUi.landingBubbleUser}>What is an elective?</span>
            <span className={appUi.landingBubbleBot}>An elective is a subject you choose yourself, instead of one your degree requires.</span>
          </div>
        </div>
      </section>

      <section className={appUi.landingBand} aria-labelledby="coverage-title">
        <div className={appUi.landingSection}>
          <p className={appUi.landingEyebrow}>Coverage</p>
          <h2 className={appUi.landingSectionTitle} id="coverage-title">Built on official handbook data</h2>
          <div className={appUi.landingStats}>
            {COVERAGE.map((stat) => (
              <div className={appUi.landingStat} key={stat.label}><strong>{stat.value}</strong>{stat.label}</div>
            ))}
          </div>
        </div>
      </section>

      <section className={appUi.landingSection} aria-labelledby="cta-title">
        <h2 className={appUi.landingSectionTitle} id="cta-title">Start with {QUIZ_QUESTION_COUNT} quick questions</h2>
        <p className={appUi.landingBody}><em>It takes about five minutes, and you'll leave with a shortlist.</em></p>
        <div className="mt-6">{quizButton}</div>
      </section>

      <footer className={appUi.landingFooter}>
        <span className="font-bold text-[#2563eb]">UniXPrep</span>
        <span>Course and fee information comes from university handbooks. Always confirm details with the university before you apply.</span>
      </footer>
    </div>
  );
};
