// Opens the app in a browser window and runs demo-engineering-quiz.js in it, leaving the
// window open on the result for the showcase. Usage: npm run demo:engineering [-- <app url>]
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "http://localhost:5173";
const script = fileURLToPath(new URL("./demo-engineering-quiz.js", import.meta.url));

const browser = await chromium.launch({ headless: false, args: ["--start-maximized"] });
const page = await browser.newPage({ viewport: null });
page.on("console", (message) => console.log(message.text()));
await page.goto(url);
await page.addScriptTag({ path: script });
console.log("Running the quiz. Close the browser window to exit.");
browser.on("disconnected", () => process.exit(0));
