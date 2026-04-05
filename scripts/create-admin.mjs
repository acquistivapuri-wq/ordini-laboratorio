import "dotenv/config";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const username = process.env.SEED_ADMIN_USERNAME || "admin";
const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
const fullName = process.env.SEED_ADMIN_FULL_NAME || "Administrator";

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

const passwordHash = await bcrypt.hash(password, 10);

const { error } = await supabase.from("app_users").upsert(
  {
    username,
    full_name: fullName,
    password_hash: passwordHash,
    role: "admin",
    is_active: true
  },
  { onConflict: "username" }
);

if (error) {
  console.error(error);
  process.exit(1);
}

console.log(`Admin creato/aggiornato: ${username}`);
