/* =========================================================
   CIPHER ADMIN DASHBOARD
   ---------------------------------------------------------
   Features:
   1. Verify administrator access.
   2. Load and display challenges.
   3. Create challenge drafts.
   4. Archive challenges.
   5. Permanently delete challenges after confirmation.
   6. Navigate between admin dashboard sections.
   7. Log out safely.

   Database:
   - challenges
   - admin_users
   - is_cipher_admin()

   IMPORTANT:
   Checkpoint creation and answer validation will be
   implemented separately.
   ========================================================= */

import { supabase } from "./supabase-client.js";


/* =========================================================
   ELEMENT REFERENCES
   ========================================================= */

const accessScreen = document.getElementById("access-screen");
const adminApp = document.getElementById("admin-app");
const accessMessage = document.getElementById("access-message");

const challengeForm = document.getElementById("challenge-form");
const challengeTableBody = document.getElementById("challenge-table-body");

/* =========================================================
   CHECKPOINT WORKSHOP ELEMENTS
   ========================================================= */

const checkpointForm = document.getElementById("checkpoint-form");

const checkpointChallengeSelect = document.getElementById(
    "checkpoint-challenge"
);

const checkpointTableBody = document.getElementById(
    "checkpoint-table-body"
);

const saveCheckpointButton = document.getElementById(
    "save-checkpoint-button"
);

const logoutButton = document.getElementById("logout-button");

const statTotal = document.getElementById("stat-total");
const statPublished = document.getElementById("stat-published");
const statActive = document.getElementById("stat-active");
const statDrafts = document.getElementById("stat-drafts");


/* =========================================================
   MESSAGE HELPER
   ========================================================= */

function showMessage(message, type = "info") {
    let messageBox = document.getElementById("admin-message");

    if (!messageBox) {
        messageBox = document.createElement("div");
        messageBox.id = "admin-message";
        messageBox.setAttribute("role", "status");
        messageBox.setAttribute("aria-live", "polite");

        if (adminApp) {
            adminApp.prepend(messageBox);
        } else {
            document.body.prepend(messageBox);
        }
    }

    messageBox.textContent = message;
    messageBox.dataset.type = type;
    messageBox.hidden = false;

    if (type === "error") {
        console.error("CIPHER Admin:", message);
    } else {
        console.log("CIPHER Admin:", message);
    }
}


/* =========================================================
   FORMAT DATE
   ========================================================= */

function formatDate(dateValue) {
    if (!dateValue) {
        return "Not scheduled";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "Invalid date";
    }

    return date.toLocaleString();
}


/* =========================================================
   VERIFY ADMINISTRATOR ACCESS
   ========================================================= */

async function verifyAdministrator() {
    try {
        const {
            data: sessionData,
            error: sessionError
        } = await supabase.auth.getSession();

        if (sessionError) {
            throw sessionError;
        }

        if (!sessionData?.session) {
            window.location.replace("login.html");
            return false;
        }

        const {
            data: userData,
            error: userError
        } = await supabase.auth.getUser();

        if (userError || !userData?.user) {
            window.location.replace("login.html");
            return false;
        }

        const {
            data: isAdmin,
            error: adminError
        } = await supabase.rpc("is_cipher_admin");

        if (adminError) {
            console.error("Administrator verification error:", adminError);

            showMessage(
                "We could not verify your administrator permissions. Check your Supabase function and permissions.",
                "error"
            );

            return false;
        }

        if (isAdmin !== true) {
            if (accessMessage) {
                accessMessage.textContent =
                    "Access denied. Administrator permissions are required. Returning to your dashboard...";
            }

            window.setTimeout(() => {
                window.location.replace("dashboard.html");
            }, 1800);

            return false;
        }

        if (accessScreen) {
            accessScreen.hidden = true;
        }

        if (adminApp) {
            adminApp.hidden = false;
        }

        console.log("CIPHER: Administrator access verified.");

        return true;

    } catch (error) {
        console.error("Administrator access check failed:", error);

        showMessage(
            "Administrator verification failed. Check your connection and try again.",
            "error"
        );

        return false;
    }
}


/* =========================================================
   LOAD CHALLENGES
   ========================================================= */

