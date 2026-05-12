import os, sys

# ── macOS Fix: allow OpenCV to request camera permission from background thread ──
os.environ["OPENCV_AVFOUNDATION_SKIP_AUTH"] = "1"

import cv2
import threading
import time
from typing import Optional, Tuple, Dict
from flask import Flask, Response, jsonify, request as flask_request
import io

try:
    import piexif
    PIEXIF_AVAILABLE = True
except ImportError:
    PIEXIF_AVAILABLE = False
    print("[WARN] piexif not installed — GPS EXIF embedding disabled. Run: python3 -m pip install piexif")


app = Flask(__name__)

FLASK_PORT = 5050
STREAM_WIDTH = 1280
STREAM_HEIGHT = 720
STREAM_FPS = 30
JPEG_QUALITY = 85

latest_frame = None
frame_lock = threading.Lock()
cam_online = False
cam_info = {"index": None, "width": None, "height": None, "fps": None}
stop_flag = False

# ── GPS State (update from your GPS module / NMEA reader / API) ───────────────
# Set these values from any source: serial GPS, HTTP API, or manual override.
gps_lock = threading.Lock()
gps_data  = {
    "lat":     None,    # decimal degrees, e.g. 30.9009
    "lng":     None,    # decimal degrees, e.g. 75.8572
    "alt":     None,    # metres above sea level
    "valid":   False,
    "source":  "none",  # 'gps_module' | 'api' | 'manual' | 'none'
}


def set_gps(lat: float, lng: float, alt: float = 0.0, source: str = "manual"):
    """Call this to update the GPS fix from any source."""
    with gps_lock:
        gps_data.update({"lat": lat, "lng": lng, "alt": alt,
                          "valid": True, "source": source})


def _deg_to_dms_rational(decimal_deg: float):
    """Convert decimal degrees → (deg, min, sec) as piexif IFDRational tuples."""
    d = int(abs(decimal_deg))
    m_float = (abs(decimal_deg) - d) * 60
    m = int(m_float)
    s_float = (m_float - m) * 60
    # Store seconds as rational with 1000x precision
    s_num = int(round(s_float * 1000))
    return ((d, 1), (m, 1), (s_num, 1000))


def embed_gps(jpeg_bytes: bytes) -> bytes:
    """Embed GPS EXIF into a JPEG byte string. Returns original bytes on any error."""
    if not PIEXIF_AVAILABLE:
        return jpeg_bytes

    with gps_lock:
        snap = dict(gps_data)

    if not snap["valid"] or snap["lat"] is None or snap["lng"] is None:
        return jpeg_bytes  # No fix — return as-is

    try:
        lat, lng, alt = snap["lat"], snap["lng"], snap["alt"] or 0.0

        gps_ifd = {
            piexif.GPSIFD.GPSVersionID:       (2, 0, 0, 0),
            piexif.GPSIFD.GPSLatitudeRef:     b"N" if lat >= 0 else b"S",
            piexif.GPSIFD.GPSLatitude:        _deg_to_dms_rational(lat),
            piexif.GPSIFD.GPSLongitudeRef:    b"E" if lng >= 0 else b"W",
            piexif.GPSIFD.GPSLongitude:       _deg_to_dms_rational(lng),
            piexif.GPSIFD.GPSAltitudeRef:     0,      # 0 = above sea level
            piexif.GPSIFD.GPSAltitude:        (int(abs(alt) * 100), 100),
            piexif.GPSIFD.GPSDateStamp:       time.strftime("%Y:%m:%d").encode(),
        }
        exif_dict   = {"GPS": gps_ifd}
        exif_bytes  = piexif.dump(exif_dict)
        out         = io.BytesIO()
        piexif.insert(exif_bytes, jpeg_bytes, out)
        return out.getvalue()
    except Exception as e:
        print(f"[GPS] EXIF embed error: {e}")
        return jpeg_bytes


# ── AVFoundation device name query (macOS only) ───────────────────────────────
_AVFOUNDATION_SCRIPT = """
import objc, sys
from AVFoundation import AVCaptureDevice, AVMediaTypeVideo
devices = AVCaptureDevice.devicesWithMediaType_(AVMediaTypeVideo)
for i, d in enumerate(devices):
    print(f"{i}:{d.localizedName()}")
"""

