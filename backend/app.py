
import os
import re
import sqlite3
from pathlib import Path
from functools import wraps
from datetime import timedelta

from flask import Flask, request, jsonify, session
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_wtf.csrf import CSRFProtect, generate_csrf, CSRFError
from dotenv import load_dotenv
from werkzeug.security import check_password_hash


# --------------------------------
# Application Configuration
# --------------------------------

BASE_DIR = Path(__file__).resolve().parent
DATABASE = BASE_DIR / "enquiries.db"

app = Flask(__name__)

# Load environment variables
load_dotenv(BASE_DIR.parent / ".env")

secret_key = os.getenv("SECRET_KEY")
admin_username = os.getenv("ADMIN_USERNAME")
admin_password_hash = os.getenv("ADMIN_PASSWORD_HASH")

if not all([secret_key, admin_username, admin_password_hash]):
    raise RuntimeError("Missing admin security configuration in .env")

app.config.update(
    SECRET_KEY=secret_key,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=False,  # True when deployed with HTTPS
    PERMANENT_SESSION_LIFETIME=timedelta(minutes=30),
    MAX_CONTENT_LENGTH=12000
)


# --------------------------------
# CSRF Protection
# --------------------------------

csrf = CSRFProtect(app)


@app.errorhandler(CSRFError)
def handle_csrf_error(error):
    return jsonify({
        "status": "error",
        "message": "CSRF validation failed. Please refresh and try again."
    }), 400


# --------------------------------
# CORS Configuration
# --------------------------------

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                "http://localhost:5500",
                "http://127.0.0.1:5500",
                "http://localhost:8000",
                "http://127.0.0.1:8000"
            ]
        }
    },
    supports_credentials=True
)


# --------------------------------
# Rate Limiting
# --------------------------------

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["100 per hour"],
    storage_uri="memory://"
)


# --------------------------------
# Database Setup
# --------------------------------

def get_db():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    with get_db() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS enquiries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                service TEXT NOT NULL,
                budget TEXT,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)


# --------------------------------
# Input Validation
# --------------------------------

ALLOWED_SERVICES = {
    "SEO",
    "Google Ads",
    "Meta Ads",
    "Social Media Marketing",
    "AI Automation",
    "Other"
}

ALLOWED_BUDGETS = {
    "",
    "Below ₹5,000",
    "₹5,000 - ₹10,000",
    "₹10,000 - ₹25,000",
    "₹25,000+",
    "Not decided"
}


def clean_text(value):
    if not isinstance(value, str):
        return ""
    return value.strip()


def validate_email(email):
    return bool(
        re.fullmatch(
            r"[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,63}",
            email
        )
    )


# --------------------------------
# Health API
# --------------------------------

@app.get("/api/health")
def health():
    return jsonify({
        "status": "success",
        "message": "Manvendra Portfolio API is running."
    })


# --------------------------------
# CSRF Token API
# --------------------------------

@app.get("/api/csrf-token")
def get_csrf_token():
    response = jsonify({
        "status": "success",
        "csrf_token": generate_csrf()
    })

    response.headers["Cache-Control"] = "no-store"
    return response


# --------------------------------
# Contact Form API
# --------------------------------

