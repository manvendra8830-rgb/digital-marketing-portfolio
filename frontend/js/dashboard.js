
const API_URL = "http://127.0.0.1:5000/api";

// Dashboard elements
const totalEnquiries = document.getElementById("totalEnquiries");
const totalServices = document.getElementById("totalServices");
const enquiryTable = document.getElementById("enquiryTable");
const dashboardStatus = document.getElementById("dashboardStatus");
const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");

// Search and filter
const searchInput = document.getElementById("searchInput");
const serviceFilter = document.getElementById("serviceFilter");

// Modal elements
const enquiryModal = document.getElementById("enquiryModal");
const closeModal = document.getElementById("closeModal");

const detailName = document.getElementById("detailName");
const detailEmail = document.getElementById("detailEmail");
const detailService = document.getElementById("detailService");
const detailBudget = document.getElementById("detailBudget");
const detailMessage = document.getElementById("detailMessage");

let allEnquiries = [];

// --------------------------------
// Get CSRF Token
// --------------------------------

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

// --------------------------------
// Load Enquiries
// --------------------------------

async function loadEnquiries() {
    dashboardStatus.textContent = "Loading client enquiries...";

    try {
        const response = await fetch(`${API_URL}/admin/enquiries`, {
            method: "GET",
            credentials: "include"
        });

        if (response.status === 401) {
            window.location.href = "admin.html";
            return;
        }

        if (!response.ok) {
            throw new Error("Unable to load enquiries.");
        }

        const result = await response.json();

        allEnquiries = result.enquiries || [];

        updateStatistics();
        populateServiceFilter();
        renderEnquiries();

        dashboardStatus.textContent =
            `Showing ${getFilteredEnquiries().length} of ${allEnquiries.length} enquiries.`;

    } catch (error) {
        dashboardStatus.textContent = error.message;
        console.error("Dashboard error:", error);
    }
}

// --------------------------------
// Update Statistics
// --------------------------------

function updateStatistics() {
    totalEnquiries.textContent = allEnquiries.length;

    const uniqueServices = new Set(
        allEnquiries.map(item => item.service).filter(Boolean)
    );

    totalServices.textContent = uniqueServices.size;
}

// --------------------------------
// Populate Service Filter
// --------------------------------

function populateServiceFilter() {
    const previousService = serviceFilter.value;

    const uniqueServices = new Set(
        allEnquiries.map(item => item.service).filter(Boolean)
    );

    serviceFilter.replaceChildren();

    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "All Services";
    serviceFilter.appendChild(allOption);

    uniqueServices.forEach(service => {
        const option = document.createElement("option");
        option.value = service;
        option.textContent = service;
        serviceFilter.appendChild(option);
    });

    serviceFilter.value = uniqueServices.has(previousService)
        ? previousService
        : "";
}

// --------------------------------
// Search and Filter
// --------------------------------

function getFilteredEnquiries() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedService = serviceFilter.value;

    return allEnquiries.filter(item => {
        const matchesSearch =
            (item.name || "").toLowerCase().includes(searchTerm) ||
            (item.email || "").toLowerCase().includes(searchTerm);

        const matchesService =
            !selectedService || item.service === selectedService;

        return matchesSearch && matchesService;
    });
}

// --------------------------------
// Render Enquiries
// --------------------------------

