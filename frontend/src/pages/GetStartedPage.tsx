import { appUi } from "../components/ui";
import check from "../components/ui/icons/Check.png"

interface Props { onStart: () => void; }

export const GetStartedPage = ({ onStart }: Props) => (
  <main className={appUi.pageLanding} id="main-content">
    <section className={appUi.pageIntro}>
      <p className={appUi.eyebrow}>Not sure what to study?</p>
      <h1>Build your university path</h1>
      <p className={appUi.lead}>Explore official handbook requirements and understand how your degree is structured, one section at a time.</p>
      <div className={appUi.sectionHeading}>
        <h2>What can you get?</h2>
        <div className={appUi.sectionRow}>
        <img src={check} className={appUi.checkMark}/>
        <p>Explore courses you may be interested in</p>
        </div>
        <div className={appUi.sectionRow}>
        <img src={check} className={appUi.checkMark}/>
        <p>Compare the strengths of universities</p>
        </div>
        <div className={appUi.sectionRow}>
          <img src={check} className={appUi.checkMark}/>
          <p>Preview study plans</p>
        </div>
      </div>
    </section>
    <section className={appUi.contentSection} aria-labelledby="universities-heading">
      <p className={appUi.lead}>
        Answer a few questions about your interests and lifestyle, and we'll
        suggest courses and universities that fit.
      </p>
      <button className={appUi.primaryButton} type="button" onClick={onStart}>
        Start the quiz
      </button>
    </section>
  </main>
);