async function loadChallenges() {
    if (!challengeTableBody) {
        console.warn("Challenge table body was not found.");
        return;
    }

    challengeTableBody.innerHTML = `
        <tr>
            <td colspan="6">Loading challenges...</td>
        </tr>
    `;

    const {
        data: challenges,
        error
    } = await supabase
        .from("challenges")
        .select(`
            id,
            title,
            slug,
            challenge_type,
            status,
            max_points,
            starts_at,
            ends_at,
            created_at
        `)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Challenge loading failed:", error);

        challengeTableBody.innerHTML = `
            <tr>
                <td colspan="6">
                    Could not load challenges. Check the Console.
                </td>
            </tr>
        `;

        showMessage(
            "Unable to load challenges. Check the database permissions.",
            "error"
        );

        return;
    }

    updateStatistics(challenges || []);
    renderChallenges(challenges || []);
}

/* =========================================================
   CHECKPOINT WORKSHOP

   Responsibilities:
   1. Load available missions.
   2. Load saved checkpoints.
   3. Save checkpoint details.
   4. Save the accepted answer separately.
   5. Keep new checkpoints unpublished.
   ========================================================= */


/* ---------------------------------------------------------
   LOAD MISSIONS INTO THE CHECKPOINT SELECTOR
   --------------------------------------------------------- */

async function loadCheckpointMissions() {

    if (!checkpointChallengeSelect) {
        return;
    }

    checkpointChallengeSelect.innerHTML = `
        <option value="">
            Loading missions...
        </option>
    `;

    const {
        data: challenges,
        error
    } = await supabase
        .from("challenges")
        .select("id, title, status, max_points")
        .order("created_at", {
            ascending: false
        });

    if (error) {

        console.error(
            "Could not load missions for checkpoints:",
            error
        );

        checkpointChallengeSelect.innerHTML = `
            <option value="">
                Could not load missions
            </option>
        `;

        showMessage(
            "Could not load missions for the checkpoint workshop.",
            "error"
        );

        return;
    }

    if (!challenges || challenges.length === 0) {

        checkpointChallengeSelect.innerHTML = `
            <option value="">
                Create a mission first
            </option>
        `;

        return;
    }

    checkpointChallengeSelect.innerHTML = `
        <option value="">
            Select a mission
        </option>
    `;

    challenges.forEach(challenge => {

        const option = document.createElement("option");

        option.value = challenge.id;

        option.textContent =
            `${challenge.title} (${challenge.status})`;

        option.dataset.maxPoints = challenge.max_points;

        checkpointChallengeSelect.appendChild(option);

    });

}


/* ---------------------------------------------------------
   LOAD SAVED CHECKPOINTS
   --------------------------------------------------------- */

async function loadCheckpoints() {

    if (!checkpointTableBody) {
        return;
    }

    checkpointTableBody.innerHTML = `
        <tr>
            <td colspan="7">
                Loading checkpoints...
            </td>
        </tr>
    `;

    const {
        data: checkpoints,
        error
    } = await supabase
        .from("challenge_checkpoints")
        .select(`
            id,
            challenge_id,
            title,
            checkpoint_type,
            sequence_number,
            points,
            is_published,
            challenges (
                title
            )
        `)
        .order("sequence_number", {
            ascending: true
        });

    if (error) {

        console.error(
            "Checkpoint loading failed:",
            error
        );

        checkpointTableBody.innerHTML = `
            <tr>
                <td colspan="7">
                    Could not load checkpoints.
                    Check the browser console.
                </td>
            </tr>
        `;

        showMessage(
            "Could not load checkpoints: " + error.message,
            "error"
        );

        return;
    }

    if (!checkpoints || checkpoints.length === 0) {

        checkpointTableBody.innerHTML = `
            <tr>
                <td colspan="7">
                    No checkpoints created yet.
                </td>
            </tr>
        `;

        return;
    }

    checkpointTableBody.innerHTML = "";

    checkpoints.forEach(checkpoint => {

        const row = document.createElement("tr");

        const titleCell = document.createElement("td");
        titleCell.textContent = checkpoint.title;

        const missionCell = document.createElement("td");

        missionCell.textContent =
            checkpoint.challenges?.title || "Unknown mission";

        const typeCell = document.createElement("td");

        typeCell.textContent =
            checkpoint.checkpoint_type === "qr_checkpoint"
                ? "QR checkpoint"
                : "Online riddle";

        const orderCell = document.createElement("td");
        orderCell.textContent = checkpoint.sequence_number;

        const pointsCell = document.createElement("td");
        pointsCell.textContent = checkpoint.points;

        const statusCell = document.createElement("td");

        statusCell.textContent =
            checkpoint.is_published
                ? "Published"
                : "Unpublished";

        const qrCell = document.createElement("td");

        if (checkpoint.checkpoint_type === "qr_checkpoint") {
            const qrButton = document.createElement("button");

            qrButton.type = "button";
            qrButton.className = "button button-secondary";
            qrButton.textContent = "Generate QR";
            qrButton.disabled = !checkpoint.is_published;
            qrButton.title = checkpoint.is_published
                ? "Generate a QR code for this checkpoint"
                : "Publish this checkpoint before generating its QR code";

            qrButton.addEventListener("click", () => {
                showCheckpointQr(checkpoint);
            });

            qrCell.appendChild(qrButton);
        } else {
            qrCell.textContent = "Not applicable";
        }

        row.append(
            titleCell,
            missionCell,
            typeCell,
            orderCell,
            pointsCell,
            statusCell,
            qrCell
        );

        checkpointTableBody.appendChild(row);

    });

}

