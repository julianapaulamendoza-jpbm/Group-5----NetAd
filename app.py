from flask import Flask, render_template, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
import os

app = Flask(__name__)

# Cryptographic key to sign session cookies so they cannot be tampered with
app.secret_key = 'super_secret_secure_watch_key_group_5'

# Configure database dynamically (Uses Railway configuration online, falls back to local at home)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'postgresql://postgres:your_password@localhost:5432/watchmewhip')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Database Models
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.Text, nullable=False)
    role = db.Column(db.String(20), default='user')

class Log(db.Model):
    __tablename__ = 'logs'
    id = db.Column(db.Integer, primary_key=True)
    user_email = db.Column(db.String(100))
    time_in = db.Column(db.String(20))
    time_out = db.Column(db.String(20))
    date = db.Column(db.String(50))
    ip_address = db.Column(db.String(45))
    location = db.Column(db.String(100))
    action = db.Column(db.Text)

# Web View Route
@app.route('/')
def home():
    return render_template('index.html')

# Hardened Authentication Endpoint
@app.route('/api/auth/login', methods=['POST'])
def api_auth_login():
    data = request.get_json()
    email = data.get('user')
    password = data.get('password')

    # Accept real location arrays coming from frontend lookups
    client_ip = data.get('ip') or request.remote_addr
    client_location = data.get('location') or 'Unknown Location'

    # Secure Server-Side Verification — only these 4 admins can access
    valid_users = [
        {'email': 'juliana@securewatch.com', 'password': 'tds4_sK26-X@7d'},
        {'email': 'joshua@securewatch.com', 'password': '@bcD€FgH1jK'},
        {'email': 'aya@securewatch.com', 'password': 'ay@<3!'},
        {'email': 'alexa@securewatch.com', 'password': 'Ax@mSk04gz!'},
    ]

    # Check if the email and password match any valid user
    user_match = next((u for u in valid_users if u['email'] == email and u['password'] == password), None)

    if user_match:
        session['authenticated'] = True
        session['user'] = email

        # Log the successful login to the database
        new_log = Log(
            user_email=email,
            time_in=data.get('timeIn'),
            time_out=None,
            date=data.get('date'),
            ip_address=client_ip,
            location=client_location,
            action='Logged In'
        )
        db.session.add(new_log)
        db.session.commit()

        return jsonify({"status": "success", "log_id": new_log.id})
    else:
        # Log the failed login attempt as a warning
        new_warning = Log(
            user_email=email or 'Blank Email Input',
            time_in=data.get('timeIn'),
            time_out=None,
            date=data.get('date'),
            ip_address=client_ip,
            location=client_location,
            action='⚠️ WARNING: Intrusion Attempt'
        )
        db.session.add(new_warning)
        db.session.commit()

        return jsonify({"status": "unauthorized", "message": "Invalid credentials"}), 401

# Step-by-Step History Action Logging Endpoint
@app.route('/api/auth/track_action', methods=['POST'])
def api_track_action():
    # Block unauthenticated requests
    if not session.get('authenticated'):
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    data = request.get_json()

    # Log each user action step by step
    new_step = Log(
        user_email=session.get('user'),
        time_in=data.get('time'),
        time_out=None,
        date=data.get('date'),
        ip_address=data.get('ip'),
        location=data.get('location'),
        action=data.get('action')
    )
    db.session.add(new_step)
    db.session.commit()

    return jsonify({"status": "success"})

# Logout Endpoint
@app.route('/api/auth/logout', methods=['POST'])
def api_auth_logout():
    data = request.get_json()
    time_out = data.get('timeOut')

    # Log the logout time to the database
    logout_entry = Log(
        user_email=session.get('user', 'Unknown User'),
        time_in=time_out,
        time_out=time_out,
        date=data.get('date') or 'Active Session',
        ip_address=data.get('ip') or '127.0.0.1',
        location=data.get('location') or 'Local Session',
        action='Logged Out'
    )
    db.session.add(logout_entry)
    db.session.commit()

    # Clear the session on logout
    session.clear()
    return jsonify({"status": "success"})

# Guarded Logs Endpoint
@app.route('/api/logs', methods=['GET'])
def api_get_logs():
    # Block unauthenticated requests
    if not session.get('authenticated'):
        return jsonify({"status": "error", "message": "Access Denied: Server-Side Block"}), 403

    # Fetch all logs from the database ordered by latest first
    all_logs = Log.query.order_by(Log.id.desc()).all()
    logs_data = []
    for log in all_logs:
        logs_data.append({
            "user": log.user_email,
            "timeIn": log.time_in,
            "timeOut": log.time_out,
            "date": log.date,
            "ip": log.ip_address,
            "location": log.location,
            "action": log.action
        })
    return jsonify(logs_data)

# Stream Verification Endpoint
@app.route('/api/stream/verify', methods=['GET'])
def verify_stream_access():
    # Only allow authenticated users to access the camera stream
    if not session.get('authenticated'):
        return jsonify({"status": "forbidden"}), 403
    return jsonify({"status": "allowed"}), 200

# Create all database tables if they don't exist
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
