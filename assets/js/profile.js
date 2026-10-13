
/*
 * CIPHER Player Profile
 *
 * Uses the existing Supabase client.
 * Reads and updates only the signed-in user's profile.
 *
 * Security:
 * - Authentication is checked before profile access.
 * - Supabase Row Level Security remains responsible for
 *   enforcing database permissions.
 * - This page never accepts a user ID from a form.
 */

import { supabase } from "./supabase-client.js";

// Find the elements on the profile page.
const profileForm = document.getElementById("profile-form");
const displayNameInput = document.getElementById("display-name");
const avatarUrlInput = document.getElementById("avatar-url");
const messageElement = document.getElementById("profile-message");
const createdElement = document.getElementById("profile-created");
const saveButton = document.getElementById("save-profile");
const signOutButton = document.getElementById("sign-out");

// Remember the signed-in user while this page is open.
let currentUser = null;

// Display readable messages without inserting HTML.
function showMessage(message) {
    messageElement.textContent = message;
}

// Load the signed-in user's profile from Supabase.
async function loadProfile() {
    showMessage("Checking your CIPHER session...");

    // Ask Supabase who is currently signed in.
    const { data: userData, error: userError } =
        await supabase.auth.getUser();

    if (userError || !userData.user) {
        // No valid session: return the player to login.
        window.location.replace("login.html");
        return;
    }

    currentUser = userData.user;

    showMessage("Loading your player profile...");

    // Only request the profile matching the authenticated user.
    // The database RLS policies must still enforce permissions.
    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, created_at, updated_at")
        .eq("id", currentUser.id)
        .maybeSingle();

    if (profileError) {
        console.error("CIPHER profile load failed:", profileError);

        showMessage(
            "We could not load your profile. Check the browser console."
        );
        return;
    }

    if (!profile) {
        /*
         * Do not automatically insert a profile here.
         * Your existing signup trigger may need checking if a
         * confirmed account has no matching profile record.
         */
        showMessage(
            "Your account exists, but its profile record was not found. " +
            "Please ask the administrator to check profile creation."
        );
        return;
    }

    // Fill the form using the saved profile values.
    displayNameInput.value = profile.display_name ?? "";
    avatarUrlInput.value = profile.avatar_url ?? "";

    // Display the creation date in the user's local date format.
    if (profile.created_at) {
        createdElement.textContent =
            "Player since " +
            new Date(profile.created_at).toLocaleDateString();
    }

    // Show the form only after a profile has loaded successfully.
    profileForm.hidden = false;
    showMessage("Profile loaded. You can update your details.");
}

// Save changes to the existing profile.
profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Never save if we have not verified the signed-in user.
    if (!currentUser) {
        showMessage("Your session has expired. Please sign in again.");
        return;
    }

    const displayName = displayNameInput.value.trim();
    const avatarUrl = avatarUrlInput.value.trim();

    // Basic validation before sending the update.
    if (displayName.length < 2 || displayName.length > 40) {
        showMessage("Your display name must contain 2 to 40 characters.");
        return;
    }

    // Browser validation helps, but database policies remain essential.
    if (avatarUrl.length > 500) {
        showMessage("Your avatar URL is too long.");
        return;
    }

    saveButton.disabled = true;
    showMessage("Saving your profile...");

    try {
        /*
         * Update the existing row only.
         * The ID comes from the authenticated Supabase session,
         * not from an editable form field.
         */
        const { data, error } = await supabase
            .from("profiles")
            .update({
                display_name: displayName,
                avatar_url: avatarUrl || null,
                updated_at: new Date().toISOString()
            })
            .eq("id", currentUser.id)
            .select("id, display_name, avatar_url, updated_at")
            .maybeSingle();

        if (error) {
            console.error("CIPHER profile save failed:", error);
            showMessage("Profile could not be saved. Please check the error.");
            return;
        }

        if (!data) {
            showMessage(
                "No profile was updated. Check your profile row and " +
                "Supabase update policy."
            );
            return;
        }

        showMessage("Profile saved successfully.");
    } catch (error) {
        console.error("Unexpected profile error:", error);
        showMessage("An unexpected error occurred while saving.");
    } finally {
        saveButton.disabled = false;
    }
});

// Sign out through Supabase, then return to the login page.
signOutButton.addEventListener("click", async () => {
    signOutButton.disabled = true;
    showMessage("Signing out...");

    const { error } = await supabase.auth.signOut();

    if (error) {
        console.error("CIPHER sign-out failed:", error);
        showMessage("Sign-out failed. Please try again.");
        signOutButton.disabled = false;
        return;
    }

    window.location.replace("login.html");
});

// Load the profile as soon as the page starts.
loadProfile().catch((error) => {
    console.error("CIPHER profile initialization failed:", error);
    showMessage("Could not initialize the profile page.");
});