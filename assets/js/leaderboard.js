import { supabase } from "./supabase-client.js";

const messageElement = document.getElementById("leaderboard-message");
const individualBody = document.getElementById("individual-leaderboard");
const teamBody = document.getElementById("team-leaderboard");

function showMessage(message, type = "success") {
    messageElement.textContent = message;
    messageElement.className =
        `dashboard-message visible ${type}`;
}

function renderRows(body, rows, columns, emptyMessage) {
    body.innerHTML = "";

    if (!rows?.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = columns;
        cell.textContent = emptyMessage;
        row.appendChild(cell);
        body.appendChild(row);
        return;
    }

    rows.forEach((entry) => {
        const row = document.createElement("tr");
        const values = columns === 4
            ? [
                `#${entry.rank}`,
                entry.display_name,
                entry.total_points,
                entry.checkpoints_completed
            ]
            : [
                `#${entry.rank}`,
                entry.team_name,
                entry.total_points,
                entry.checkpoints_completed,
                entry.member_count
            ];

        values.forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });
        body.appendChild(row);
    });
}

async function loadLeaderboards() {
    const { data: userData, error: userError } =
        await supabase.auth.getUser();

    if (userError || !userData.user) {
        window.location.replace("login.html");
        return;
    }

    const [
        { data: individual, error: individualError },
        { data: teams, error: teamError }
    ] = await Promise.all([
        supabase.rpc("get_individual_leaderboard"),
        supabase.rpc("get_team_leaderboard")
    ]);

    if (individualError || teamError) {
        console.error("Leaderboard loading failed:", {
            individualError,
            teamError
        });
        showMessage(
            "The leaderboards could not be loaded. Run the updated gameplay.sql migration.",
            "error"
        );
        return;
    }

    renderRows(
        individualBody,
        individual,
        4,
        "No completed checkpoints yet."
    );
    renderRows(
        teamBody,
        teams,
        5,
        "No teams have scored yet."
    );
    showMessage("Rankings updated.");
}

loadLeaderboards().catch((error) => {
    console.error("Unexpected leaderboard error:", error);
    showMessage("An unexpected leaderboard error occurred.", "error");
});