function showCheckpointQr(checkpoint) {
    if (typeof QRCode === "undefined") {
        showMessage(
            "The QR generator could not be loaded. Check your connection and try again.",
            "error"
        );
        return;
    }

    const checkpointUrl = new URL(
        `challenge.html?checkpoint=${encodeURIComponent(checkpoint.id)}`,
        window.location.href
    ).href;

    const overlay = document.createElement("div");
    overlay.className = "qr-overlay";
    overlay.innerHTML = `
        <div class="qr-dialog" role="dialog" aria-modal="true"
            aria-labelledby="qr-dialog-title">
            <button type="button" class="qr-close" aria-label="Close QR code">
                &times;
            </button>
            <h2 id="qr-dialog-title"></h2>
            <div class="qr-code" id="qr-code"></div>
            <p class="qr-url"></p>
            <button type="button" class="button button-primary qr-print">
                Print QR code
            </button>
        </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelector("#qr-dialog-title").textContent =
        checkpoint.title;
    overlay.querySelector(".qr-url").textContent = checkpointUrl;

    new QRCode(overlay.querySelector("#qr-code"), {
        text: checkpointUrl,
        width: 256,
        height: 256,
        colorDark: "#0b0e0d",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    const close = () => overlay.remove();

    overlay.querySelector(".qr-close").addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            close();
        }
    });
    overlay.querySelector(".qr-print").addEventListener("click", () => {
        window.print();
    });
}


/* ---------------------------------------------------------
   SAVE A NEW CHECKPOINT
   --------------------------------------------------------- */

/* =========================================================
   SAVE CHECKPOINT
   Supports multiple accepted answers.

   Features:
   1. One accepted answer per line.
   2. Case-insensitive duplicate removal.
   3. Ignores surrounding spaces.
   4. Validates checkpoint details.
   5. Checks the mission's maximum points.
   6. Saves the checkpoint and its answers separately.
   7. Attempts cleanup if saving the answers fails.
   ========================================================= */

async function saveCheckpoint(event) {

    event.preventDefault();

    if (!checkpointForm) {
        return;
    }

    if (saveCheckpointButton) {
        saveCheckpointButton.disabled = true;
        saveCheckpointButton.textContent = "Saving checkpoint...";
    }

    let createdCheckpointId = null;

    try {

        /* =================================================
           1. READ THE FORM
           ================================================= */

        const formData = new FormData(checkpointForm);

        const challengeId = String(
            formData.get("challenge_id") || ""
        ).trim();

        const title = String(
            formData.get("title") || ""
        ).trim();

        const checkpointType = String(
            formData.get("checkpoint_type") || ""
        ).trim();

        const sequenceNumber = Number(
            formData.get("sequence_number")
        );

        const points = Number(
            formData.get("points")
        );

        const clueText = String(
            formData.get("clue_text") || ""
        ).trim();

        /*
         * Read the textarea.
         *
         * Each line represents one accepted answer.
         */
        const rawAnswers = String(
            formData.get("accepted_answers") || ""
        );

        /* =================================================
           2. PROCESS THE ACCEPTED ANSWERS
           ================================================= */

        /*
         * Split the text into separate lines.
         * Trim surrounding spaces.
         * Remove empty lines.
         */
        const cleanedAnswers = rawAnswers
            .split(/\r?\n/)
            .map(answer => answer.trim())
            .filter(answer => answer.length > 0);

        /*
         * Remove duplicates without considering case.
         *
         * For example:
         * echo
         * Echo
         * ECHO
         *
         * These count as one accepted answer.
         */
        const uniqueAnswers = [];
        const seenAnswers = new Set();

        for (const answer of cleanedAnswers) {

            const normalizedAnswer = answer.toLocaleLowerCase();

            if (!seenAnswers.has(normalizedAnswer)) {

                seenAnswers.add(normalizedAnswer);

                uniqueAnswers.push(answer);

            }

        }

        /* =================================================
           3. VALIDATE THE INPUT
           ================================================= */

        if (
            !challengeId ||
            !title ||
            !clueText
        ) {

            throw new Error(
                "Complete every required field."
            );

        }

        if (uniqueAnswers.length === 0) {

            throw new Error(
                "Enter at least one accepted answer."
            );

        }

        if (
            !["online_riddle", "qr_checkpoint"].includes(
                checkpointType
            )
        ) {

            throw new Error(
                "Choose a valid checkpoint type."
            );

        }

        if (
            !Number.isInteger(sequenceNumber) ||
            sequenceNumber < 1
        ) {

            throw new Error(
                "Checkpoint order must be a whole number of at least 1."
            );

        }

        if (
            !Number.isInteger(points) ||
            points < 1
        ) {

            throw new Error(
                "Points must be a positive whole number."
            );

        }

        /* =================================================
           4. VERIFY THE SELECTED MISSION
           ================================================= */

        const {
            data: challenge,
            error: challengeError
        } = await supabase
            .from("challenges")
            .select("id, title, status, max_points")
            .eq("id", challengeId)
            .single();

        if (challengeError || !challenge) {

            throw new Error(
                "The selected mission could not be verified."
            );

        }

        /*
         * New checkpoints can only be added to missions
         * that have not started.
         */
        if (
            !["draft", "published"].includes(challenge.status)
        ) {

            throw new Error(
                "New checkpoints can only be added to draft or published missions."
            );

        }

        /* =================================================
           5. CHECK THE MISSION'S TOTAL POINTS
           ================================================= */

        const {
            data: existingCheckpoints,
            error: pointsError
        } = await supabase
            .from("challenge_checkpoints")
            .select("points")
            .eq("challenge_id", challengeId);

        if (pointsError) {

            throw new Error(
                "Could not verify the mission's existing checkpoint points."
            );

        }

        const existingPoints = (
            existingCheckpoints || []
        ).reduce(
            (total, checkpoint) => {
                return total + Number(checkpoint.points);
            },
            0
        );

        if (
            existingPoints + points >
            Number(challenge.max_points)
        ) {

            throw new Error(
                `This checkpoint would exceed the mission's maximum of ${challenge.max_points} points. Existing checkpoints total ${existingPoints} points.`
            );

        }

        /* =================================================
           6. CREATE THE CHECKPOINT
           ================================================= */

        const {
            data: newCheckpoint,
            error: insertError
        } = await supabase
            .from("challenge_checkpoints")
            .insert({

                challenge_id: challengeId,

                title: title,

                clue_text: clueText,

                checkpoint_type: checkpointType,

                sequence_number: sequenceNumber,

                points: points,

                is_published: false

            })
            .select("id")
            .single();

        if (insertError) {

            if (insertError.code === "23505") {

                throw new Error(
                    "That checkpoint order is already used in this mission. Choose another number."
                );

            }

            throw new Error(
                insertError.message ||
                "The checkpoint could not be saved."
            );

        }

        createdCheckpointId = newCheckpoint.id;

        /* =================================================
           7. SAVE ALL ACCEPTED ANSWERS
           ================================================= */

        /*
         * Supabase receives an array of answer records.
         *
         * Example:
         * [
         *   {
         *     checkpoint_id: "...",
         *     accepted_answer: "echo"
         *   },
         *   {
         *     checkpoint_id: "...",
         *     accepted_answer: "an echo"
         *   }
         * ]
         */

        const answerRecords = uniqueAnswers.map(answer => ({

            checkpoint_id: createdCheckpointId,

            accepted_answer: answer

        }));

        const {
            error: answerError
        } = await supabase
            .from("checkpoint_answers")
            .insert(answerRecords);

        if (answerError) {

            console.error(
                "Accepted answers could not be saved:",
                answerError
            );

            /*
             * Delete the incomplete checkpoint.
             *
             * Its answer records reference its ID, so the
             * foreign key may prevent deletion if any answer
             * records were already inserted. The catch block
             * below reports cleanup failure for investigation.
             */
            const {
                error: cleanupError
            } = await supabase
                .from("challenge_checkpoints")
                .delete()
                .eq("id", createdCheckpointId);

            if (cleanupError) {

                console.error(
                    "Checkpoint cleanup failed:",
                    cleanupError
                );

                throw new Error(
                    "Saving the answers failed, and automatic cleanup also failed. Check Supabase before trying again."
                );

            }

            createdCheckpointId = null;

            throw new Error(
                "The checkpoint was not saved because its accepted answers could not be stored. Details: " +
                answerError.message
            );

        }

        /* =================================================
           8. SUCCESS
           ================================================= */

        checkpointForm.reset();

        showMessage(
            `Checkpoint "${title}" saved with ${uniqueAnswers.length} accepted answer(s) under "${challenge.title}". It remains unpublished.`,
            "success"
        );

        await loadCheckpoints();

        await loadCheckpointMissions();

    } catch (error) {

        console.error(
            "Checkpoint save failed:",
            error
        );

        showMessage(
            error.message ||
            "The checkpoint could not be saved.",
            "error"
        );

    } finally {

        if (saveCheckpointButton) {

            saveCheckpointButton.disabled = false;

            saveCheckpointButton.textContent = "Save checkpoint";

        }

    }

}


