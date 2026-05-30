from flask import Flask, render_template, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
import os
 
app = Flask(__name__)
 
# Cryptographic key to sign session cookies so they cannot be tampered with
app.secret_key = 'super_secret_secure_watch_key_group_5'
 
# Configure database dynamically (Uses Railway configuration online, falls back to local at home)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'postgresql://postgres:group5@localhost:5432/watchmewhip')
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
    action = db.Column(db.Text)
 
 
# ─── Helper: Extract the real client IP ──────────────────────────────────────
def get_real_ip():
    """
    Checks X-Forwarded-For first (set by proxies/load balancers like Railway,
    Nginx, Cloudflare). Falls back to the direct connection IP if not present.
    X-Forwarded-For can be a comma-separated chain; the FIRST entry is the
    original client.
    """
    forwarded_for = request.headers.get('X-Forwarded-For')
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()
    return request.remote_addr
# ─────────────────────────────────────────────────────────────────────────────
 
 
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
 
    client_ip = get_real_ip() or data.get('ip') or 'Unknown IP'
 
    # Secure Server-Side Verification — only these 4 admins can access
valid_users = [
        {'email': 'aya@securewatch.com', 'password': os.environ.get('aya@securewatch.com')},
        {'email': 'joshua@securewatch.com', 'password': os.environ.get('joshua@securewatch.com')},
        {'email': 'juliana@securewatch.com', 'password': os.environ.get('juliana@securewatch.com')},
        {'email': 'alexa@securewatch.com', 'password': os.environ.get('alexa@securewatch.com')},
    ]
 
    user_match = next((u for u in valid_users if u['email'] == email and u['password'] == password), None)
 
    if user_match:
        session['authenticated'] = True
        session['user'] = email
 
        new_log = Log(
            user_email=email,
            time_in=data.get('timeIn'),
            time_out=None,
            date=data.get('date'),
            ip_address=client_ip,
            action='Logged In'
        )
        db.session.add(new_log)
        db.session.commit()
 
        return jsonify({"status": "success", "log_id": new_log.id})
    else:
        new_warning = Log(
            user_email=email or 'Blank Email Input',
            time_in=data.get('timeIn'),
            time_out=None,
            date=data.get('date'),
            ip_address=client_ip,
            action='⚠️ WARNING: Intrusion Attempt'
        )
        db.session.add(new_warning)
        db.session.commit()
 
        return jsonify({"status": "unauthorized", "message": "Invalid credentials"}), 401
 
# Step-by-Step History Action Logging Endpoint
@app.route('/api/auth/track_action', methods=['POST'])
def api_track_action():
    if not session.get('authenticated'):
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
 
    data = request.get_json()
    client_ip = get_real_ip() or data.get('ip') or 'Unknown IP'
 
    new_step = Log(
        user_email=session.get('user'),
        time_in=data.get('time'),
        date=data.get('date'),
        time_out=None,
        ip_address=client_ip,
        action=data.get('action')
    )
    db.session.add(new_step)
    db.session.commit()
 
    return jsonify({"status": "success"})
 
# Logout Endpoint
@app.route('/api/auth/logout', methods=['POST'])
def api_auth_logout():
    data = request.get_json()
    client_ip = get_real_ip() or data.get('ip') or '127.0.0.1'
 
    logout_entry = Log(
        user_email=session.get('user', 'Unknown User'),
        time_in=data.get('timeOut'),
        time_out=data.get('timeOut'),
        date=data.get('date'),
        ip_address=client_ip,
        action='Logged Out'
    )
    db.session.add(logout_entry)
    db.session.commit()
 
    session.clear()
    return jsonify({"status": "success"})
 
# Guarded Logs Endpoint
@app.route('/api/logs', methods=['GET'])
def api_get_logs():
    if not session.get('authenticated'):
        return jsonify({"status": "error", "message": "Access Denied: Server-Side Block"}), 403
 
    # Only insert log item if it comes from an explicit manual click instruction
    if request.args.get('manual') == 'true' and request.args.get('initial') != 'true':
        frontend_time = request.args.get('time', 'Unknown Time')
        frontend_date = request.args.get('date', 'Unknown Date')
        
        refresh_log = Log(
            user_email=session.get('user', 'Unknown User'),
            time_in=frontend_time,
            time_out=None,
            date=frontend_date,
            ip_address=get_real_ip(),
            action='Refreshed Monitoring Logs'
        )
        db.session.add(refresh_log)
        db.session.commit()
 
    all_logs = Log.query.order_by(Log.id.desc()).all()
    logs_data = []
    for log in all_logs:
        logs_data.append({
            "user": log.user_email,
            "timeIn": log.time_in,
            "timeOut": log.time_out,
            "date": log.date,
            "ip": log.ip_address,
            "action": log.action
        })
    return jsonify(logs_data)
 
# Stream Verification Endpoint
@app.route('/api/stream/verify', methods=['GET'])
def verify_stream_access():
    if not session.get('authenticated'):
        return jsonify({"status": "forbidden"}), 403
    return jsonify({"status": "allowed"}), 200
 
with app.app_context():
    db.create_all()
 
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
