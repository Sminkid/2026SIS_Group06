import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { disconnectPrisma } from "./db/prisma.js";

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});

const shutdown = () => {
  server.close(() => {
    void disconnectPrisma().finally(() => process.exit(0));
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

