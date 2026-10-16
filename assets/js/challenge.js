import { supabase } from "./supabase-client.js";

const titleElement = document.getElementById("challenge-title");
const messageElement = document.getElementById("challenge-message");
const clueElement = document.getElementById("challenge-clue");
const checkpointId = new URLSearchParams(window.location.search)
    .get("checkpoint");

function showError(message) {
    messageElement.textContent = message;
    messageElement.classList.add("challenge-error");
}

async function loadCheckpoint() {
    if (!checkpointId) {
        showError("This checkpoint link is missing its checkpoint ID.");
        return;
    }

    const {
        data: { session },
        error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError) {
        console.error("Checkpoint session check failed:", sessionError);
        showError("We could not verify your session. Please try again.");
        return;
    }

    if (!session) {
        const returnUrl = encodeURIComponent(window.location.href);
        window.location.replace(`login.html?redirect=${returnUrl}`);
        return;
    }

    const { data: checkpoint, error } = await supabase
        .from("challenge_checkpoints")
        .select(`
            title,
            clue_text,
            sequence_number,
            points,
            is_published,
            challenges (
                title,
                status
            )
        `)
        .eq("id", checkpointId)
        .eq("is_published", true)
        .maybeSingle();

    if (error) {
        console.error("Checkpoint loading failed:", error);
        showError("This checkpoint could not be loaded. Please try again.");
        return;
    }

    if (!checkpoint || !checkpoint.challenges ||
        !["published", "active"].includes(checkpoint.challenges.status)) {
        showError("This checkpoint is not currently available.");
        return;
    }

    document.title = `${checkpoint.title} | CIPHER`;
    titleElement.textContent = checkpoint.title;
    messageElement.textContent =
        `${checkpoint.challenges.title} · Checkpoint ${checkpoint.sequence_number} · ${checkpoint.points} points`;
    clueElement.textContent = checkpoint.clue_text;
    clueElement.hidden = false;
}

loadCheckpoint().catch((error) => {
    console.error("Unexpected checkpoint error:", error);
    showError("An unexpected error occurred while loading this checkpoint.");
});