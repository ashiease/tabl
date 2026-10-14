// scripts/seed-users.mjs
//
// Seeds TABL users into Supabase.
// Requires the SERVICE ROLE key — do NOT commit this key or bundle it.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-users.mjs

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS = [
  { username: 'admin',  password: 'admin1', role: 'admin',   display_name: 'Admin'  },
  { username: 'kavei',  password: 'pass001', role: 'student', display_name: 'Kavei'  },
  { username: 'harsh',  password: 'pass002', role: 'student', display_name: 'Harsh'  },
  { username: 'tarun',  password: 'pass003', role: 'student', display_name: 'Tarun'  },
  { username: 'diya',   password: 'pass004', role: 'student', display_name: 'Diya'   },
];

async function seed() {
  for (const u of USERS) {
    const email = `${u.username}@tabl.local`;

    // 1. Create the auth user
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: u.password,
      email_confirm: true,               // skip the confirmation email
      user_metadata: {
        username: u.username,
        display_name: u.display_name,
        role: u.role,
      },
    });

    if (error) {
      if (error.message?.includes('already registered')) {
        console.log(`↺ ${u.username} — already exists, skipping`);
        continue;
      }
      console.error(`✗ ${u.username} — ${error.message}`);
      continue;
    }

    console.log(`✓ ${u.username} — created (${data.user.id})`);
  }

  // 2. Ensure profiles are correct (in case trigger didn't run or was wrong)
  for (const u of USERS) {
    const email = `${u.username}@tabl.local`;
    const { data: { users } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    const match = users.find(x => x.email === email);
    if (!match) continue;

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: match.id,
        username: u.username,
        display_name: u.display_name,
        role: u.role,
      }, { onConflict: 'id' });

    if (error) {
      console.error(`✗ profile ${u.username} — ${error.message}`);
    } else {
      console.log(`✓ profile ${u.username} — set`);
    }
  }

  console.log('\nDone.');
}

seed().catch(e => {
  console.error(e);
  process.exit(1);
});