/* =========================================================
   UPDATE DASHBOARD STATISTICS
   ========================================================= */

function updateStatistics(challenges) {
    const total = challenges.length;

    const published = challenges.filter(
        challenge => challenge.status === "published"
    ).length;

    const active = challenges.filter(
        challenge => challenge.status === "active"
    ).length;

    const drafts = challenges.filter(
        challenge => challenge.status === "draft"
    ).length;

    if (statTotal) statTotal.textContent = total;
    if (statPublished) statPublished.textContent = published;
    if (statActive) statActive.textContent = active;
    if (statDrafts) statDrafts.textContent = drafts;
}
/* =========================================================
   CHANGE CHALLENGE STATUS
   Supports publishing, activation, completion and restoration.
   ========================================================= */

async function changeChallengeStatus(challenge, newStatus) {
    const validTransitions = {
        draft: ["published"],
        published: ["active"],
        active: ["completed"],
        completed: [],
        archived: ["draft"]
    };

    if (!validTransitions[challenge.status]?.includes(newStatus)) {
        showMessage(
            `Cannot change a challenge from ${challenge.status} to ${newStatus}.`,
            "error"
        );
        return;
    }

    const confirmed = window.confirm(
        `Change "${challenge.title}" from ${challenge.status} to ${newStatus}?`
    );

    if (!confirmed) return;

    const { error } = await supabase
        .from("challenges")
        .update({
            status: newStatus,
            updated_at: new Date().toISOString()
        })
        .eq("id", challenge.id);

    if (error) {
        console.error("Status update failed:", error);

        showMessage(
            `Could not update challenge status: ${error.message}`,
            "error"
        );
        return;
    }

    showMessage(
        `"${challenge.title}" is now ${newStatus}.`,
        "success"
    );

    await loadChallenges();
}

