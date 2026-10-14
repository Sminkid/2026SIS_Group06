import { appUi } from "../components/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { formatScorePercent } from "../domain/quizResult";
import type { QuizCategorySummary, QuizResult } from "../domain/quizRecommendation";
import { ScoreBar, styleFor, TOP_TAGS } from "../components/QuizCategory";

interface Props {
  result: QuizResult;
  onViewCourses: () => void;
  /** Continues the same quiz session with the fine-tuning questions (initial results only). */
  onPersonalise: () => void;
  onRetake: () => void;
  onHome: () => void;
  /** Set when the quiz was launched from a degree page. */
  onBackToDegree?: () => void;
}

const TOP_DESCRIBED = 3;
const letterOf = (category: QuizCategorySummary) => category.name.charAt(0).toUpperCase();

/** Shows initial results first, then (optionally) the personalised result after fine-tuning. */
export const QuizResultPage = ({ result, onViewCourses, onPersonalise, onRetake, onHome, onBackToDegree }: Props) => {
  const personalised = result.stage === "personalised";
  const top = result.rankedCategories.slice(0, TOP_DESCRIBED);
  const others = result.rankedCategories.slice(TOP_DESCRIBED);

  return (
    <main className={appUi.page} id="main-content">
      <Breadcrumbs items={[{ label: "Home", onClick: onHome }, { label: "Quiz Result" }]} />
      <section className={appUi.pageIntroCompact}>
        <p className={appUi.eyebrow}>{personalised ? "Your personalised result" : "Your initial result"}</p>
        <h2 className="text-black">Your Holland Code Profile is</h2>
        {top.length > 0 && (
          <p className={appUi.quizHollandCode} aria-label={`Holland Code ${top.map(letterOf).join(", ")}`}>
            {top.map(letterOf).join(" – ")}
          </p>
        )}
        <p className={appUi.quizHollandNames}>
          {top.length > 0 ? top.map((category) => category.name).join(" • ") : result.primaryInterest}
        </p>
        <p className={appUi.landingNote}>{result.summary}</p>
      </section>

      <section className={appUi.quizResultSection}>
        <div className={appUi.quizBreakdown}>
          <h2>Top {top.length} dimensions breakdown</h2>
          <ol className={appUi.quizTopList} aria-label="Your top interest areas">
            {top.map((category, index) => {
              const { colour, tint, icon: categoryIcon } = styleFor(category.name);
              return (
                <li className={appUi.quizTopCard} key={category.id}>
                  <div className={appUi.quizTopCardHeader}>
                    <span className={appUi.quizTopIcon} style={{ color: colour, background: tint, borderColor: `${colour}33` }}>
                      {categoryIcon}
                    </span>
                    {category.score !== null && (
                      <span className={appUi.quizTopPercent} style={{ color: colour }}>{formatScorePercent(category.score)}</span>
                    )}
                  </div>
                  <h3 className={appUi.quizTopName}>
                    <span className={appUi.srOnly}>#{index + 1} </span>{category.name} ({letterOf(category)})
                  </h3>
                  <p className={appUi.quizTopTag} style={{ color: colour }}>{TOP_TAGS[index]}</p>
                  {category.description && <p className={appUi.quizTopDescription}>{category.description}</p>}
                  {category.score !== null && <ScoreBar score={category.score} colour={colour} />}
                </li>
              );
            })}
          </ol>

          {others.length > 0 && (
            <>
              <h3 className={appUi.quizOtherHeading}>Your other interest areas</h3>
              <ol className={appUi.quizOtherList} start={TOP_DESCRIBED + 1} aria-label="Your other interest areas">
                {others.map((category, index) => {
                  const { colour } = styleFor(category.name);
                  return (
                    <li className={appUi.quizOtherRow} key={category.id}>
                      <span className={appUi.quizOtherName}>{TOP_DESCRIBED + index + 1}. {category.name}</span>
                      {category.score !== null ? (
                        <>
                          <span className={appUi.quizOtherBar}><ScoreBar score={category.score} colour={colour} /></span>
                          <span className={appUi.quizOtherPercent}>{formatScorePercent(category.score)}</span>
                        </>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>

        {personalised && result.suggestedMajor && (
          <div className={appUi.quizRecommendationCard}>
            <p className={appUi.eyebrow}>Suggested major or stream</p>
            <h2>{result.suggestedMajor.name}</h2>
            <p className={appUi.muted}>
              {result.suggestedMajor.code} · {result.suggestedMajor.type}
              {result.suggestedMajorDegree &&
                ` · within ${result.suggestedMajorDegree.name} (${result.suggestedMajorDegree.universityCode})`}
            </p>
          </div>
        )}

        {!personalised && (
          <div className={appUi.quizRecommendationCard}>
            <p className={appUi.eyebrow}>Want a more precise match?</p>
            <p>
              These results are based on your general answers. Answer 25 more questions about your specific
              interests to refine them and find the best major or stream within your matched courses. You can view
              course recommendations now and come back to this whenever you like.
            </p>
            <div>
              <button className={appUi.backButton} type="button" onClick={onPersonalise}>
                Personalise further
              </button>
            </div>
          </div>
        )}

        <div className={appUi.buttonContainer}>
          <button className={appUi.backButton} type="button" onClick={onRetake}>
            Retake quiz
          </button>
          <button className={appUi.primaryButton} type="button" onClick={onViewCourses}>
            View course recommendations <span aria-hidden="true">→</span>
          </button>
        </div>
        {onBackToDegree && (
          <div>
            <button className={appUi.textButton} type="button" onClick={onBackToDegree}>
              ← Back to degree
            </button>
          </div>
        )}
      </section>
    </main>
  );
};
