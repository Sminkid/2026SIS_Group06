import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";

// Seeds the RIASEC quiz question bank: 24 category-level (SCREENING) items and
// 93 subcategory-level (DRILL_DOWN) items. Run via:
//   npx tsx src/script/quiz/seed-questions.


const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const CATEGORY_QUESTIONS: Record<string, string[]> = {
  "riasec-realistic": [
    "Building or fixing something with your hands",
    "Spending your day doing physical, active work rather than sitting at a desk",
    "Learning a skill through hands-on practice rather than reading about it",
    "Working toward practical, tangible results you can see and touch",
  ],
  "riasec-investigative": [
    "Figuring out why something isn't working through trial and error",
    "Solving a complex or tricky problem just for the challenge of it",
    "Spending time thinking deeply rather than acting quickly",
    "Analysing information to find patterns others might miss",
  ],
  "riasec-artistic": [
    "Coming up with an original idea, design, or piece of work",
    "Working on something where there's no single \"right\" answer",
    "Making something that reflects your own personal style",
    "Having freedom to do things your own way rather than following a set method",
  ],
  "riasec-social": [
    "Supporting or caring for people who need help",
    "Teaching or coaching someone to help them improve",
    "Spending most of your day interacting directly with people",
    "Working closely with a group of people rather than alone",
  ],
  "riasec-enterprising": [
    "Taking the lead on a group project rather than following someone else's direction",
    "Starting something of your own, even if it's risky",
    "Making decisions quickly and confidently under pressure",
    "Motivating a team to work toward a shared goal",
  ],
  "riasec-conventional": [
    "Keeping things organised - files, schedules, records",
    "Following a clear set of rules or procedures rather than improvising",
    "Having a clearly defined role with clear expectations",
    "Working with structured information, like numbers or data",
  ],
};

interface SubcategoryBlock {
  subcategoryId: string;
  categoryId: string;
  questions: string[];
}

