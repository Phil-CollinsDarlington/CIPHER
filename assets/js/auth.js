/* ============================================================
   CIPHER
   FILE: auth.js

   PURPOSE:
   Handle registration and login.

   FEATURES:
   - Email/password registration
   - Display-name registration metadata
   - Email/password login
   - Google OAuth
   - Friendly error messages
   - Redirects to the player dashboard

   SECURITY:
   - Passwords are sent to Supabase Auth over HTTPS.
   - This file never stores passwords in localStorage.
   - Database authorization must still be enforced by Supabase.
   ============================================================ */

import { supabase } from "./supabase-client.js";


// ============================================================
// 1. SHARED PAGE HELPERS
// ============================================================

/**
 * Display a message inside a page's status box.
 *
 * @param {string} elementId - ID of the message element.
 * @param {string} message - Text to display.
 * @param {"success"|"error"} type - Message style.
 */
function showMessage(elementId, message, type = "error") {

    const element = document.getElementById(elementId);

    // The current page may not contain this message element.
    if (!element) {
        return;
    }

    // Use textContent rather than innerHTML so that server
    // messages cannot be interpreted as injected HTML.
    element.textContent = message;

    element.className = `form-message visible ${type}`;
}


/**
 * Clear a previously displayed message.
 */
function clearMessage(elementId) {

    const element = document.getElementById(elementId);

    if (!element) {
        return;
    }

    element.textContent = "";
    element.className = "form-message";
}


/**
 * Translate common Supabase authentication errors into
 * messages that are easier for players to understand.
 */
function getFriendlyError(error) {

    const message = String(error?.message || "").toLowerCase();

    if (message.includes("invalid login credentials")) {
        return "The email or password is incorrect. Please try again.";
    }

    if (message.includes("user already registered")) {
        return "An account already exists for this email. Try logging in.";
    }

    if (message.includes("email not confirmed")) {
        return "Please verify your email address before logging in.";
    }

    if (
        message.includes("different from the old password") ||
        message.includes("same as the old password") ||
        message.includes("password is the same")
    ) {
        return "Your new password must be different from your old password.";
    }

    if (message.includes("password should be at least")) {
        return "Your password is too short. Use a stronger password.";
    }

    if (message.includes("rate limit")) {
        return "Too many attempts. Please wait a little before trying again.";
    }

    if (message.includes("network")) {
        return "A network error occurred. Check your internet connection.";
    }

    // Keep unexpected errors useful for debugging without
    // exposing secrets or technical stack traces to players.
    console.error("CIPHER authentication error:", error);

    return "Something went wrong. Please try again.";
}


// ============================================================
// 2. REDIRECT AFTER AUTHENTICATION
// ============================================================

/**
 * Send the player to the dashboard.
 *
 * window.location.origin keeps the redirect on the current
 * development host or deployed website.
 */
function openDashboard() {

    const requestedRedirect =
        new URLSearchParams(window.location.search).get("redirect");

    if (requestedRedirect) {
        try {
            const redirectUrl = new URL(
                requestedRedirect,
                window.location.origin
            );

            if (redirectUrl.origin === window.location.origin) {
                window.location.assign(redirectUrl.href);
                return;
            }
        } catch (error) {
            console.error("CIPHER redirect URL is invalid:", error);
        }
    }

    window.location.assign(
        new URL("dashboard.html", window.location.href).href
    );
}


// ============================================================
// 3. EMAIL REGISTRATION
// ============================================================

const registerForm = document.getElementById("register-form");


if (registerForm) {

    registerForm.addEventListener("submit", async (event) => {

        // Prevent the browser from refreshing the page.
        event.preventDefault();

        clearMessage("register-message");

        const submitButton =
            document.getElementById("register-submit");

        // Read the values entered by the player.
        const displayName =
            document.getElementById("display-name").value.trim();

        const email =
            document.getElementById("register-email").value.trim();

        const password =
            document.getElementById("register-password").value;

        const confirmPassword =
            document.getElementById("confirm-password").value;


        // ----------------------------------------------------
        // Validate the display name.
        // ----------------------------------------------------

        if (displayName.length < 2 || displayName.length > 30) {

            showMessage(
                "register-message",
                "Your display name must contain 2 to 30 characters."
            );

            return;
        }


        // ----------------------------------------------------
        // Check password confirmation.
        // ----------------------------------------------------

        if (password !== confirmPassword) {

            showMessage(
                "register-message",
                "The two passwords do not match."
            );

            return;
        }


        // ----------------------------------------------------
        // Check the minimum password length.
        // The HTML input also performs this check.
        // ----------------------------------------------------

        if (password.length < 10) {

            showMessage(
                "register-message",
                "Use a password containing at least 10 characters."
            );

            return;
        }


        // ----------------------------------------------------
        // Disable the button while registration is processing.
        // This reduces accidental repeated submissions.
        // ----------------------------------------------------

        submitButton.disabled = true;
        submitButton.textContent = "Creating account...";


        try {

            // ------------------------------------------------
            // Register the user with Supabase Auth.
            //
            // display_name is passed as user metadata.
            // Our database trigger uses this metadata when
            // creating the corresponding public profile.
            //
            // emailRedirectTo specifies where the player
            // should return after clicking the verification link.
            // ------------------------------------------------

            const { data, error } = await supabase.auth.signUp({

                email: email,

                password: password,

                options: {

                    data: {
                        display_name: displayName
                    },

                    emailRedirectTo:
                        new URL(
                            "dashboard.html",
                            window.location.href
                        ).href

                }

            });


            // Supabase reports authentication errors here.
            if (error) {
                throw error;
            }


            // ------------------------------------------------
            // Email confirmation is enabled in your project.
            //
            // Depending on the Supabase configuration and
            // existing session, signup may return a session
            // immediately or require email verification first.
            // ------------------------------------------------

            if (data.session) {

                showMessage(
                    "register-message",
                    "Your account has been created. Opening your dashboard...",
                    "success"
                );

                // Give the player a moment to read the message.
                setTimeout(openDashboard, 1000);

            } else {

                // Do not assume that the account is already
                // verified or that a session exists.
                showMessage(
                    "register-message",
                    "Registration received! Check your email and click " +
                    "the verification link. After verification, return " +
                    "to CIPHER and log in.",
                    "success"
                );

                // Clear the password fields after submission.
                document.getElementById("register-password").value = "";

                document.getElementById("confirm-password").value = "";

            }

        } catch (error) {

            showMessage(
                "register-message",
                getFriendlyError(error)
            );

        } finally {

            // Re-enable the button even when registration fails.
            submitButton.disabled = false;
            submitButton.textContent = "Create Account";

        }

    });

}


