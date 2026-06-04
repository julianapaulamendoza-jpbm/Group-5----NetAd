from flask import Flask, render_template, request, jsonify, session, Response
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
import os
import cv2

app = Flask(__name__)
bcrypt = Bcrypt(app)

app.secret_key = 'super_secret_secure_watch_key_group_5'

app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'postgresql://postgres:group5@localhost:5432/watchmewhip')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

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


def parse_user_agent(ua_string):
    ua = ua_string.lower()

    if 'windows' in ua:
        os_name = 'Windows'
    elif 'android' in ua:
        os_name = 'Android'
    elif 'iphone' in ua or 'ipad' in ua:
        os_name = 'iPhone/iPad'
    elif 'mac' in ua:
        os_name = 'Mac'
    elif 'linux' in ua:
        os_name = 'Linux'
    else:
        os_name = 'Unknown OS'

    if 'edg/' in ua:
        browser = 'Edge'
    elif 'opr/' in ua or 'opera' in ua:
        browser = 'Opera'
    elif 'chrome' in ua:
        browser = 'Chrome'
    elif 'firefox' in ua:
        browser = 'Firefox'
    elif 'safari' in ua:
        browser = 'Safari'
    else:
        browser = 'Unknown Browser'

    return f'{browser} on {os_name}'


def get_real_ip():
    for header in ['X-Forwarded-For', 'X-Real-IP', 'CF-Connecting-IP']:
        value = request.headers.get(header)
        if value:
            return value.split(',')[0].strip()
    ip = request.remote_addr
    if ip in ('127.0.0.1', '::1', 'localhost'):
        try:
            data = request.get_json(silent=True) or {}
            frontend_ip = data.get('ip')
            if frontend_ip and frontend_ip not in ('127.0.0.1', '::1'):
                return frontend_ip
        except:
            pass
    return ip


def generate_frames():
    stream_url = os.environ.get('STREAM_URL', 'http://admin:ExtraLex%2325@192.168.100.58:8080/stream/getvideo')
    camera = cv2.VideoCapture(stream_url)
    while True:
        success, frame = camera.read()
        if not success:
            break
        ret, buffer = cv2.imencode('.jpg', frame)
        frame = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/video_feed')
def video_feed():
    if not session.get('authenticated'):
        return jsonify({"status": "forbidden"}), 403
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/auth/login', methods=['POST'])
def api_auth_login():
    data = request.get_json()
    email = data.get('user')
    password = data.get('password')

    client_ip = get_real_ip() or data.get('ip') or 'Unknown IP'
    user_agent = request.headers.get('User-Agent', 'Unknown Device')
    device_info = parse_user_agent(user_agent)

    user_match = User.query.filter_by(username=email).first()

    if user_match and bcrypt.check_password_hash(user_match.password_hash, password):
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
            action=f'⚠️ WARNING: Intrusion Attempt | Device: {device_info}'
        )
        db.session.add(new_warning)
        db.session.commit()

        return jsonify({
            "status": "unauthorized",
            "message": "Invalid credentials",
            "user_agent": device_info
        }), 401


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


@app.route('/api/logs', methods=['GET'])
def api_get_logs():
    if not session.get('authenticated'):
        return jsonify({"status": "error", "message": "Access Denied: Server-Side Block"}), 403

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
