import { supabase } from "./supabase-client.js";

const authDestinations =
    document.querySelectorAll("[data-auth-destination]");

async function updateAuthDestinations() {
    if (!authDestinations.length) {
        return;
    }

    try {
        const {
            data: { session },
            error
        } = await supabase.auth.getSession();

        if (error) {
            throw error;
        }

        authDestinations.forEach((link) => {
            link.href = session
                ? link.dataset.authDestination
                : "login.html";

            if (link.hasAttribute("data-hide-when-authenticated")) {
                link.hidden = Boolean(session);
            }

            const label = link.querySelector("span");
            const labelText = session
                ? link.dataset.authLabel
                : link.dataset.defaultAuthLabel;

            if (label && labelText) {
                label.textContent = labelText;
            }
        });
    } catch (error) {
        console.error("CIPHER session check failed:", error);
    }
}

updateAuthDestinations();
