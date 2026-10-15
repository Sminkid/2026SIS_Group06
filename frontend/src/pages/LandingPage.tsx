import type { ReactNode } from "react";
import { appUi } from "../components/ui";
import { MAX_RESPONSES_PER_SESSION } from "../components/GlossaryChatWidget";
import { ScoreBar, styleFor } from "../components/QuizCategory";
import {
  AssistantPreview, ComparisonPreview, COURSES, CourseCard, CoursesPreview, HOLLAND_CODE, PROFILE, PROFILE_NAMES, QuizPreview,
  ResultPreview, StudyPlanPreview,
} from "../components/LandingPreviews";

interface Props {
  onStartQuiz: () => void;
  onPlan: () => void;
  /** The "What you can do" link: every journey starts by picking a course from the full list. */
  onBrowseCourses: () => void;
}

/** The quiz asks 18 screening questions and 2 closing questions. */
const QUIZ_QUESTION_COUNT = 20;

const COVERAGE = [
  { value: "433", label: "Undergraduate courses with fee data" },
  { value: "2026–27", label: "Domestic and international fee guide" },
  { value: "3", label: "Sydney universities: UNSW, USYD and UTS" },
];

const Arrow = () => <span aria-hidden="true">→</span>;

const featureIcon = (paths: ReactNode) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths}</svg>
);
/** Search for finding courses, scales for comparing universities, a calendar for the semester plan. */
const FEATURE_ICONS = {
  find: featureIcon(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>),
  compare: featureIcon(<><path d="M12 3v18" /><path d="M5 7h14" /><path d="m5 7-3 7a3 3 0 0 0 6 0Z" /><path d="m19 7-3 7a3 3 0 0 0 6 0Z" /><path d="M8 21h8" /></>),
  plan: featureIcon(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /><path d="M8 14h2" /><path d="M14 14h2" /><path d="M8 18h2" /></>),
};

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
export const LandingPage = ({ onStartQuiz, onPlan, onBrowseCourses }: Props) => {
  const quizButton = <button className={appUi.landingPrimary} type="button" onClick={onStartQuiz}>Take the interest quiz</button>;
  const features = [
    { title: "Find courses that fit", text: "See which courses match what you enjoy.", icon: FEATURE_ICONS.find, colour: "#15803d", tint: "#ecfdf3" },
    { title: "Compare universities", text: "Fees, QS rankings and graduate employment, side by side.", icon: FEATURE_ICONS.compare, colour: "#1d4ed8", tint: "#eff6ff" },
    { title: "Plan every semester", text: "Lay out your core subjects and electives year by year.", icon: FEATURE_ICONS.plan, colour: "#c2410c", tint: "#fff7ed" },
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
            {QUIZ_QUESTION_COUNT} questions · About 5 minutes · Free · Built on the official UNSW, USYD and UTS handbooks
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
            <p className="font-bold">Your Holland Code Profile is</p>
            <p className={appUi.landingCode}>{HOLLAND_CODE}</p>
            <p className="font-semibold text-[length:.85rem]">{PROFILE_NAMES}</p>
            <div className={appUi.landingScores}>
              {PROFILE.map((area, index) => {
                const { colour } = styleFor(area.name);
                return (
                  <div className="grid gap-2 text-[length:.82rem]" key={area.name}>
                    <span className="flex justify-between font-semibold">
                      <span>{index + 1}. {area.name}</span><span style={{ color: colour }}>{Math.round(area.score * 100)}%</span>
                    </span>
                    <ScoreBar score={area.score} colour={colour} />
                  </div>
                );
              })}
            </div>
          </div>
          <div className={appUi.landingPreview}>
            <CourseCard {...COURSES[0]!} />
          </div>
        </div>
      </section>

      <section className={appUi.landingSection} aria-labelledby="features-title">
        <h2 className={appUi.landingSectionTitle} id="features-title">What you can do</h2>
        <div className={appUi.landingFeatures}>
          {features.map((feature) => (
            <div className={appUi.landingCard} key={feature.title}>
              <span className={appUi.landingFeatureIcon} style={{ color: feature.colour, background: feature.tint, borderColor: `${feature.colour}33` }}>
                {feature.icon}
              </span>
              <h3 className="m-0 p-0 text-[length:1.1rem]">{feature.title}</h3>
              <p className={appUi.landingMuted}>{feature.text}</p>
            </div>
          ))}
        </div>
        <p className={appUi.landingFeaturesNext}>
          <button className={appUi.landingLink} type="button" onClick={onBrowseCourses}>
            Start by browsing all courses and picking one <Arrow />
          </button>
        </p>
      </section>

      <section className={appUi.landingBand} id="how-it-works" aria-labelledby="how-title">
        <div className={appUi.landingSection}>
          <p className={appUi.landingEyebrow}>How it works</p>
          <h2 className={appUi.landingSectionTitle} id="how-title">From “no idea” to a semester-by-semester plan</h2>
          <p className={appUi.landingBody}><em>Five steps, each one feeding the next.</em></p>

          <Step number={1} label="Quiz" title="Take the interest quiz"
            text={`${QUIZ_QUESTION_COUNT} quick questions about what you naturally enjoy, like being active, building things or organising information. There are no right or wrong answers.`}>
            <QuizPreview />
          </Step>

          <Step number={2} label="Result" title="Get your Holland Code" flip
            text="Your answers become a three-letter profile, like R-C-A, with a score for each of your strongest dimensions and a plain-English summary of what it means for you.">
            <ResultPreview />
          </Step>

          <Step number={3} label="Courses" title="See courses that fit you"
            text="The courses that best match your profile come first. Each card shows how many universities offer it, so you can shortlist and open the comparison in one click.">
            <CoursesPreview />
          </Step>

          <Step number={4} label="Universities" title="Compare universities side by side" flip
            text="Put the same kind of course next to each other: duration, fees, QS rankings and how many graduates find full-time work.">
            <ComparisonPreview />
          </Step>

          <Step number={5} label="Study plan" title="Map out every semester"
            text="See the whole degree year by year: the core subjects you have to take, their credit points, and the slots where you choose your own electives.">
            <StudyPlanPreview />
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
          <div className={appUi.landingPreview} aria-hidden="true">
            <AssistantPreview />
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