@app.post("/api/contact")
@limiter.limit("5 per minute")
def contact():

    if not request.is_json:
        return jsonify({
            "status": "error",
            "message": "JSON data is required."
        }), 415

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "status": "error",
            "message": "Invalid request data."
        }), 400

    name = clean_text(data.get("name"))
    email = clean_text(data.get("email"))
    service = clean_text(data.get("service"))
    budget = clean_text(data.get("budget"))
    message = clean_text(data.get("message"))

    # Required field validation
    if not all([name, email, service, message]):
        return jsonify({
            "status": "error",
            "message": "Please complete all required fields."
        }), 400

    if not 2 <= len(name) <= 80:
        return jsonify({
            "status": "error",
            "message": "Name must contain 2 to 80 characters."
        }), 400

    if len(email) > 254 or not validate_email(email):
        return jsonify({
            "status": "error",
            "message": "Please enter a valid email address."
        }), 400

    if service not in ALLOWED_SERVICES:
        return jsonify({
            "status": "error",
            "message": "Invalid service selection."
        }), 400

    if budget not in ALLOWED_BUDGETS:
        return jsonify({
            "status": "error",
            "message": "Invalid budget selection."
        }), 400

    if not 10 <= len(message) <= 2000:
        return jsonify({
            "status": "error",
            "message": "Message must contain 10 to 2000 characters."
        }), 400

    # Save enquiry using parameterized SQL
    try:
        with get_db() as connection:
            connection.execute(
                """
                INSERT INTO enquiries
                (name, email, service, budget, message)
                VALUES (?, ?, ?, ?, ?)
                """,
                (name, email, service, budget, message)
            )

    except sqlite3.Error:
        app.logger.exception("Database error")
        return jsonify({
            "status": "error",
            "message": "Unable to process your enquiry right now."
        }), 500

    return jsonify({
        "status": "success",
        "message": "Your enquiry has been submitted successfully."
    }), 201


# --------------------------------
# Admin Authentication
# --------------------------------

def admin_required(function):
    @wraps(function)
    def wrapper(*args, **kwargs):

        if not session.get("admin_logged_in"):
            return jsonify({
                "status": "error",
                "message": "Authentication required."
            }), 401

        return function(*args, **kwargs)

    return wrapper


# --------------------------------
# Admin Login API
# --------------------------------

@app.route("/api/admin/login", methods=["POST"])
@limiter.limit("5 per minute")
def admin_login():

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "status": "error",
            "message": "Invalid login data."
        }), 400

    username = data.get("username", "")
    password = data.get("password", "")

    if (
        username != admin_username
        or not isinstance(password, str)
        or not check_password_hash(admin_password_hash, password)
    ):
        return jsonify({
            "status": "error",
            "message": "Invalid username or password."
        }), 401

    session.clear()
    session["admin_logged_in"] = True
    session.permanent = True

    return jsonify({
        "status": "success",
        "message": "Login successful."
    }), 200


# --------------------------------
# Admin Logout API
# --------------------------------

@app.route("/api/admin/logout", methods=["POST"])
@admin_required
def admin_logout():

    session.clear()

    return jsonify({
        "status": "success",
        "message": "Logged out successfully."
    })


# --------------------------------
# Get Client Enquiries API
# --------------------------------

@app.route("/api/admin/enquiries", methods=["GET"])
@admin_required
def get_admin_enquiries():

    connection = get_db()

    try:
        enquiries = connection.execute(
            """
            SELECT *
            FROM enquiries
            ORDER BY created_at DESC
            LIMIT 100
            """
        ).fetchall()

        return jsonify({
            "status": "success",
            "enquiries": [dict(row) for row in enquiries]
        })

    finally:
        connection.close()


# --------------------------------
# Delete Client Enquiry API
# --------------------------------

@app.route(
    "/api/admin/enquiries/<int:enquiry_id>",
    methods=["DELETE"]
)
@admin_required
@limiter.limit("20 per minute")
def delete_admin_enquiry(enquiry_id):

    connection = get_db()

    try:
        cursor = connection.execute(
            "DELETE FROM enquiries WHERE id = ?",
            (enquiry_id,)
        )

        connection.commit()

        if cursor.rowcount == 0:
            return jsonify({
                "status": "error",
                "message": "Enquiry not found."
            }), 404

        return jsonify({
            "status": "success",
            "message": "Enquiry deleted successfully."
        }), 200

    except sqlite3.Error:
        app.logger.exception("Database deletion error")

        return jsonify({
            "status": "error",
            "message": "Unable to delete enquiry."
        }), 500

    finally:
        connection.close()


# --------------------------------
# Start Development Server
# --------------------------------

if __name__ == "__main__":
    initialize_database()

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=False
    )
