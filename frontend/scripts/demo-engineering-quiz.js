/*
 * Showcase helper: auto-answers the interest quiz so it lands on Engineering.
 *
 * Runs inside the app's page and clicks through the real UI (same API calls a student
 * would make), answering each question from the table below.
 *
 * Screening answers: the recommended courses are ranked only by closeness on the student's
 * top category (assessment.service.ts getScreeningRecommendations), so Realistic is answered
 * 5 across the board (score 1.0 -> Mechanical Engineering first, then three more engineering
 * degrees) and Investigative is held at 4 so it can never tie Realistic for the top spot.
 * Drill-down answers follow the "Engineering Quiz Guide" (engineering's subcategory averages),
 * which is what picks the suggested major/stream.
 *
 * How to run (app must be open, e.g. http://localhost:5173):
 *   - Paste this whole file into the browser DevTools console, or
 *   - `npm run demo:engineering` from frontend/ (opens its own browser window).
 * It can be started from any screen, including part-way through the quiz.
 *
 * Set STOP_AT_INITIAL_RESULT to true to stop after the first 20 questions instead of
 * also answering the 25 "Personalise further" questions (which pick a specific major).
 * Running it again from the initial result (or the course recommendations page) then
 * continues with those 25 questions.
 */
(async () => {
  const STOP_AT_INITIAL_RESULT = true;
  const STEP_DELAY_MS = 120; // small pause so the audience can see it moving
  const FALLBACK_ANSWER = 3;

  const ANSWERS = {
    // Screening - Realistic
    "Building or fixing something with your hands": 5,
    "Spending your day doing physical, active work rather than sitting at a desk": 5,
    "Learning a skill through hands-on practice rather than reading about it": 5,
    "Working toward practical, tangible results you can see and touch": 5,
    // Screening - Investigative
    "Figuring out why something isn't working through trial and error": 4,
    "Solving a complex or tricky problem just for the challenge of it": 4,
    "Spending time thinking deeply rather than acting quickly": 4,
    "Analysing information to find patterns others might miss": 4,
    // Screening - Artistic
    "Coming up with an original idea, design, or piece of work": 2,
    "Working on something where there's no single \"right\" answer": 2,
    "Making something that reflects your own personal style": 1,
    "Having freedom to do things your own way rather than following a set method": 1,
    // Screening - Social
    "Supporting or caring for people who need help": 2,
    "Teaching or coaching someone to help them improve": 2,
    "Spending most of your day interacting directly with people": 1,
    "Working closely with a group of people rather than alone": 2,
    // Screening - Enterprising
    "Taking the lead on a group project rather than following someone else's direction": 3,
    "Starting something of your own, even if it's risky": 2,
    "Making decisions quickly and confidently under pressure": 3,
    "Motivating a team to work toward a shared goal": 2,
    // Screening - Conventional
    "Keeping things organised - files, schedules, records": 3,
    "Following a clear set of rules or procedures rather than improvising": 3,
    "Having a clearly defined role with clear expectations": 3,
    "Working with structured information, like numbers or data": 4,

    // Drill-down - Realistic
    "Designing a system or structure to solve a real-world technical problem": 5,
    "Applying maths and science principles to build or improve something practical": 5,
    "Testing a prototype and refining its design based on the results": 5,
    "Repairing or maintaining machines, engines, or electronic devices": 4,
    "Diagnosing what's wrong with something mechanical or electrical by testing it piece by piece": 4,
    "Assembling or wiring a device from its individual parts": 4,
    "Physically building or renovating a structure, like a house or piece of furniture": 3,
    "Reading and following a building plan to construct something": 3,
    "Using power tools to measure, cut, and fit materials together": 3,
    "Working outdoors to monitor or protect natural environments like rivers, forests, or coastlines": 3,
    "Collecting soil, water, or air samples in the field to check for pollution": 3,
    "Restoring damaged land, such as replanting native vegetation or cleaning up a contaminated site": 3,
    "Studying how and why crime happens in society": 1,
    "Working within the justice or law enforcement system to keep people safe": 1,
    "Examining evidence to work out what happened at a crime scene or incident": 1,
    "Studying how the human body performs and recovers during physical activity": 1,
    "Coaching or training someone to improve their physical performance": 1,
    "Designing a fitness or nutrition program tailored to someone's goals": 1,
    "Caring for the health and wellbeing of animals": 1,
    "Learning about animal biology, behaviour, or medical treatment": 1,
    "Handling and calming animals during a check-up or treatment": 1,
    // Drill-down - Investigative
    "Working with numbers or statistical models to solve a problem": 4,
    "Finding patterns in a large set of numerical data": 4,
    "Working through a proof or logic puzzle step by step": 4,
    "Studying how matter and energy behave": 4,
    "Running experiments to test how the physical world works": 4,
    "Using formulas or models to predict how a physical system will behave": 4,
    "Writing code or an algorithm to solve a problem": 4,
    "Understanding how software or computer systems work under the hood": 4,
    "Figuring out how to make a program run faster or more efficiently": 4,
    "Studying living organisms, from cells to entire ecosystems": 2,
    "Conducting a lab experiment involving plants, animals, or biological samples": 2,
    "Observing and recording how an organism or ecosystem changes over time": 2,
    "Understanding how diseases affect the human body and how to treat them": 2,
    "Studying human anatomy or medical case studies": 2,
    "Researching how a drug or treatment works in the body": 2,
    "Studying why people and societies behave the way they do": 2,
    "Analysing survey or behavioural data about groups of people": 2,
    "Researching how culture, economics, or policy shapes people's lives": 2,
    "Studying history, philosophy, or literature in depth": 2,
    "Analysing and interpreting texts, ideas, or cultural works": 2,
    "Researching how past events or ideas shaped the world today": 2,
    // Drill-down - Artistic
    "Drawing, painting, or designing something visually": 2,
    "Creating a visual layout or design for a project": 2,
    "Taking and editing photos to capture a particular mood or idea": 2,
    "Writing a story, script, or piece of creative content": 2,
    "Producing or editing video, audio, or media content": 2,
    "Writing an article, blog, or review to share your perspective": 2,
    "Acting, dancing, or performing in front of an audience": 1,
    "Rehearsing and preparing for a live performance": 1,
    "Interpreting a character or piece to express emotion to an audience": 1,
    "Composing, playing, or producing music": 1,
    "Learning a new instrument or piece of music": 1,
    "Arranging or mixing a song so all the parts sound right together": 1,
    // Drill-down - Social
    "Planning and delivering a lesson to help someone learn": 2,
    "Explaining a concept in a way that makes it click for someone": 2,
    "Helping someone practise a skill until they can do it on their own": 2,
    "Organising or contributing to a community event or initiative": 2,
    "Providing a service that directly improves someone's daily life": 2,
    "Volunteering to support people or groups in need": 2,
    "Caring for a patient's physical or mental wellbeing": 2,
    "Working directly in a hospital, clinic, or healthcare setting": 2,
    "Helping someone recover from an illness or injury": 2,
    "Listening to and supporting someone going through a hard time": 1,
    "Helping someone work through a personal or emotional challenge": 1,
    "Helping someone understand their thoughts and feelings more clearly": 1,
    // Drill-down - Enterprising
    "Overseeing a team or project to make sure it runs smoothly": 3,
    "Coordinating people and resources to meet a deadline": 3,
    "Making decisions about priorities and delegating tasks to others": 3,
    "Building a business or product from scratch": 3,
    "Taking a financial risk to pursue your own idea": 3,
    "Spotting a gap in the market and pitching a solution to fill it": 3,
    "Coming up with a campaign to promote a product or brand": 2,
    "Understanding what makes people want to buy something": 2,
    "Creating content for social media to grow an audience": 2,
    "Helping resolve conflict or improve how people work together": 2,
    "Managing hiring, training, or workplace culture": 2,
    "Interviewing and selecting candidates for a role": 2,
    "Debating or arguing a position to persuade others": 2,
    "Understanding and applying rules, policy, or law to a real situation": 2,
    "Researching legal cases or policies to build an argument": 2,
    "Convincing someone to buy or invest in a product or idea": 1,
    "Closing a deal or negotiating a sale": 1,
    "Building relationships with customers so they keep coming back": 1,
    // Drill-down - Conventional
    "Setting up, maintaining, or troubleshooting computer systems/networks": 3,
    "Managing databases, servers, or IT infrastructure": 3,
    "Setting up security measures to protect systems and data": 3,
    "Managing day-to-day office operations or admin tasks": 3,
    "Keeping a business's processes running efficiently": 3,
    "Organising schedules, files, or records so everything is easy to find": 3,
    "Tracking and balancing financial records": 2,
    "Making sure numbers in a budget or ledger are correct": 2,
    "Preparing tax returns or financial reports for a person or business": 2,
    "Managing or analysing money, investments, or financial risk": 2,
    "Working with financial data to make an investment or lending decision": 2,
    "Tracking market trends to understand where money is moving": 2,
  };

  // Tolerates curly quotes, en/em dashes and spacing differences between the DB text and this table.
  const normalise = (text) =>
    text
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  const answerByText = new Map(Object.entries(ANSWERS).map(([text, value]) => [normalise(text), value]));

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const buttons = () => [...document.querySelectorAll("button")];
  const findButton = (label) =>
    buttons().find((button) => button.textContent.replace(/\s+/g, " ").trim().startsWith(label) && !button.disabled);
  const radioGroup = () => document.querySelector('[role="radiogroup"]');

  /** Polls until `check` returns something truthy, or throws after `timeoutMs`. */
  const waitFor = async (check, what, timeoutMs = 30000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const value = check();
      if (value) return value;
      await sleep(100);
    }
    throw new Error(`Timed out waiting for ${what}`);
  };

  const log = (...args) => console.log("%c[demo]", "color:#1f5fbf;font-weight:bold", ...args);
  let answered = 0;
  let personalised = false;

  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    const group = radioGroup();

    if (group) {
      const question = group.getAttribute("aria-label") ?? "";
      let value = answerByText.get(normalise(question));
      if (value === undefined) {
        console.warn(`[demo] No answer for "${question}", using ${FALLBACK_ANSWER}`);
        value = FALLBACK_ANSWER;
      }
      const option = [...group.querySelectorAll('[role="radio"]')].find(
        (radio) => radio.querySelector("strong")?.textContent.trim() === String(value),
      );
      option.click();
      answered += 1;
      // The Next / "Continue..." / "See my..." button is the enabled primary one beside Back.
      const next = await waitFor(
        () => buttons().find((b) => /^(Next|Continue|See my)/.test(b.textContent.trim()) && !b.disabled),
        "the Next button",
      );
      await sleep(STEP_DELAY_MS);
      next.click();
      // Wait until the question changes, or the quiz moves on to the results page.
      await waitFor(
        () => radioGroup()?.getAttribute("aria-label") !== question,
        "the next question",
        60000,
      );
      continue;
    }

    const personalise = findButton("Personalise further");
    // A run that didn't answer the first 20 questions itself was started to continue from here.
    if (personalise && (!STOP_AT_INITIAL_RESULT || answered === 0) && !personalised) {
      log("Initial result reached - continuing to the personalised questions");
      personalised = true;
      personalise.click();
      await waitFor(radioGroup, "the drill-down questions");
      continue;
    }

    if (findButton("View course recommendations")) {
      log(`Done - answered ${answered} questions. Showing the quiz result.`);
      return;
    }

    const start = findButton("Start quiz");
    if (start) {
      start.click();
      await waitFor(radioGroup, "the first question", 60000);
      continue;
    }

    const quizLink = findButton("Interest Quiz");
    if (quizLink) {
      quizLink.click();
      await waitFor(() => findButton("Start quiz") || radioGroup(), "the quiz page");
      continue;
    }

    await sleep(250); // loading dialog or a page transition in progress
  }
  console.warn("[demo] Gave up - couldn't find the quiz on this page.");
})();
