import { supabase } from "./supabase-client.js";

const messageElement = document.getElementById("team-message");
const teamsList = document.getElementById("teams-list");
const createForm = document.getElementById("create-team-form");
const joinForm = document.getElementById("join-team-form");
let currentUser = null;

function showMessage(message, type = "success") {
    messageElement.textContent = message;
    messageElement.className = `dashboard-message visible ${type}`;
}

function getTeamErrorMessage(error, fallback) {
    const message = String(error?.message || "").trim();

    if (message.includes("duplicate key")) {
        return "You are already a member of this team.";
    }

    if (message.includes("not authenticated") ||
        message.includes("must be signed in")) {
        return "Your session has expired. Please log in again.";
    }

    return message || fallback;
}

async function requireUser() {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
        window.location.replace("login.html");
        return false;
    }

    currentUser = data.user;
    return true;
}

async function loadTeams() {
    const { data, error } = await supabase
        .from("team_members")
        .select("role, teams (id, name, join_code)")
        .eq("user_id", currentUser.id);

    if (error) {
        console.error("Team loading failed:", error);
        teamsList.textContent =
            "Team storage is not configured yet. Create the teams and team_members tables in Supabase first.";
        showMessage("Teams could not be loaded.", "error");
        return;
    }

    if (!data?.length) {
        teamsList.textContent = "You are not a member of any team yet.";
        return;
    }

    teamsList.innerHTML = "";
    data.forEach(({ role, teams }) => {
        const card = document.createElement("article");
        card.className = "panel";
        card.innerHTML = `
            <h3></h3>
            <p class="team-role"></p>
            <code class="team-code"></code>
        `;
        card.querySelector("h3").textContent = teams.name;
        card.querySelector(".team-role").textContent = `Role: ${role}`;
        card.querySelector(".team-code").textContent =
            `Join code: ${teams.join_code}`;
        teamsList.appendChild(card);
    });
}

createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = new FormData(createForm).get("name").trim();

    const { data, error } = await supabase.rpc("create_cipher_team", {
        team_name: name
    });

    if (error) {
        console.error("Team creation failed:", error);
        showMessage(
            getTeamErrorMessage(
                error,
                "Team creation failed. Run teams.sql in Supabase first."
            ),
            "error"
        );
        return;
    }

    createForm.reset();
    const team = Array.isArray(data) ? data[0] : data;
    showMessage(`Team created. Your join code is ${team.join_code}.`);
    await loadTeams();
});

joinForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = String(new FormData(joinForm).get("code"))
        .trim()
        .toUpperCase();

    const { error } = await supabase.rpc("join_cipher_team", {
        team_join_code: code
    });

    if (error) {
        console.error("Team join failed:", error);
        showMessage(
            getTeamErrorMessage(
                error,
                "Could not join that team. Check the code and try again."
            ),
            "error"
        );
        return;
    }

    joinForm.reset();
    showMessage("You joined the team.");
    await loadTeams();
});

if (await requireUser()) {
    await loadTeams();
}