/* =========================================================
   RENDER CHALLENGE TABLE
   ========================================================= */

/* =========================================================
   RENDER CHALLENGE TABLE
   Matches the five columns in admin.html.
   ========================================================= */

/* =========================================================
   RENDER CHALLENGE TABLE
   Adds status-aware challenge management controls.
   ========================================================= */

function renderChallenges(challenges) {
    if (!challengeTableBody) return;

    if (!challenges.length) {
        challengeTableBody.innerHTML = `
            <tr>
                <td colspan="5">
                    No challenges yet. Create your first challenge below.
                </td>
            </tr>
        `;
        return;
    }

    challengeTableBody.innerHTML = "";

    challenges.forEach(challenge => {
        const row = document.createElement("tr");

        const titleCell = document.createElement("td");
        titleCell.textContent = challenge.title;

        const typeCell = document.createElement("td");
        typeCell.textContent = challenge.challenge_type;

        const statusCell = document.createElement("td");
        statusCell.textContent = challenge.status;

        const pointsCell = document.createElement("td");
        pointsCell.textContent = challenge.max_points;

        const actionsCell = document.createElement("td");
        actionsCell.className = "challenge-actions";

        // Helper for creating action buttons safely.
        function addAction(label, handler, className = "") {
            const button = document.createElement("button");

            button.type = "button";
            button.textContent = label;
            button.className = className;

            button.addEventListener("click", handler);
            actionsCell.appendChild(button);
        }

        // Editing will open the existing creation form prefilled.
        addAction("Edit", () => editChallenge(challenge));

        switch (challenge.status) {
            case "draft":
                addAction("Publish", () => changeChallengeStatus(
                    challenge, "published"
                ));
                addAction("Delete", () => permanentlyDeleteChallenge(challenge));
                break;

            case "published":
                addAction("Activate", () => changeChallengeStatus(
                    challenge, "active"
                ));
                addAction("Archive", () => archiveChallenge(challenge));
                break;

            case "active":
                addAction("Complete", () => changeChallengeStatus(
                    challenge, "completed"
                ));
                addAction("Archive", () => archiveChallenge(challenge));
                break;

            case "completed":
                addAction("Archive", () => archiveChallenge(challenge));
                break;

            case "archived":
                addAction("Restore as draft", () => changeChallengeStatus(
                    challenge, "draft"
                ));
                addAction("Delete", () => permanentlyDeleteChallenge(challenge));
                break;

            default:
                addAction("Archive", () => archiveChallenge(challenge));
        }

        row.append(
            titleCell,
            typeCell,
            statusCell,
            pointsCell,
            actionsCell
        );

        challengeTableBody.appendChild(row);
    });
}