const SUBCATEGORY_QUESTIONS: SubcategoryBlock[] = [
  {
    subcategoryId: "riasec-realistic-mechanical",
    categoryId: "riasec-realistic",
    questions: [
      "Repairing or maintaining machines, engines, or electronic devices",
      "Diagnosing what's wrong with something mechanical or electrical by testing it piece by piece",
      "Assembling or wiring a device from its individual parts",
    ],
  },
  {
    subcategoryId: "riasec-realistic-engineering",
    categoryId: "riasec-realistic",
    questions: [
      "Designing a system or structure to solve a real-world technical problem",
      "Applying maths and science principles to build or improve something practical",
      "Testing a prototype and refining its design based on the results",
    ],
  },
  {
    subcategoryId: "riasec-realistic-building",
    categoryId: "riasec-realistic",
    questions: [
      "Physically building or renovating a structure, like a house or piece of furniture",
      "Reading and following a building plan to construct something",
      "Using power tools to measure, cut, and fit materials together",
    ],
  },

  {
    subcategoryId: "riasec-realistic-environmental-science",
    categoryId: "riasec-realistic",
    questions: [
      "Working outdoors to monitor or protect natural environments like rivers, forests, or coastlines",
      "Collecting soil, water, or air samples in the field to check for pollution",
      "Restoring damaged land, such as replanting native vegetation or cleaning up a contaminated site",
    ],
  },
  {
    subcategoryId: "riasec-realistic-veterinary",
    categoryId: "riasec-realistic",
    questions: [
      "Caring for the health and wellbeing of animals",
      "Learning about animal biology, behaviour, or medical treatment",
      "Handling and calming animals during a check-up or treatment",
    ],
  },
  {
    subcategoryId: "riasec-realistic-exercise-science",
    categoryId: "riasec-realistic",
    questions: [
      "Studying how the human body performs and recovers during physical activity",
      "Coaching or training someone to improve their physical performance",
      "Designing a fitness or nutrition program tailored to someone's goals",
    ],
  },
  {
    subcategoryId: "riasec-realistic-justice",
    categoryId: "riasec-realistic",
    questions: [
      "Studying how and why crime happens in society",
      "Working within the justice or law enforcement system to keep people safe",
      "Examining evidence to work out what happened at a crime scene or incident",
    ],
  },
  {
    subcategoryId: "riasec-investigative-life-sciences",
    categoryId: "riasec-investigative",
    questions: [
      "Studying living organisms, from cells to entire ecosystems",
      "Conducting a lab experiment involving plants, animals, or biological samples",
      "Observing and recording how an organism or ecosystem changes over time",
    ],
  },
  {
    subcategoryId: "riasec-investigative-physical-sciences",
    categoryId: "riasec-investigative",
    questions: [
      "Studying how matter and energy behave",
      "Running experiments to test how the physical world works",
      "Using formulas or models to predict how a physical system will behave",
    ],
  },
  {
    subcategoryId: "riasec-investigative-medical-science",
    categoryId: "riasec-investigative",
    questions: [
      "Understanding how diseases affect the human body and how to treat them",
      "Studying human anatomy or medical case studies",
      "Researching how a drug or treatment works in the body",
    ],
  },
  {
    subcategoryId: "riasec-investigative-social-science",
    categoryId: "riasec-investigative",
    questions: [
      "Studying why people and societies behave the way they do",
      "Analysing survey or behavioural data about groups of people",
      "Researching how culture, economics, or policy shapes people's lives",
    ],
  },
  {
    subcategoryId: "riasec-investigative-mathematics",
    categoryId: "riasec-investigative",
    questions: [
      "Working with numbers or statistical models to solve a problem",
      "Finding patterns in a large set of numerical data",
      "Working through a proof or logic puzzle step by step",
    ],
  },
  {
    subcategoryId: "riasec-investigative-humanities",
    categoryId: "riasec-investigative",
    questions: [
      "Studying history, philosophy, or literature in depth",
      "Analysing and interpreting texts, ideas, or cultural works",
      "Researching how past events or ideas shaped the world today",
    ],
  },
  {
    subcategoryId: "riasec-investigative-computer-science",
    categoryId: "riasec-investigative",
    questions: [
      "Writing code or an algorithm to solve a problem",
      "Understanding how software or computer systems work under the hood",
      "Figuring out how to make a program run faster or more efficiently",
    ],
  },
  {
    subcategoryId: "riasec-artistic-visual-arts",
    categoryId: "riasec-artistic",
    questions: [
      "Drawing, painting, or designing something visually",
      "Creating a visual layout or design for a project",
      "Taking and editing photos to capture a particular mood or idea",
    ],
  },
  {
    subcategoryId: "riasec-artistic-performing-arts",
    categoryId: "riasec-artistic",
    questions: [
      "Acting, dancing, or performing in front of an audience",
      "Rehearsing and preparing for a live performance",
      "Interpreting a character or piece to express emotion to an audience",
    ],
  },
  {
    subcategoryId: "riasec-artistic-music",
    categoryId: "riasec-artistic",
    questions: [
      "Composing, playing, or producing music",
      "Learning a new instrument or piece of music",
      "Arranging or mixing a song so all the parts sound right together",
    ],
  },
  {
    subcategoryId: "riasec-artistic-writing-media",
    categoryId: "riasec-artistic",
    questions: [
      "Writing a story, script, or piece of creative content",
      "Producing or editing video, audio, or media content",
      "Writing an article, blog, or review to share your perspective",
    ],
  },
  {
    subcategoryId: "riasec-social-teaching",
    categoryId: "riasec-social",
    questions: [
      "Planning and delivering a lesson to help someone learn",
      "Explaining a concept in a way that makes it click for someone",
      "Helping someone practise a skill until they can do it on their own",
    ],
  },
  {
    subcategoryId: "riasec-social-counseling",
    categoryId: "riasec-social",
    questions: [
      "Listening to and supporting someone going through a hard time",
      "Helping someone work through a personal or emotional challenge",
      "Helping someone understand their thoughts and feelings more clearly",
    ],
  },
  {
    subcategoryId: "riasec-social-health-care",
    categoryId: "riasec-social",
    questions: [
      "Caring for a patient's physical or mental wellbeing",
      "Working directly in a hospital, clinic, or healthcare setting",
      "Helping someone recover from an illness or injury",
    ],
  },
  {
    subcategoryId: "riasec-social-community-service",
    categoryId: "riasec-social",
    questions: [
      "Organising or contributing to a community event or initiative",
      "Providing a service that directly improves someone's daily life",
      "Volunteering to support people or groups in need",
    ],
  },
  {
    subcategoryId: "riasec-enterprising-sales",
    categoryId: "riasec-enterprising",
    questions: [
      "Convincing someone to buy or invest in a product or idea",
      "Closing a deal or negotiating a sale",
      "Building relationships with customers so they keep coming back",
    ],
  },
  {
    subcategoryId: "riasec-enterprising-management",
    categoryId: "riasec-enterprising",
    questions: [
      "Overseeing a team or project to make sure it runs smoothly",
      "Coordinating people and resources to meet a deadline",
      "Making decisions about priorities and delegating tasks to others",
    ],
  },
  {
    subcategoryId: "riasec-enterprising-marketing",
    categoryId: "riasec-enterprising",
    questions: [
      "Coming up with a campaign to promote a product or brand",
      "Understanding what makes people want to buy something",
      "Creating content for social media to grow an audience",
    ],
  },
  {
    subcategoryId: "riasec-enterprising-entrepreneurship",
    categoryId: "riasec-enterprising",
    questions: [
      "Building a business or product from scratch",
      "Taking a financial risk to pursue your own idea",
      "Spotting a gap in the market and pitching a solution to fill it",
    ],
  },
  {
    subcategoryId: "riasec-enterprising-law-politics",
    categoryId: "riasec-enterprising",
    questions: [
      "Debating or arguing a position to persuade others",
      "Understanding and applying rules, policy, or law to a real situation",
      "Researching legal cases or policies to build an argument",
    ],
  },
  {
    subcategoryId: "riasec-enterprising-human-resources",
    categoryId: "riasec-enterprising",
    questions: [
      "Helping resolve conflict or improve how people work together",
      "Managing hiring, training, or workplace culture",
      "Interviewing and selecting candidates for a role",
    ],
  },
  {
    subcategoryId: "riasec-conventional-business-administration",
    categoryId: "riasec-conventional",
    questions: [
      "Managing day-to-day office operations or admin tasks",
      "Keeping a business's processes running efficiently",
      "Organising schedules, files, or records so everything is easy to find",
    ],
  },
  {
    subcategoryId: "riasec-conventional-accounting",
    categoryId: "riasec-conventional",
    questions: [
      "Tracking and balancing financial records",
      "Making sure numbers in a budget or ledger are correct",
      "Preparing tax returns or financial reports for a person or business",
    ],
  },
  {
    subcategoryId: "riasec-conventional-banking-finance",
    categoryId: "riasec-conventional",
    questions: [
      "Managing or analysing money, investments, or financial risk",
      "Working with financial data to make an investment or lending decision",
      "Tracking market trends to understand where money is moving",
    ],
  },
  {
    subcategoryId: "riasec-conventional-information-technology",
    categoryId: "riasec-conventional",
    questions: [
      "Setting up, maintaining, or troubleshooting computer systems/networks",
      "Managing databases, servers, or IT infrastructure",
      "Setting up security measures to protect systems and data",
    ],
  },
];

