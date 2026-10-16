import { supabase } from "./supabase-client.js";

const messageElement = document.getElementById("achievements-message");
const listElement = document.getElementById("achievements-list");

function showMessage(message, type = "success") {
    messageElement.textContent = message;
    messageElement.className =
        `dashboard-message visible ${type}`;
}

async function loadAchievements() {
    const { data: userData, error: userError } =
        await supabase.auth.getUser();

    if (userError || !userData.user) {
        window.location.replace("login.html");
        return;
    }

    const { data, error } = await supabase
        .from("user_achievements")
        .select(`
            awarded_at,
            achievements (
                name,
                description,
                icon
            )
        `)
        .eq("user_id", userData.user.id)
        .order("awarded_at", { ascending: false });

    if (error) {
        console.error("Achievement loading failed:", error);
        listElement.textContent =
            "Achievement storage is not configured yet. Run achievements.sql in Supabase first.";
        showMessage("Achievements could not be loaded.", "error");
        return;
    }

    if (!data?.length) {
        listElement.innerHTML = `
            <div class="empty-state">
                <div class="empty-symbol" aria-hidden="true">✧</div>
                <h3>Your first badge is waiting.</h3>
                <p>Complete challenges to earn achievements.</p>
            </div>
        `;
        return;
    }

    listElement.innerHTML = "";
    data.forEach(({ awarded_at, achievements }) => {
        const card = document.createElement("article");
        card.className = "achievement-card";
        card.innerHTML = `
            <div class="achievement-icon" aria-hidden="true"></div>
            <h3></h3>
            <p class="achievement-description"></p>
            <small></small>
        `;
        card.querySelector(".achievement-icon").textContent =
            achievements.icon;
        card.querySelector("h3").textContent = achievements.name;
        card.querySelector(".achievement-description").textContent =
            achievements.description;
        card.querySelector("small").textContent =
            `Earned ${new Date(awarded_at).toLocaleDateString()}`;
        listElement.appendChild(card);
    });
}

loadAchievements().catch((error) => {
    console.error("Unexpected achievement error:", error);
    showMessage("An unexpected error occurred while loading achievements.", "error");
});