/* =========================================================
   CREATE A CHALLENGE DRAFT
   ========================================================= */

async function createChallenge(event) {
    event.preventDefault();

    if (!challengeForm) {
        return;
    }

    const submitButton = challengeForm.querySelector(
        'button[type="submit"]'
    );

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Saving draft...";
    }

    try {
        const formData = new FormData(challengeForm);

        const title = String(formData.get("title") || "").trim();

        const description = String(
            formData.get("description") || ""
        ).trim();

        const challengeType = String(
            formData.get("challenge_type") || ""
        ).trim();

        const mode = String(
            formData.get("allowed_modes") || ""
        ).trim();

        const startsAtValue = String(
            formData.get("starts_at") || ""
        ).trim();

        const endsAtValue = String(
            formData.get("ends_at") || ""
        ).trim();

        const maxPoints = Number(
            formData.get("max_points")
        );

        /*
         * Basic validation
         */

        if (!title) {
            throw new Error("Enter a challenge title.");
        }

        if (!description) {
            throw new Error("Enter a challenge description.");
        }

        const allowedTypes = [
            "daily",
            "weekly",
            "major",
            "seasonal"
        ];

        if (!allowedTypes.includes(challengeType)) {
            throw new Error("Select a valid challenge category.");
        }

        if (!["solo", "team", "both"].includes(mode)) {
            throw new Error("Select a valid play mode.");
        }

        if (
            !Number.isInteger(maxPoints) ||
            maxPoints < 1
        ) {
            throw new Error(
                "Maximum points must be a positive whole number."
            );
        }

        /*
         * Validate the schedule.
         */

        const startsAt = startsAtValue
            ? new Date(startsAtValue)
            : null;

        const endsAt = endsAtValue
            ? new Date(endsAtValue)
            : null;

        if (
            startsAt &&
            Number.isNaN(startsAt.getTime())
        ) {
            throw new Error("Enter a valid start date.");
        }

        if (
            endsAt &&
            Number.isNaN(endsAt.getTime())
        ) {
            throw new Error("Enter a valid end date.");
        }

        if (
            startsAt &&
            endsAt &&
            endsAt <= startsAt
        ) {
            throw new Error(
                "The end date must be later than the start date."
            );
        }

        /*
         * Create a URL-friendly slug.
         */

        const slug = title
            .toLowerCase()
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");

        if (!slug) {
            throw new Error(
                "Choose a title that can produce a valid URL slug."
            );
        }

        /*
         * Confirm the current user.
         */

        const {
            data: userData,
            error: userError
        } = await supabase.auth.getUser();

        if (userError || !userData?.user) {
            throw new Error(
                "Your login session could not be verified."
            );
        }

        /*
         * Convert the selected play mode to a PostgreSQL array.
         */

        let allowedModes;

        if (mode === "both") {
            allowedModes = ["solo", "team"];
        } else {
            allowedModes = [mode];
        }

        /*
         * Save the challenge as a draft.
         *
         * Do not publish automatically. Checkpoints and
         * answers must be prepared before players can play.
         */

        const challengeData = {
            title,
            slug,
            description,
            challenge_type: challengeType,
            status: "draft",
            allowed_modes: allowedModes,
            starts_at: startsAt ? startsAt.toISOString() : null,
            ends_at: endsAt ? endsAt.toISOString() : null,
            max_points: maxPoints,
            created_by: userData.user.id
        };

let savedChallenge;
let saveError;

if (challengeBeingEdited) {
    const result = await supabase
        .from("challenges")
        .update({
            title: challengeData.title,
            description: challengeData.description,
            challenge_type: challengeData.challenge_type,
            allowed_modes: challengeData.allowed_modes,
            starts_at: challengeData.starts_at,
            ends_at: challengeData.ends_at,
            max_points: challengeData.max_points,
            updated_at: new Date().toISOString()
        })
        .eq("id", challengeBeingEdited.id)
        .select()
        .single();

    savedChallenge = result.data;
    saveError = result.error;
} else {
    const result = await supabase
        .from("challenges")
        .insert(challengeData)
        .select()
        .single();

    savedChallenge = result.data;
    saveError = result.error;
}

        if (saveError) {
            console.error("Challenge save error:", saveError);

            if (saveError.code === "23505") {
                throw new Error(
                    "A challenge with this URL slug already exists. Try a different title."
                );
            }

            throw new Error(
                saveError.message ||
                "The challenge could not be saved."
            );
        }

        challengeForm.reset();
challengeBeingEdited = null;

const submitButton = challengeForm.querySelector(
    'button[type="submit"]'
);

if (submitButton) {
    submitButton.textContent = "Create Challenge";
}

        showMessage(
            `Draft "${savedChallenge.title}" created successfully.`,
            "success"
        );

        await loadChallenges();

        /*
         * Future checkpoint creation will use this saved
         * challenge ID.
         */

        console.log(
            "New challenge created:",
            savedChallenge
        );

    } catch (error) {
        console.error("Create challenge failed:", error);

        showMessage(
            error.message || "Could not create the challenge.",
            "error"
        );

    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Create Challenge";
        }
    }
}
/* =========================================================
   EDIT AN EXISTING CHALLENGE
   Prefills the existing form for editing.
   ========================================================= */

