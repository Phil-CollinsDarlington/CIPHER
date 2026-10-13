/* ==========================================================
CIPHER | MAIN JAVASCRIPT

This file controls:

1. The mobile navigation menu.
2. The rotating encrypted messages.
3. The current year in the footer.
4. The temporary Enter CIPHER button.

Authentication and real challenge functionality will be
added when we connect the backend.
========================================================== */

/* ===================== 1. MOBILE NAVIGATION ===================== */

// Find the mobile menu button and the navigation links.
const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

// Only activate the menu if both elements exist.
if (menuToggle && navLinks) {

```
// Open or close the mobile navigation when clicked.
menuToggle.addEventListener("click", () => {

    const isOpen = navLinks.classList.toggle("is-open");

    // Update the accessibility state.
    menuToggle.setAttribute("aria-expanded", String(isOpen));

    // Update the screen-reader label.
    menuToggle.setAttribute(
        "aria-label",
        isOpen ? "Close navigation menu" : "Open navigation menu"
    );

});


// Close the menu after a navigation link is selected.
navLinks.querySelectorAll("a").forEach((link) => {

    link.addEventListener("click", () => {

        navLinks.classList.remove("is-open");

        menuToggle.setAttribute("aria-expanded", "false");

        menuToggle.setAttribute(
            "aria-label",
            "Open navigation menu"
        );

    });

});


// Close the menu when the Escape key is pressed.
document.addEventListener("keydown", (event) => {

    if (event.key === "Escape") {

        navLinks.classList.remove("is-open");

        menuToggle.setAttribute("aria-expanded", "false");

        menuToggle.setAttribute(
            "aria-label",
            "Open navigation menu"
        );

    }

});
```

}

/* ===================== 2. ROTATING CIPHER MESSAGES ===================== */

// Find the message element in the terminal.
const cipherMessage = document.getElementById("cipherMessage");

// These are decorative messages for the landing page.
// They are NOT live challenge answers.
const cipherMessages = [

```
"The answer is closer than you think.",

"Every pattern leaves a trace.",

"Not every signal is what it seems.",

"Look beyond what you can see.",

"The next clue changes everything.",

"Question the obvious. Follow the evidence."
```

];

// Change the message every few seconds.
if (cipherMessage) {

```
let currentMessageIndex = 0;

window.setInterval(() => {

    // Move to the next message.
    currentMessageIndex =
        (currentMessageIndex + 1) % cipherMessages.length;

    // Display the new message.
    cipherMessage.textContent =
        cipherMessages[currentMessageIndex];

}, 4000);
```

}

/* ===================== 3. AUTOMATIC COPYRIGHT YEAR ===================== */

// Find the footer's year element.
const currentYear = document.getElementById("currentYear");

// Display the current year automatically.
if (currentYear) {

```
currentYear.textContent = new Date().getFullYear();
```

}

/* ===================== 4. TEMPORARY ENTER BUTTON ===================== */

// This button is a placeholder until authentication exists.
const enterGameButton = document.getElementById("enterGameButton");

if (enterGameButton) {

```
enterGameButton.addEventListener("click", () => {

    alert(
        "CIPHER INITIALIZATION\n\n" +
        "The platform is being prepared.\n\n" +
        "Player registration and live challenges " +
        "will be available after the next development stages."
    );

});
```

}

/* ===================== 5. CONSOLE MESSAGE ===================== */

// A small development message for you.
// Open the browser console to see it.
console.log(
"%cCIPHER INITIALIZED",
"color: #b5ff45; font-size: 18px; font-weight: bold;"
);

console.log(
"Development status: Frontend foundation.",
"Authentication: Not connected.",
"Live challenges: Not connected."
);
