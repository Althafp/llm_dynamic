import os
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|stimeout;5000000"

import cv2
import time
import pandas as pd
from datetime import datetime
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed

# === CONFIGURATION ===
EXCEL_PATH = r"guntur.xlsx"
USERNAME = "admin"

PASS_ANALYTICS = "Matrix@143"
PASS_OTHER = "Matrix143"

BASE_DIR = Path.cwd() / "images"
TODAY = datetime.now().strftime("%Y-%m-%d")
# NOW = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")

OUT_DIR = BASE_DIR / TODAY
OUT_DIR.mkdir(parents=True, exist_ok=True)

MAX_PROCESSES = 5
TIMEOUT = 3


def create_cam_folder(cam_type):
    folder = OUT_DIR / cam_type.upper()
    folder.mkdir(exist_ok=True)
    return folder


def timestamped_name(prefix, cam_type, ext="jpg"):
    folder = create_cam_folder(cam_type)
    now = datetime.now().strftime("%Y%m%d_%H%M%S")
    return folder / f"{prefix}_{now}.{ext}"


def capture_from_camera(cam_name, ip, password, cam_type, timeout=TIMEOUT):
    """Runs in child process."""
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

    if frame is not None:
        out_path = timestamped_name(f"{safe_name}_{ip.replace('.', '_')}", cam_type)
        cv2.imwrite(str(out_path), frame)
        print(f"[{cam_name}] ✅ Saved snapshot -> {out_path} | ⏱️ {elapsed:.2f}s")
        return (cam_name, True, elapsed)

    else:
        print(f"[{cam_name}] ❌ Failed to capture frame | ⏱️ {elapsed:.2f}s")
        return (cam_name, False, elapsed)


def main():
    print(f"📘 Reading Excel: {EXCEL_PATH}")
    df = pd.read_excel(EXCEL_PATH)
    df.columns = [c.strip().upper() for c in df.columns]

    # --- Detect important columns ---
    ip_col = next((c for c in df.columns if "IP" in c), None)
    if ip_col is None:
        ip_col = df.columns[7]

    cam_type_col = next((c for c in df.columns if "TYPE OF CAMERA" in c), None)
    if cam_type_col is None:
        raise ValueError("❌ 'TYPE OF CAMERA' column not found.")

    analytics_col = next((c for c in df.columns if "ANALYTIC" in c), None)
    if analytics_col is None:
        analytics_col = "TYPE OF ANALYTICS"

    # --- Filter only ANALYTICS, FIXED, PTZ ---
    allowed_types = ["ANALYTICS", "FIXED", "PTZ"]

    before = len(df)
    df = df[df[cam_type_col].astype(str).str.upper().isin(allowed_types)]

    after_filter = len(df)

    # --- Remove duplicate IPs ---
    df = df.drop_duplicates(subset=[ip_col])
    after_unique = len(df)

    print(f"🎯 Camera type filtering: {before} → {after_filter} (ANALYTICS/FIXED/PTZ only)")
    print(f"🔁 Unique IPs after removing duplicates: {after_unique}")

    # --- Process cameras ---
    total = 0
    success_count = 0
    fail_count = 0
    failed_entries = []
    futures = {}

    start_all = time.time()

    with ProcessPoolExecutor(max_workers=MAX_PROCESSES) as executor:
        for _, row in df.iterrows():

            ip = str(row[ip_col]).strip()
            if not ip or ip.lower() in ["nan", "none"]:
                continue

            cam_type = str(row.get(cam_type_col, "")).strip().upper()
            cam_name = str(row.get("LOCATION NAME", f"Cam_{ip}"))

            analytics_val = str(row.get(analytics_col, "")).lower()

            # --- PASSWORD RULES ---
            if "surveillance" in analytics_val:
                password = PASS_ANALYTICS        # override
            elif cam_type == "ANALYTICS":
                password = PASS_ANALYTICS
            else:
                password = PASS_OTHER

            future = executor.submit(
                capture_from_camera, cam_name, ip, password, cam_type
            )
            futures[future] = (cam_name, ip, cam_type)
            total += 1

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
                        "Capture Status": "Failed",
                        "Failure Time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    })

            except Exception as e:
                fail_count += 1
                failed_entries.append({
                    "Camera Name": cam_name,
                    "IP": ip,
                    "Camera Type": cam_type,
                    "Capture Status": "Failed",
                    "Error": str(e),
                    "Failure Time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                })

    # --- Save failed IPs ---
    if failed_entries:
        missing_df = pd.DataFrame(failed_entries)
        missing_path = OUT_DIR / "missing.xlsx"
        missing_df.to_excel(missing_path, index=False)
        print(f"\n📁 Missing IPs saved to: {missing_path}")
    else:
        print("\n✅ No missing IPs. All captures succeeded.")

    elapsed_total = time.time() - start_all

    print("\n📊 Capture Summary")
    print(f"Total Cameras Processed : {total}")
    print(f"✅ Successful Captures  : {success_count}")
    print(f"❌ Failed Captures      : {fail_count}")
    print(f"⏱️ Total Time Elapsed   : {elapsed_total:.2f}s")
    print("🏁 All captures complete.\n")


if __name__ == "__main__":
    main()