let challengeBeingEdited = null;

function editChallenge(challenge) {
    if (!challengeForm) {
        showMessage("Challenge form could not be found.", "error");
        return;
    }

    if (challenge.status === "archived") {
        showMessage(
            "Restore this challenge before editing it.",
            "error"
        );
        return;
    }

    challengeBeingEdited = challenge;

    challengeForm.elements.namedItem("title").value =
        challenge.title || "";

    challengeForm.elements.namedItem("description").value =
        challenge.description || "";

    challengeForm.elements.namedItem("challenge_type").value =
        challenge.challenge_type || "major";

    const modes = challenge.allowed_modes || [];

    challengeForm.elements.namedItem("allowed_modes").value =
        modes.length === 2 ? "both" : (modes[0] || "solo");

    challengeForm.elements.namedItem("starts_at").value =
        challenge.starts_at
            ? new Date(challenge.starts_at).toISOString().slice(0, 16)
            : "";

    challengeForm.elements.namedItem("ends_at").value =
        challenge.ends_at
            ? new Date(challenge.ends_at).toISOString().slice(0, 16)
            : "";

    challengeForm.elements.namedItem("max_points").value =
        challenge.max_points ?? 100;

    const submitButton = challengeForm.querySelector(
        'button[type="submit"]'
    );

    if (submitButton) {
        submitButton.textContent = "Save Changes";
    }

    const createSection = document.getElementById("create-challenge");

    if (createSection) {
        createSection.hidden = false;

        document.querySelectorAll(".admin-section").forEach(section => {
            section.hidden = section !== createSection;
        });
    }

    showMessage(
        `Editing "${challenge.title}". Save your changes when ready.`,
        "info"
    );
}

/* =========================================================
   ARCHIVE A CHALLENGE
   ========================================================= */

async function archiveChallenge(challenge) {
    const confirmed = window.confirm(
        `Archive "${challenge.title}"?\n\n` +
        "This keeps the challenge in the database but marks it as archived."
    );

    if (!confirmed) {
        return;
    }

    const {
        error
    } = await supabase
        .from("challenges")
        .update({
            status: "archived",
            updated_at: new Date().toISOString()
        })
        .eq("id", challenge.id);

    if (error) {
        console.error("Archive failed:", error);

        showMessage(
            "Could not archive this challenge: " + error.message,
            "error"
        );

        return;
    }

    showMessage(
        `"${challenge.title}" has been archived.`,
        "success"
    );

    await loadChallenges();
}


