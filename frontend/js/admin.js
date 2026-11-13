
const API_URL = "https://manvendra-portfolio-api-2sgr.onrender.com/api";

const loginForm = document.getElementById("adminLoginForm");
const loginStatus = document.getElementById("loginStatus");
const loginButton = document.getElementById("loginButton");

// Fetch a fresh CSRF token from the backend
async function getCsrfToken() {
    const response = await fetch(`${API_URL}/csrf-token`, {
        method: "GET",
        credentials: "include"
    });

    const result = await response.json();

    if (!response.ok || !result.csrf_token) {
        throw new Error("Unable to generate security token. Please refresh.");
    }

    return result.csrf_token;
}

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!loginForm.reportValidity()) return;

        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;

        loginButton.disabled = true;
        loginButton.textContent = "Authenticating...";
        loginStatus.textContent = "";

        try {
            // Step 1: Get CSRF token
            const csrfToken = await getCsrfToken();

            // Step 2: Send login request with CSRF token
            const response = await fetch(`${API_URL}/admin/login`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrfToken
                },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Login failed.");
            }

            loginStatus.style.color = "#22c55e";
            loginStatus.textContent = "Login successful! Redirecting...";

            window.location.href = "dashboard.html";

        } catch (error) {
            loginStatus.style.color = "#f87171";
            loginStatus.textContent =
                error.message === "Failed to fetch"
                    ? "Unable to connect to the server."
                    : error.message;

        } finally {
            loginButton.disabled = false;
            loginButton.textContent = "Sign In Securely ↗";
        }
    });
}