function slug(id: string): string {
  return id.replace(/^riasec-/, "");
}

async function main() {
  let screeningCount = 0;
  for (const [categoryId, questions] of Object.entries(CATEGORY_QUESTIONS)) {
    for (const [i, text] of questions.entries()) {
      const id = `riasec-q-${slug(categoryId)}-screening-${i + 1}`;
      const data = {
        stage: "SCREENING" as const,
        categoryId,
        subcategoryId: null,
        text,
        sortOrder: i + 1,
        updatedAt: new Date(),
      };
      await prisma.question.upsert({ where: { id }, update: data, create: { id, ...data } });
      screeningCount += 1;
    }
  }

  let drillDownCount = 0;
  for (const block of SUBCATEGORY_QUESTIONS) {
    for (const [i, text] of block.questions.entries()) {
      const id = `riasec-q-${slug(block.subcategoryId)}-${i + 1}`;
      const data = {
        stage: "DRILL_DOWN" as const,
        categoryId: block.categoryId,
        subcategoryId: block.subcategoryId,
        text,
        sortOrder: i + 1,
        updatedAt: new Date(),
      };
      await prisma.question.upsert({ where: { id }, update: data, create: { id, ...data } });
      drillDownCount += 1;
    }
  }

  console.log(`Seeded ${screeningCount} SCREENING questions and ${drillDownCount} DRILL_DOWN questions.`);
  console.log(
    "Note: riasec-realistic-environmental-science has 0 DRILL_DOWN questions - rewrite needed (see file header).",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
