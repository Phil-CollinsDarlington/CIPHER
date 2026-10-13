/* ==========================================================
   CIPHER ADMIN DASHBOARD
   File: assets/js/admin.js

   CURRENT FEATURES:
   - Check the user's Supabase session
   - Verify administrator membership
   - Display the administrator identity
   - Navigate between dashboard sections
   - Handle logout
   - Prevent the preparation form from modifying live data

   IMPORTANT:
   Database permissions must also enforce administrator access.
   Hiding the interface is not a replacement for RLS.
========================================================== */

import { supabase } from "./supabase-client.js";


// ==========================================================
// 1. DOM HELPERS
// ==========================================================

function getElement(id) {
    return document.getElementById(id);
}


function showMessage(message, type = "info") {
    const messageElement = getElement("admin-message");

    if (!messageElement) {
        return;
    }

    messageElement.textContent = message;

    messageElement.className =
        `admin-message visible ${type}`;
}


function setAccessMessage(message) {
    const element = getElement("access-message");

    if (element) {
        element.textContent = message;
    }
}


// ==========================================================
// 2. SHOW THE ADMIN APPLICATION
// ==========================================================

function showAdminApplication(user) {
    const app = getElement("admin-app");
    const accessScreen = getElement("access-screen");

    const displayName =
        user.user_metadata?.display_name ||
        user.user_metadata?.full_name ||
        user.email ||
        "Administrator";

    if (app) {
        app.hidden = false;
    }

    if (accessScreen) {
        accessScreen.hidden = true;
    }

    const nameElement = getElement("admin-name");
    const avatarElement = getElement("admin-avatar");

    if (nameElement) {
        nameElement.textContent = displayName;
    }

    if (avatarElement) {
        avatarElement.textContent =
            displayName.trim().charAt(0).toUpperCase() || "A";
    }
}


// ==========================================================
// 3. NAVIGATION
// ==========================================================

function openSection(sectionId) {
    const target = getElement(sectionId);

    if (!target) {
        return;
    }

    // Hide all sections except the selected section.
    document
        .querySelectorAll(".admin-section")
        .forEach((section) => {
            section.hidden = section.id !== sectionId;
        });

    // Highlight the matching sidebar link.
    document
        .querySelectorAll(".nav-link")
        .forEach((link) => {
            link.classList.toggle(
                "active",
                link.dataset.section === sectionId
            );
        });

    // Update the page fragment without reloading the page.
    history.replaceState(null, "", `#${sectionId}`);

    // Start at the top of the main content.
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


function initializeNavigation() {
    // Handle clicks on the sidebar.
    document
        .querySelectorAll("[data-section]")
        .forEach((link) => {

            link.addEventListener("click", (event) => {
                event.preventDefault();

                openSection(link.dataset.section);
            });

        });


    // Handle buttons that open a particular section.
    document
        .querySelectorAll("[data-open-section]")
        .forEach((button) => {

            button.addEventListener("click", () => {
                openSection(button.dataset.openSection);
            });

        });


    // Restore the selected section if the URL contains a
    // valid section fragment.
    const requestedSection =
        window.location.hash.replace("#", "");

    const allowedSections = [
        "overview",
        "challenges",
        "create-challenge",
        "checkpoints",
        "submissions"
    ];

    if (allowedSections.includes(requestedSection)) {
        openSection(requestedSection);
    } else {
        openSection("overview");
    }
}


// ==========================================================
// 4. ADMINISTRATOR ACCESS CHECK
// ==========================================================

async function verifyAdministrator() {
    try {

        setAccessMessage(
            "Checking your administrator session..."
        );


        // STEP 1:
        // Confirm that a login session exists.

        const {
            data: { session },
            error: sessionError
        } = await supabase.auth.getSession();

        if (sessionError) {
            throw sessionError;
        }

        if (!session) {
            window.location.replace("login.html");
            return;
        }


        // STEP 2:
        // Retrieve the authenticated user from Supabase.

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


        // STEP 3:
        // Ask the database whether this user is an administrator.
        //
        // The user ID is obtained from the authenticated account.
        // We do not accept an administrator ID from the URL.

        setAccessMessage(
            "Verifying administrator privileges..."
        );

        const {
            data: isAdmin,
            error: adminError
        } = await supabase.rpc("is_cipher_admin");

        if (adminError) {
            throw adminError;
        }


        // STEP 4:
        // Deny access if the database says this user is not
        // an administrator.

        if (isAdmin !== true) {

            setAccessMessage(
                "Access denied. This account is not authorised " +
                "to access the administrator dashboard."
            );

            // Give the user time to read the message.
            window.setTimeout(() => {
                window.location.replace("dashboard.html");
            }, 2500);

            return;
        }


        // STEP 5:
        // Only show the admin interface after verification.

        showAdminApplication(user);

        initializeNavigation();

        initializePreparationForm();

        initializeLogout();

        showMessage(
            "Administrator access verified. " +
            "The dashboard is in preparation mode.",
            "success"
        );


    } catch (error) {

        console.error(
            "CIPHER administrator verification error:",
            error
        );

        setAccessMessage(
            "We could not verify administrator access. " +
            "Please check your connection and try again. " +
            "If the problem continues, inspect the browser console."
        );

    }
}


// ==========================================================
// 5. PREPARATION FORM
// ==========================================================

function initializePreparationForm() {
    const form = getElement("challenge-form");

    if (!form) {
        return;
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        // IMPORTANT:
        // The form is intentionally not connected to Supabase.
        // This prevents it from creating live challenge records
        // before database permissions have been reviewed.

        showMessage(
            "Preparation form received. No challenge was saved. " +
            "We'll connect database saving after the permissions " +
            "review is complete.",
            "info"
        );
    });
}


// ==========================================================
// 6. LOGOUT
// ==========================================================

function initializeLogout() {
    const logoutButton = getElement("logout-button");

    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener("click", async () => {

        logoutButton.disabled = true;
        logoutButton.textContent = "Logging out...";

        try {

            const { error } = await supabase.auth.signOut();

            if (error) {
                throw error;
            }

            window.location.replace("login.html");

        } catch (error) {

            console.error(
                "CIPHER administrator logout error:",
                error
            );

            showMessage(
                "Logout failed. Please try again.",
                "error"
            );

            logoutButton.disabled = false;
            logoutButton.textContent = "↗ Log out";
        }

    });
}


// ==========================================================
// 7. START THE APPLICATION
// ==========================================================

verifyAdministrator();