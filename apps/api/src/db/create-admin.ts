/**
 * Creates the first administrator account.
 *
 *   npm run admin:create --workspace=@deetech/api -- --email a@b.com --name "A B"
 *
 * The password is NOT taken from a command-line argument: argv is visible to
 * every process on the machine and lands in shell history. It is read from
 * ADMIN_PASSWORD in the environment, or generated here and printed once.
 *
 * Section 9 of the plan calls for the first admin account to be initialised
 * securely; this is that step.
 */
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { loadConfig } from "../config.js";
import { hashPassword } from "../services/password.js";
import { AuthRepository } from "../repositories/auth.js";
import { createPool } from "./pool.js";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "admin" },
  },
  allowPositionals: false,
});

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

const email = values.email?.trim();
const name = values.name?.trim();
const role = values.role === "editor" ? "editor" : "admin";

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  fail("--email is required and must be a valid email address.");
}
if (!name) {
  fail('--name is required, e.g. --name "Ajay Kumar".');
}

const config = loadConfig();
if (!config.databaseUrl) {
  fail("DATABASE_URL is not set.");
}

/** Generated passwords are long enough that the 12-char floor is moot. */
const generated = !process.env.ADMIN_PASSWORD;
const password = process.env.ADMIN_PASSWORD ?? randomBytes(18).toString("base64url");

if (!generated && password.length < 12) {
  fail("ADMIN_PASSWORD must be at least 12 characters.");
}

const pool = createPool(config.databaseUrl);
const repository = new AuthRepository(pool);

try {
  const existing = await repository.findForLogin(email);
  if (existing) {
    fail(`An account already exists for ${email}.`);
  }

  const user = await repository.createUser({
    email,
    name,
    role,
    passwordHash: await hashPassword(password),
  });

  console.log("");
  console.log(`  Created ${user.role} account for ${user.email}`);
  if (generated) {
    console.log("");
    console.log(`  Password: ${password}`);
    console.log("");
    console.log("  This is shown once. Store it in a password manager now.");
  }
  console.log("");
} catch (error) {
  console.error(
    `Failed to create the account: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
