import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Client } from "pg";

// Usage: tsx src/script/apply-sql.ts <path-to-sql-file>
//
// Runs a plain .sql file against DATABASE_URL inside a single transaction
// (all-or-nothing) - a lightweight stand-in for `psql -f` when the
// Postgres client tools aren't installed locally.

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const sqlPath = process.argv[2];
if (!sqlPath) {
  throw new Error("Usage: tsx src/script/apply-sql.ts <path-to-sql-file>");
}

const client = new Client({ connectionString: databaseUrl });

async function main(sqlPath: string) {
  const sql = await readFile(sqlPath, "utf-8");

  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log(`Applied ${sqlPath} successfully.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main(sqlPath).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