def _list_avf_cameras() -> Dict[int, str]:
    """
    Return {opencv_index: device_name} for all video devices.
    Method 1: PyObjC AVFoundation (requires pyobjc-framework-AVFoundation)
    Method 2: system_profiler SPCameraDataType JSON (no extra packages, macOS)
    Method 3: Empty dict  →  caller falls back to blind index scan
    """
    import subprocess, json as _json

    # ── Method 1: PyObjC ──────────────────────────────────────────────────────
    try:
        result = subprocess.run(
            [sys.executable, "-c", _AVFOUNDATION_SCRIPT],
            capture_output=True, text=True, timeout=5
        )
        names: Dict[int, str] = {}
        for line in result.stdout.strip().splitlines():
            if ":" in line:
                idx_str, name = line.split(":", 1)
                names[int(idx_str)] = name.strip()
        if names:
            return names
    except Exception:
        pass

    # ── Method 2: system_profiler (macOS built-in, no packages needed) ────────
    # system_profiler lists cameras in the same order OpenCV assigns indices.
    if sys.platform == "darwin":
        try:
            sp = subprocess.run(
                ["system_profiler", "SPCameraDataType", "-json"],
                capture_output=True, text=True, timeout=8
            )
            data = _json.loads(sp.stdout)
            cameras = data.get("SPCameraDataType", [])
            names = {i: c.get("_name", f"Camera {i}") for i, c in enumerate(cameras)}
            if names:
                return names
        except Exception:
            pass

    return {}


def _find_obs_index() -> Optional[int]:
    """Return the AVFoundation index of OBS Virtual Camera, or None."""
    names = _list_avf_cameras()
    if names:
        print("[Camera] Detected devices:")
        for idx, name in names.items():
            print(f"           [{idx}] {name}")
        for idx, name in names.items():
            if "obs" in name.lower():
                print(f"[Camera] OBS Virtual Camera found at index {idx} → '{name}'")
                return idx
        print("[Camera] OBS Virtual Camera not found in device list.")
    else:
        print("[Camera] AVFoundation query unavailable — falling back to index scan.")
    return None


def _try_open(idx: int, label: str) -> Tuple:
    """Attempt to open camera at idx, configure it, and verify a frame reads."""
    try:
        cap = cv2.VideoCapture(idx)
        if not cap.isOpened():
            cap.release()
            return None, None
        cap.set(cv2.CAP_PROP_FRAME_WIDTH,  STREAM_WIDTH)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, STREAM_HEIGHT)
        cap.set(cv2.CAP_PROP_FPS, STREAM_FPS)
        ret, frame = cap.read()
        if ret and frame is not None:
            print(f"[Camera] ✅ Opened '{label}' at index {idx}")
            return cap, idx
        cap.release()
    except Exception as e:
        print(f"[Camera] Error opening index {idx}: {e}")
    return None, None


def open_camera() -> Tuple:
    """
    Open the best available camera, strictly preferring OBS Virtual Camera.

    Priority order:
      1. OBS Virtual Camera (by AVFoundation device name on macOS)
      2. Any other working camera index 0-9 (fallback)
    """
    # ── Step 1: Try OBS by name (macOS AVFoundation) ──────────────────────────
    obs_idx = _find_obs_index()
    if obs_idx is not None:
        cap, idx = _try_open(obs_idx, "OBS Virtual Camera")
        if cap is not None:
            return cap, idx
        print("[Camera] OBS index found but failed to open — trying fallback.")

    # ── Step 2: Scan all indices, skip the one we already tried ───────────────
    names = _list_avf_cameras()
    for idx in range(10):
        if idx == obs_idx:
            continue   # already tried
        label = names.get(idx, f"Camera {idx}")
        if "obs" in label.lower():
            # Another OBS-named device — try it first in the scan
            cap, opened_idx = _try_open(idx, label)
            if cap is not None:
                return cap, opened_idx

    # Any camera as last resort
    for idx in range(10):
        if idx == obs_idx:
            continue
        label = names.get(idx, f"Camera {idx}")
        cap, opened_idx = _try_open(idx, label)
        if cap is not None:
            print(f"[Camera] ⚠ Using fallback device '{label}' (OBS not available)")
            return cap, opened_idx

    print("[Camera] ❌ No usable camera found.")
    return None, None