/* =========================================================
   PERMANENTLY DELETE A CHALLENGE
   ========================================================= */

async function permanentlyDeleteChallenge(challenge) {
    const confirmed = window.confirm(
        `PERMANENTLY DELETE "${challenge.title}"?\n\n` +
        "This action cannot be undone.\n\n" +
        "If checkpoints or submissions reference this challenge, " +
        "the database may reject the deletion.\n\n" +
        "Continue?"
    );

    if (!confirmed) {
        return;
    }

    const {
        error
    } = await supabase
        .from("challenges")
        .delete()
        .eq("id", challenge.id);

    if (error) {
        console.error("Permanent deletion failed:", error);

        showMessage(
            "The challenge could not be deleted. It may have related checkpoints or submissions. Archive it instead. Details: " +
            error.message,
            "error"
        );

        return;
    }

    showMessage(
        `"${challenge.title}" was permanently deleted.`,
        "success"
    );

    await loadChallenges();
}


/* =========================================================
   ADMIN NAVIGATION
   ========================================================= */

/* =========================================================
   ADMIN NAVIGATION
   Works with the actual section IDs in admin.html.
   ========================================================= */

function setupNavigation() {
    const navigationLinks = document.querySelectorAll(
        ".sidebar-nav [data-section]"
    );

    const sections = document.querySelectorAll(
        ".admin-section"
    );

    function openSection(sectionName) {
        const targetSection = document.getElementById(sectionName);

        if (!targetSection || !targetSection.classList.contains("admin-section")) {
            console.warn("Admin section not found:", sectionName);
            return;
        }

        sections.forEach(section => {
            section.hidden = section !== targetSection;
        });

        navigationLinks.forEach(link => {
            link.classList.toggle(
                "active",
                link.dataset.section === sectionName
            );
        });

        history.replaceState(null, "", `#${sectionName}`);
    }

    navigationLinks.forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();
            openSection(link.dataset.section);
        });
    });

    /* Make the + New challenge button open the form. */
    document.querySelectorAll("[data-open-section]").forEach(button => {
        button.addEventListener("click", () => {
            openSection(button.dataset.openSection);
        });
    });

    /* Restore a section selected by its URL hash, if valid. */
    const requestedSection = window.location.hash.slice(1);

    if (
        requestedSection &&
        document.getElementById(requestedSection)?.classList.contains("admin-section")
    ) {
        openSection(requestedSection);
    } else {
        openSection("overview");
    }
}


/* =========================================================
   ADMIN LOGOUT
   ========================================================= */

async function handleAdminLogout() {
    if (logoutButton) {
        logoutButton.disabled = true;
    }

    const {
        error
    } = await supabase.auth.signOut();

    if (error) {
        console.error("Admin logout failed:", error);

        showMessage(
            "Logout failed. Please try again.",
            "error"
        );

        if (logoutButton) {
            logoutButton.disabled = false;
        }

        return;
    }

    window.location.replace("login.html");
}


/* =========================================================
   INITIALIZE ADMIN DASHBOARD
   ========================================================= */

async function initializeAdminDashboard() {
    /*
     * Do not load private dashboard data until the user's
     * administrator privileges have been verified.
     */

    const isAdmin = await verifyAdministrator();

    if (!isAdmin) {
        return;
    }

    setupNavigation();

    if (challengeForm) {
        challengeForm.addEventListener(
            "submit",
            createChallenge
        );
    } else {
        console.warn(
            "Challenge form was not found. Check admin.html."
        );
    }

    /* =========================================================
   CONNECT THE CHECKPOINT WORKSHOP
   ========================================================= */

if (checkpointForm) {

    checkpointForm.addEventListener(
        "submit",
        saveCheckpoint
    );

} else {

    console.warn(
        "Checkpoint form was not found. Check admin.html."
    );

}

/* Load the missions available for checkpoint creation. */
await loadCheckpointMissions();

/* Load the existing checkpoint library. */
await loadCheckpoints();

    if (logoutButton) {
    logoutButton.addEventListener(
        "click",
        handleAdminLogout
    );
    }

/* Refresh the challenge list when requested. */
const refreshButton = document.getElementById("refresh-challenges");

    if (refreshButton) {
    refreshButton.addEventListener("click", loadChallenges);
    }

await loadChallenges();
}


/* =========================================================
   START
   ========================================================= */

initializeAdminDashboard();