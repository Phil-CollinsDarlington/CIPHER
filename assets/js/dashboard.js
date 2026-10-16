/* ============================================================
   CIPHER
   FILE: dashboard.js

   PURPOSE:
   Load the authenticated player's information.

   CURRENT FEATURES:
   - Verify that a login session exists
   - Redirect unauthenticated visitors to login
   - Retrieve the authenticated user's account
   - Load the public profile
   - Display account information
   - Display email verification status
   - Handle logout

   FUTURE ENHANCEMENTS:
   - Retrieve real challenge points
   - Retrieve verified challenge completions
   - Display achievements
   - Display team membership
   - Load live challenge listings
   - Load individual and team rankings

   IMPORTANT:
   Statistics remain placeholders until their secure backend
   queries are implemented.
   ============================================================ */

import { supabase } from "./supabase-client.js";


// ============================================================
// 1. DOM HELPERS
// ============================================================

/**
 * Update the text of an element safely.
 *
 * Using textContent avoids interpreting player information
 * as HTML markup.
 */
function setText(elementId, value) {

    const element = document.getElementById(elementId);

    if (element) {
        element.textContent = value;
    }
}


/**
 * Display a dashboard status message.
 */
function showDashboardMessage(message, type = "success") {

    const element =
        document.getElementById("dashboard-message");

    if (!element) {
        return;
    }

    element.textContent = message;

    element.className =
        `dashboard-message visible ${type}`;
}


// ============================================================
// 2. FORMAT ACCOUNT CREATION DATE
// ============================================================

/**
 * Convert a timestamp into a readable date.
 *
 * Example:
 * October 12, 2026
 */
function formatDate(timestamp) {

    if (!timestamp) {
        return "Not available";
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return "Not available";
    }

    return new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "long",
        day: "numeric"
    }).format(date);
}

function renderDashboardChallenges(challenges) {
    const list = document.getElementById("dashboard-challenge-list");

    if (!list) {
        return;
    }

    if (!challenges.length) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-symbol" aria-hidden="true">⌁</div>
                <h3>No active challenges yet.</h3>
                <p>Check back when the next mission is published.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = "";

    challenges.forEach((challenge) => {
        const card = document.createElement("article");
        card.className = "dashboard-challenge-card";
        card.innerHTML = `
            <span class="stat-label"></span>
            <h3></h3>
            <p class="challenge-description"></p>
            <div class="challenge-card-footer">
                <span class="challenge-points"></span>
                <span class="challenge-status"></span>
            </div>
        `;

        card.querySelector(".stat-label").textContent =
            challenge.challenge_type;
        card.querySelector("h3").textContent = challenge.title;
        card.querySelector(".challenge-description").textContent =
            challenge.description;
        card.querySelector(".challenge-points").textContent =
            `${challenge.max_points} points`;
        card.querySelector(".challenge-status").textContent =
            challenge.status === "active" ? "Active now" : "Published";
        list.appendChild(card);
    });
}

async function loadDashboardData() {
    const [
        { data: stats, error: statsError },
        { data: challenges, error: challengesError }
    ] = await Promise.all([
        supabase.rpc("get_player_stats"),
        supabase
            .from("challenges")
            .select(
                "id, title, description, challenge_type, status, max_points, starts_at, ends_at"
            )
            .in("status", ["published", "active"])
            .order("starts_at", { ascending: true, nullsFirst: false }),
    ]);

    if (statsError) {
        throw statsError;
    }

    if (challengesError) {
        throw challengesError;
    }

    const playerStats = Array.isArray(stats) ? stats[0] : stats;

    setText("total-points", playerStats?.total_points ?? 0);
    setText("challenges-solved", playerStats?.challenges_solved ?? 0);
    setText("achievement-count", playerStats?.achievement_count ?? 0);
    setText("team-status", playerStats?.team_name || "Solo player");
    renderDashboardChallenges(challenges || []);
}


// ============================================================
// 3. LOAD PLAYER INFORMATION
// ============================================================

