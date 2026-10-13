/* ============================================================
   CIPHER
   FILE: supabase-client.js

   PURPOSE:
   Establish a reusable connection to Supabase.

   USED BY:
   - auth.js
   - dashboard.js
   - Future application modules

   IMPORTANT SECURITY RULES:
   1. Use only the Supabase Project URL and publishable key here.
   2. Never put a service-role key or secret API key in this file.
   3. Database security must be enforced through RLS and trusted
      backend operations, not through frontend code alone.

   FUTURE ENHANCEMENTS:
   - Centralized error reporting
   - Connection monitoring
   - Application analytics
   ============================================================ */

// Import the official Supabase JavaScript client.
// The browser downloads this library as an ES module.
import { createClient } from
    "https://esm.sh/@supabase/supabase-js@2";


// ============================================================
// CONFIGURATION
// ============================================================

// STEP 1:
// Open your Supabase dashboard.
//
// STEP 2:
// Find your project's API settings.
//
// STEP 3:
// Copy your actual Project URL into SUPABASE_URL.
//
// Example format:
// https://your-project-reference.supabase.co
//
// Do not use the example URL as your real project URL.

const SUPABASE_URL = "https://vyaukinudijwpvfmagii.supabase.co";


// STEP 4:
// Paste your Supabase publishable key below.
//
// A modern publishable key often begins with:
// sb_publishable_
//
// Some older projects use the legacy anon key.
//
// NEVER put a secret API key or service_role key here.

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_0EZRmTd2APTL8oKVS6aQgw_zxLsR7Ik";


// ============================================================
// CONFIGURATION VALIDATION
// ============================================================

// Check whether the example values have been replaced.
//
// This helps identify a common beginner mistake: forgetting
// to enter the actual Supabase project credentials.

if (
    SUPABASE_URL.includes("PASTE_YOUR_") ||
    SUPABASE_PUBLISHABLE_KEY.includes("PASTE_YOUR_")
) {
    console.error(
        "CIPHER: Add your Supabase Project URL and publishable key " +
        "inside assets/js/supabase-client.js."
    );
}


// ============================================================
// CREATE THE SUPABASE CLIENT
// ============================================================

// createClient() creates the connection used by the application.
//
// Other JavaScript modules import this client rather than
// creating separate connections for every page.

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);