// ============================================================
// 4. EMAIL/PASSWORD LOGIN
// ============================================================

const loginForm = document.getElementById("login-form");


if (loginForm) {

    loginForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        clearMessage("login-message");

        const submitButton =
            document.getElementById("login-submit");

        const email =
            document.getElementById("login-email").value.trim();

        const password =
            document.getElementById("login-password").value;


        submitButton.disabled = true;
        submitButton.textContent = "Logging in...";


        try {

            // Authenticate the player using Supabase Auth.
            const { data, error } =
                await supabase.auth.signInWithPassword({

                    email: email,

                    password: password

                });


            if (error) {
                throw error;
            }


            // When email confirmation is enabled, Supabase
            // normally prevents an unverified account from
            // establishing a normal authenticated session.
            if (!data.session) {

                showMessage(
                    "login-message",
                    "No active session was created. Check your email " +
                    "verification status and try again."
                );

                return;
            }


            showMessage(
                "login-message",
                "Login successful. Opening your dashboard...",
                "success"
            );


            setTimeout(openDashboard, 700);


        } catch (error) {

            showMessage(
                "login-message",
                getFriendlyError(error)
            );

        } finally {

            submitButton.disabled = false;
            submitButton.textContent = "Log In";

        }

    });

}


// ============================================================
// 5. GOOGLE SIGN-IN
// ============================================================

const forgotPasswordForm =
    document.getElementById("forgot-password-form");

if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const submitButton =
            document.getElementById("forgot-password-submit");
        const email =
            document.getElementById("forgot-password-email").value.trim();

        clearMessage("forgot-password-message");
        submitButton.disabled = true;
        submitButton.textContent = "Sending...";

        try {
            const { error } =
                await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: new URL(
                        "update-password.html",
                        window.location.href
                    ).href
                });

            if (error) {
                throw error;
            }

            showMessage(
                "forgot-password-message",
                "If an account exists for that email, a reset link is on its way.",
                "success"
            );
            forgotPasswordForm.reset();
        } catch (error) {
            showMessage(
                "forgot-password-message",
                getFriendlyError(error)
            );
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Send reset link";
        }
    });
}

const updatePasswordForm =
    document.getElementById("update-password-form");

if (updatePasswordForm) {
    updatePasswordForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const submitButton =
            document.getElementById("update-password-submit");
        const password =
            document.getElementById("new-password").value;
        const confirmPassword =
            document.getElementById("confirm-new-password").value;

        clearMessage("update-password-message");

        if (password.length < 10) {
            showMessage(
                "update-password-message",
                "Use a password containing at least 10 characters."
            );
            return;
        }

        if (password !== confirmPassword) {
            showMessage(
                "update-password-message",
                "The two passwords do not match."
            );
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "Updating...";

        try {
            const { error } =
                await supabase.auth.updateUser({ password });

            if (error) {
                throw error;
            }

            showMessage(
                "update-password-message",
                "Password updated. Opening your dashboard...",
                "success"
            );
            updatePasswordForm.reset();
            setTimeout(openDashboard, 900);
        } catch (error) {
            showMessage(
                "update-password-message",
                getFriendlyError(error)
            );
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Update password";
        }
    });
}

if (updatePasswordForm) {
    const { data: authListener } =
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === "PASSWORD_RECOVERY" && session) {
                clearMessage("update-password-message");
            }
        });

    if (!authListener) {
        console.error("CIPHER password recovery listener was not created.");
    }
}

/**
 * Begin Google OAuth.
 *
 * Supabase redirects the player to Google, handles the
 * authentication callback, and returns them to CIPHER.
 */
async function signInWithGoogle(buttonId, messageId) {

    const button = document.getElementById(buttonId);

    if (!button) {
        return;
    }

    clearMessage(messageId);

    button.disabled = true;
    button.textContent = "Connecting to Google...";


    try {

        const redirectUrl =
            new URL(
                "dashboard.html",
                window.location.href
            ).href;


        const { error } = await supabase.auth.signInWithOAuth({

            provider: "google",

            options: {

                // Where the player should return after Google
                // and Supabase finish the authentication flow.
                redirectTo: redirectUrl

            }

        });


        if (error) {
            throw error;
        }

        // Supabase normally redirects the browser automatically.

    } catch (error) {

        showMessage(
            messageId,
            getFriendlyError(error)
        );

        button.disabled = false;

        button.textContent = "Continue with Google";

    }

}


// Register the Google button on the registration page.
document
    .getElementById("google-register")
    ?.addEventListener("click", () => {

        signInWithGoogle(
            "google-register",
            "register-message"
        );

    });


// Register the Google button on the login page.
document
    .getElementById("google-login")
    ?.addEventListener("click", () => {

        signInWithGoogle(
            "google-login",
            "login-message"
        );

    });