async function loadPlayerDashboard() {

    try {

        // ----------------------------------------------------
        // STEP 1:
        // Ask Supabase whether a valid session exists.
        // ----------------------------------------------------

        const {
            data: { session },
            error: sessionError
        } = await supabase.auth.getSession();


        if (sessionError) {
            throw sessionError;
        }


        // If no session exists, the player must log in first.
        if (!session) {

            window.location.replace("login.html");

            return;
        }


        // ----------------------------------------------------
        // STEP 2:
        // Retrieve the authenticated user's account.
        //
        // The user ID comes from the verified Supabase session.
        // We do not trust an ID supplied by a URL parameter.
        // ----------------------------------------------------

        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();


        if (userError) {
            throw userError;
        }


        if (!user) {

            window.location.replace("login.html");

            return;
        }


        // ----------------------------------------------------
        // STEP 3:
        // Retrieve the player's public profile.
        //
        // The profiles table has a SELECT policy for
        // authenticated users.
        // ----------------------------------------------------

        const {
            data: profile,
            error: profileError
        } = await supabase
            .from("profiles")
            .select("display_name, avatar_url, created_at")
            .eq("id", user.id)
            .maybeSingle();


        if (profileError) {
            throw profileError;
        }


        // ----------------------------------------------------
        // STEP 4:
        // Choose the best available display name.
        //
        // The profile should normally exist because our
        // database trigger creates it at registration.
        //
        // The metadata fallback helps identify a missing
        // profile without inventing a database record here.
        // ----------------------------------------------------

        const metadataName =
            user.user_metadata?.display_name ||
            user.user_metadata?.full_name ||
            "";

        const displayName =
            profile?.display_name ||
            metadataName ||
            "CIPHER Player";


        // ----------------------------------------------------
        // STEP 5:
        // Display player information.
        // ----------------------------------------------------

        setText("player-name", displayName);

        setText("welcome-name", displayName);

        setText("profile-display-name", displayName);


        // The email comes from the authenticated user record.
        const email = user.email || "Email unavailable";

        setText("player-email", email);

        setText("profile-email", email);


        // ----------------------------------------------------
        // STEP 6:
        // Create an avatar initial from the display name.
        //
        // This is only a visual fallback. A real image upload
        // feature can be added later.
        // ----------------------------------------------------

        const initial = displayName
            .trim()
            .charAt(0)
            .toUpperCase() || "?";

        setText("player-avatar", initial);


        // ----------------------------------------------------
        // STEP 7:
        // Display verification status.
        //
        // Supabase normally populates email_confirmed_at for
        // confirmed email accounts. OAuth accounts may have
        // different confirmation behavior depending on provider.
        // ----------------------------------------------------

        const verified =
            Boolean(user.email_confirmed_at);

        setText(
            "profile-verification",
            verified ? "Verified" : "Not verified"
        );


        // ----------------------------------------------------
        // STEP 8:
        // Display account creation date.
        // ----------------------------------------------------

        setText(
            "profile-created",
            formatDate(profile?.created_at || user.created_at)
        );

        await loadDashboardData(user.id);


        // ----------------------------------------------------
        // STEP 9:
        // Show a welcome message.
        // ----------------------------------------------------

        showDashboardMessage(
            `Welcome to CIPHER, ${displayName}. Your account is connected.`,
            "success"
        );


        // ----------------------------------------------------
        // FUTURE ENHANCEMENT:
        //
        // Load real player statistics after the secure scoring
        // and challenge-participation systems are implemented.
        //
        // Do not calculate official points from browser-side
        // data or trust scores supplied by the player.
        // ----------------------------------------------------

    } catch (error) {

        console.error(
            "CIPHER dashboard loading error:",
            error
        );

        showDashboardMessage(
            "We couldn't load your account information. " +
            "Please refresh the page or log in again.",
            "error"
        );

    }

}


// ============================================================
// 4. LOGOUT
// ============================================================

const logoutButton =
    document.getElementById("logout-button");

if (logoutButton) {

    logoutButton.addEventListener("click", async () => {

        logoutButton.disabled = true;

        logoutButton.textContent = "Logging out...";


        try {

            // Sign out from the current Supabase session.
            const { error } = await supabase.auth.signOut();

            if (error) {
                throw error;
            }

            // Replace the dashboard history entry so the
            // player is returned to the login page.
            window.location.replace("login.html");

        } catch (error) {

            console.error("CIPHER logout error:", error);

            showDashboardMessage(
                "Logout failed. Please try again.",
                "error"
            );

            logoutButton.disabled = false;

            logoutButton.textContent = "Log out";

        }

    });

}


// ============================================================
// 5. PLACEHOLDER NAVIGATION
// ============================================================

// Keep only features that are still marked as coming soon from
// intercepting their links.

document
    .querySelectorAll("[data-coming-soon]")
    .forEach((link) => {

        link.addEventListener("click", (event) => {

            event.preventDefault();

            const feature = link.dataset.comingSoon;

            showDashboardMessage(
                `${feature} will be available in a future CIPHER update.`,
                "success"
            );

        });

    });


// ============================================================
// 6. START DASHBOARD INITIALIZATION
// ============================================================

loadPlayerDashboard();