def camera_thread():
    global latest_frame, cam_online, cam_info, stop_flag

    cap = None
    idx = None

    while not stop_flag:
        if cap is None or not cap.isOpened():
            cap, idx = open_camera()
            if cap is None:
                cam_online = False
                cam_info = {"index": None, "width": None, "height": None, "fps": None}
                time.sleep(2)
                continue

        ret, frame = cap.read()
        if not ret or frame is None:
            cam_online = False
            try:
                cap.release()
            except Exception:
                pass
            cap = None
            time.sleep(1)
            continue

        if frame.shape[1] != STREAM_WIDTH or frame.shape[0] != STREAM_HEIGHT:
            frame = cv2.resize(frame, (STREAM_WIDTH, STREAM_HEIGHT))

        ts = time.strftime("%Y-%m-%d %H:%M:%S")
        cv2.putText(
            frame,
            f"AgriTraceX | {ts}",
            (12, STREAM_HEIGHT - 14),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )

        with frame_lock:
            latest_frame = frame.copy()

        cam_online = True
        cam_info = {
            "index": idx,
            "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
            "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
            "fps": int(cap.get(cv2.CAP_PROP_FPS)) if cap.get(cv2.CAP_PROP_FPS) > 0 else STREAM_FPS,
        }


def generate_mjpeg():
    while True:
        with frame_lock:
            frame = latest_frame

        if frame is None:
            time.sleep(0.05)
            continue

        ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        if not ok:
            time.sleep(0.01)
            continue

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" +
            buf.tobytes() +
            b"\r\n"
        )
        time.sleep(1.0 / STREAM_FPS)


@app.route("/stream")
def stream():
    return Response(generate_mjpeg(), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/snapshot")
def snapshot():
    with frame_lock:
        frame = latest_frame
    if frame is None:
        return "Camera not ready", 503

    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
    if not ok:
        return "Encoding failed", 500

    # Embed GPS EXIF (no-op if unavailable or no fix)
    jpeg = embed_gps(buf.tobytes())

    with gps_lock:
        gps_snap = dict(gps_data)

    resp = Response(jpeg, mimetype="image/jpeg")
    resp.headers["X-GPS-Lat"]    = str(gps_snap.get("lat") or "")
    resp.headers["X-GPS-Lng"]    = str(gps_snap.get("lng") or "")
    resp.headers["X-GPS-Alt"]    = str(gps_snap.get("alt") or "")
    resp.headers["X-GPS-Valid"]  = str(gps_snap.get("valid", False))
    resp.headers["X-GPS-Source"] = gps_snap.get("source", "none")
    return resp


@app.route("/status")
def status():
    with gps_lock:
        gps_snap = dict(gps_data)
    return jsonify({
        "online":      cam_online,
        "camera":      cam_info,
        "gps":         gps_snap,
        "streamUrl":   f"http://localhost:{FLASK_PORT}/stream",
        "snapshotUrl": f"http://localhost:{FLASK_PORT}/snapshot",
        "timestamp":   time.strftime("%Y-%m-%dT%H:%M:%S"),
    })


@app.route("/gps", methods=["POST"])
def update_gps():
    """Optional HTTP endpoint — push GPS from ESP32 or any external source.
       POST JSON: {"lat": 30.9009, "lng": 75.8572, "alt": 215.0}
    """
    data = flask_request.get_json(force=True, silent=True) or {}
    try:
        lat = float(data["lat"])
        lng = float(data["lng"])
        alt = float(data.get("alt", 0))
        set_gps(lat, lng, alt, source=data.get("source", "api"))
        return jsonify({"ok": True, "lat": lat, "lng": lng, "alt": alt})
    except (KeyError, ValueError) as e:
        return jsonify({"ok": False, "error": str(e)}), 400


@app.after_request
def add_cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return resp


if __name__ == "__main__":
    print("=" * 52)
    print("AgriTraceX — OBS Virtual Camera Server")
    print("=" * 52)
    print(f"Stream URL : http://localhost:{FLASK_PORT}/stream")
    print(f"Snapshot   : http://localhost:{FLASK_PORT}/snapshot")
    print(f"Status API : http://localhost:{FLASK_PORT}/status")
    print("Starting camera detection...")
    print("=" * 52)

    t = threading.Thread(target=camera_thread, daemon=True)
    t.start()

    for _ in range(50):
        if latest_frame is not None:
            break
        time.sleep(0.1)

    if latest_frame is None:
        print("[WARN] No frame yet. Start OBS Virtual Camera and try again.")
    else:
        print(f"[OK] Camera active: {cam_info}")

    app.run(host="0.0.0.0", port=FLASK_PORT, threaded=True, debug=False)