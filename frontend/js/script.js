
// =====================================
// MANVENDRA PORTFOLIO - JAVASCRIPT
// =====================================

const API_URL = "https://manvendra-portfolio-api-2sgr.onrender.com/api";

// 1. Mobile Navigation
const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");

if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
        const isOpen = navLinks.classList.toggle("active");

        menuToggle.setAttribute("aria-expanded", String(isOpen));
        menuToggle.textContent = isOpen ? "✕" : "☰";
    });

    document.querySelectorAll(".nav-links a").forEach((link) => {
        link.addEventListener("click", () => {
            navLinks.classList.remove("active");
            menuToggle.textContent = "☰";
            menuToggle.setAttribute("aria-expanded", "false");
        });
    });
}

// 2. 3D Profile Mouse Effect
const profileCard = document.querySelector(".profile-card");
const heroVisual = document.querySelector(".hero-visual");

if (profileCard && heroVisual) {
    heroVisual.addEventListener("mousemove", (event) => {
        const rect = heroVisual.getBoundingClientRect();

        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateY = (x - centerX) / 25;
        const rotateX = (centerY - y) / 25;

        profileCard.style.transform =
            `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    heroVisual.addEventListener("mouseleave", () => {
        profileCard.style.transform = "";
    });
}

// 3. Reveal Sections While Scrolling
const sections = document.querySelectorAll(".content-section");

if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.15 }
    );

    sections.forEach((section) => observer.observe(section));
} else {
    sections.forEach((section) => section.classList.add("visible"));
}

// 4. Dynamic Footer Year
const footer = document.querySelector("footer p");

if (footer) {
    footer.textContent =
        `© ${new Date().getFullYear()} Manvendra Singh. All Rights Reserved.`;
}

// 5. Prevent Empty or Placeholder WhatsApp Links
const whatsappLink = document.querySelector('a[href*="wa.me/"]');

if (whatsappLink) {
    whatsappLink.addEventListener("click", (event) => {
        if (whatsappLink.href.includes("YOURNUMBER")) {
            event.preventDefault();
            alert("WhatsApp number will be configured soon!");
        }
    });
}

console.log("Manvendra Portfolio JavaScript Loaded Successfully!");

// =====================================
// CSRF TOKEN GENERATOR
// =====================================

async function getCsrfToken() {
    const response = await fetch(`${API_URL}/csrf-token`, {
        method: "GET",
        credentials: "include"
    });

    const result = await response.json();

    if (!response.ok || !result.csrf_token) {
        throw new Error(
            "Unable to generate security token. Please refresh the page."
        );
    }

    return result.csrf_token;
}

// =====================================
// CONTACT FORM - SECURE FLASK API
// =====================================

const contactForm = document.getElementById("contactForm");
const formStatus = document.getElementById("formStatus");

const submitButton = contactForm?.querySelector(".submit-button");

if (contactForm && formStatus && submitButton) {
    contactForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!contactForm.reportValidity()) {
            return;
        }

        const formData = new FormData(contactForm);

        const enquiry = {
            name: formData.get("name").trim(),
            email: formData.get("email").trim(),
            service: formData.get("service"),
            budget: formData.get("budget"),
            message: formData.get("message").trim()
        };

        submitButton.disabled = true;
        submitButton.textContent = "Submitting...";
        formStatus.textContent = "Please wait...";

        try {
            // Step 1: Fetch a fresh CSRF token
            const csrfToken = await getCsrfToken();

            // Step 2: Submit enquiry with CSRF protection
            const response = await fetch(`${API_URL}/contact`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrfToken
                },
                body: JSON.stringify(enquiry)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Submission failed."
                );
            }

            formStatus.style.color = "#22c55e";
            formStatus.textContent =
                result.message || "Your enquiry was submitted successfully!";

            contactForm.reset();

        } catch (error) {
            console.error("Contact form error:", error);

            formStatus.style.color = "#f87171";
            formStatus.textContent =
                error.message === "Failed to fetch"
                    ? "Unable to connect to the server. Please try again."
                    : error.message;

        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Submit Project Enquiry ↗";
        }
    });
}