function renderEnquiries() {
    const filteredEnquiries = getFilteredEnquiries();

    enquiryTable.replaceChildren();

    if (filteredEnquiries.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.textContent = allEnquiries.length === 0
            ? "No client enquiries received yet."
            : "No matching enquiries found.";

        row.appendChild(cell);
        enquiryTable.appendChild(row);

        dashboardStatus.textContent =
            `Showing 0 of ${allEnquiries.length} enquiries.`;

        return;
    }

    filteredEnquiries.forEach(item => {
        const row = document.createElement("tr");

        const values = [
            item.name,
            item.email,
            item.service,
            item.budget || "Not specified",
            item.created_at
                ? new Date(item.created_at).toLocaleDateString()
                : "N/A"
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value ?? "N/A";
            row.appendChild(cell);
        });

        const actionCell = document.createElement("td");

        // View Details
        const viewButton = document.createElement("button");
        viewButton.textContent = "View Details";
        viewButton.type = "button";

        viewButton.addEventListener("click", () => {
            detailName.textContent = item.name || "N/A";
            detailEmail.textContent = item.email || "N/A";
            detailService.textContent = item.service || "N/A";
            detailBudget.textContent = item.budget || "Not specified";
            detailMessage.textContent =
                item.message || "No message provided.";

            enquiryModal.style.display = "flex";
        });

        // Delete Enquiry - CSRF Protected
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.type = "button";
        deleteButton.classList.add("delete-button");

        deleteButton.addEventListener("click", async () => {
            const confirmed = confirm(
                `Are you sure you want to delete the enquiry from ${item.name}?`
            );

            if (!confirmed) return;

            deleteButton.disabled = true;
            deleteButton.textContent = "Deleting...";

            try {
                // Get fresh CSRF token
                const csrfToken = await getCsrfToken();

                const response = await fetch(
                    `${API_URL}/admin/enquiries/${item.id}`,
                    {
                        method: "DELETE",
                        credentials: "include",
                        headers: {
                            "X-CSRFToken": csrfToken
                        }
                    }
                );

                const result = await response.json();

                if (response.status === 401) {
                    window.location.href = "admin.html";
                    return;
                }

                if (!response.ok) {
                    throw new Error(
                        result.message || "Unable to delete enquiry."
                    );
                }

                allEnquiries = allEnquiries.filter(
                    enquiry => enquiry.id !== item.id
                );

                updateStatistics();
                populateServiceFilter();
                renderEnquiries();

                alert("Enquiry deleted successfully.");

            } catch (error) {
                console.error("Delete error:", error);
                alert(error.message || "Something went wrong.");

                deleteButton.disabled = false;
                deleteButton.textContent = "Delete";
            }
        });

        actionCell.appendChild(viewButton);
        actionCell.appendChild(deleteButton);

        row.appendChild(actionCell);
        enquiryTable.appendChild(row);
    });

    dashboardStatus.textContent =
        `Showing ${filteredEnquiries.length} of ${allEnquiries.length} enquiries.`;
}

// --------------------------------
// Search and Filter Events
// --------------------------------

searchInput.addEventListener("input", renderEnquiries);
serviceFilter.addEventListener("change", renderEnquiries);

// --------------------------------
// Modal Controls
// --------------------------------

closeModal.addEventListener("click", () => {
    enquiryModal.style.display = "none";
});

enquiryModal.addEventListener("click", event => {
    if (event.target === enquiryModal) {
        enquiryModal.style.display = "none";
    }
});

// --------------------------------
// Refresh Dashboard
// --------------------------------

refreshBtn.addEventListener("click", async () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = "Refreshing...";

    try {
        await loadEnquiries();
    } finally {
        refreshBtn.disabled = false;
        refreshBtn.textContent = "↻ Refresh";
    }
});

// --------------------------------
// Admin Logout - CSRF Protected
// --------------------------------

logoutBtn.addEventListener("click", async () => {
    logoutBtn.disabled = true;

    try {
        // Get fresh CSRF token
        const csrfToken = await getCsrfToken();

        const response = await fetch(`${API_URL}/admin/logout`, {
            method: "POST",
            credentials: "include",
            headers: {
                "X-CSRFToken": csrfToken
            }
        });

        if (response.ok || response.status === 401) {
            window.location.href = "admin.html";
            return;
        }

        const result = await response.json();

        throw new Error(result.message || "Unable to logout.");

    } catch (error) {
        console.error("Logout error:", error);
        alert(error.message || "Server connection failed.");
        logoutBtn.disabled = false;
    }
});

// --------------------------------
// Initial Dashboard Load
// --------------------------------

loadEnquiries();
