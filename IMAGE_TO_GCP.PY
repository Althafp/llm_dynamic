import os
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = (
    "rtsp_transport;tcp|stimeout;2000000|rw_timeout;2000000|max_delay;2000000"
)

import cv2
import time
import pandas as pd
from datetime import datetime
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed
from google.cloud import storage
import io

# ================================
# CONFIGURATION
# ================================
EXCEL_PATH = r"Chittoor.xlsx"
USERNAME = "admin"

PASS_ANALYTICS = "Matrix@143"
PASS_OTHER = "Matrix143"

# GCP Settings
BUCKET_NAME = "llm_dynamic"
GCS_KEY_PATH = r"D:\chandu sir\llm_dynamic_daily\gcs-key.json"

# Cloud structure
S = "CHITTOR"                       # SITE NAME
TODAY = datetime.now().strftime("%Y-%m-%d")
DATE_FOLDER = f"{TODAY}_{S}" if S else TODAY

MAX_PROCESSES = 40
TIMEOUT = 3

# Initialize GCS
print(f"Initializing GCS client with key: {GCS_KEY_PATH}")
gcs_client = storage.Client.from_service_account_json(GCS_KEY_PATH)
bucket = gcs_client.bucket(BUCKET_NAME)

if not bucket.exists():
    print(f"❌ ERROR: GCP Bucket '{BUCKET_NAME}' does not exist.")
    exit(1)

print(f"✔ Connected to bucket: {BUCKET_NAME}\n")


# ============================================
# Helper: Upload image bytes directly to GCS
# ============================================
def upload_image_bytes_to_gcs(image_bytes, cam_type, filename):
    """
    Upload JPEG bytes directly to GCS without saving locally.
    """
    gcs_path = f"images/{DATE_FOLDER}/{cam_type}/{filename}"
    blob = bucket.blob(gcs_path)

    try:
        blob.upload_from_string(image_bytes, content_type="image/jpeg")
        return True
    except Exception as e:
        print(f"❌ Failed GCS upload {gcs_path}: {e}")
        return False


# ============================================
# Camera capture function
# ============================================
def capture_from_camera(cam_name, ip, password, cam_type, timeout=TIMEOUT):
    start_total = time.time()
    rtsp_url = f"rtsp://{USERNAME}:{password}@{ip}:554/stream1"
    print(f"[{cam_name}] Connecting -> {rtsp_url}")

    cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
    if not cap.isOpened():
        cap = cv2.VideoCapture(rtsp_url)

    frame = None
    start = time.time()
    while time.time() - start < timeout:
        ret, frame = cap.read()
        if ret and frame is not None:
            break
        time.sleep(0.2)

    cap.release()
    elapsed = time.time() - start_total

    safe_name = cam_name.replace(" ", "_").replace(",", "")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{safe_name}_{ip.replace('.', '_')}_{timestamp}.jpg"

    if frame is None:
        print(f"[{cam_name}] ❌ Failed Capture | {elapsed:.2f}s")
        return (cam_name, False, elapsed)

    # Encode frame to JPEG bytes
    ok, jpeg_bytes = cv2.imencode(".jpg", frame)
    if not ok:
        print(f"[{cam_name}] ❌ Failed to encode image")
        return (cam_name, False, elapsed)

    # Upload to GCP bucket
    uploaded = upload_image_bytes_to_gcs(jpeg_bytes.tobytes(), cam_type, filename)

    if uploaded:
        print(f"[{cam_name}] ✅ Uploaded to GCS as {filename} | {elapsed:.2f}s")
        return (cam_name, True, elapsed)

    else:
        print(f"[{cam_name}] ❌ Upload Failed | {elapsed:.2f}s")
        return (cam_name, False, elapsed)


# ============================================
# MAIN
# ============================================
def main():
    print(f"📘 Reading Excel: {EXCEL_PATH}")
    df = pd.read_excel(EXCEL_PATH)
    df.columns = [c.strip().upper() for c in df.columns]

    ip_col = next((c for c in df.columns if "IP" in c), df.columns[7])
    cam_type_col = next((c for c in df.columns if "TYPE OF CAMERA" in c), None)

    if cam_type_col is None:
        raise ValueError("❌ TYPE OF CAMERA column not found.")

    analytics_col = next((c for c in df.columns if "ANALYTIC" in c), "TYPE OF ANALYTICS")

    # Filter ANALYTICS / FIXED / PTZ
    allowed_types = ["ANALYTICS", "FIXED", "PTZ"]
    df = df[df[cam_type_col].astype(str).str.upper().isin(allowed_types)]
    df = df.drop_duplicates(subset=[ip_col])

    print(f"✔ Total Cameras: {len(df)}\n")

    futures = {}
    failed_entries = []
    success_count = 0
    fail_count = 0

    with ProcessPoolExecutor(max_workers=MAX_PROCESSES) as executor:
        for _, row in df.iterrows():

            ip = str(row[ip_col]).strip()
            if not ip:
                continue

            cam_type = str(row[cam_type_col]).strip().upper()
            cam_name = str(row.get("LOCATION NAME", f"Cam_{ip}"))
            analytics_val = str(row.get(analytics_col, "")).lower()

            # Password logic
            if "surveillance" in analytics_val or cam_type == "ANALYTICS":
                password = PASS_ANALYTICS
            else:
                password = PASS_OTHER

            future = executor.submit(capture_from_camera, cam_name, ip, password, cam_type)
            futures[future] = (cam_name, ip, cam_type)

        for f in as_completed(futures):
            cam_name, ip, cam_type = futures[f]

            try:
                cam_name, ok, elapsed = f.result()
                if ok:
                    success_count += 1
                else:
                    fail_count += 1
                    failed_entries.append({
                        "Camera Name": cam_name,
                        "IP": ip,
                        "Camera Type": cam_type,
                        "Capture": "Failed",
                        "Time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    })

            except Exception as e:
                fail_count += 1
                failed_entries.append({
                    "Camera Name": cam_name,
                    "IP": ip,
                    "Camera Type": cam_type,
                    "Capture": "Error",
                    "Error": str(e),
                    "Time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                })

    # Save failed report locally
    if failed_entries:
        pd.DataFrame(failed_entries).to_excel("missing.xlsx", index=False)
        print("\n📁 Missing.xlsx saved locally.")

    print("\n===== SUMMARY =====")
    print(f"Total Cameras: {len(df)}")
    print(f"Uploaded: {success_count}")
    print(f"Failed : {fail_count}")
    print("====================\n")


if __name__ == "__main__":
    main()
