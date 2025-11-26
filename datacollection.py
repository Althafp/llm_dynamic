import os
import subprocess
import time
import pandas as pd
from datetime import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# ================================
# CONFIGURATION
# ================================
EXCEL_PATH = r"guntur.xlsx"
USERNAME = "admin"

PASS_ANALYTICS = "Matrix@143"
PASS_OTHER = "Matrix143"

BASE_DIR = Path.cwd() / "images"
TODAY = datetime.now().strftime("%Y-%m-%d")
OUT_DIR = BASE_DIR / TODAY
OUT_DIR.mkdir(parents=True, exist_ok=True)

MAX_THREADS = 30    # parallel cameras
FFMPEG_TIMEOUT = 7  # seconds


def create_cam_folder(cam_type):
    folder = OUT_DIR / cam_type.upper()
    folder.mkdir(exist_ok=True)
    return folder


def timestamped_name(cam_name, ip, cam_type):
    folder = create_cam_folder(cam_type)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    fname = f"{cam_name.replace(' ', '_')}_{ip.replace('.', '_')}_{ts}.jpg"
    return folder / fname


# ================================
# FAST FFMPEG SNAPSHOT FUNCTION
# ================================
def capture_ffmpeg(cam_name, ip, password, cam_type):
    start = time.time()

    rtsp_url = f"rtsp://{USERNAME}:{password}@{ip}:554/stream1"
    output_path = timestamped_name(cam_name, ip, cam_type)

    cmd = [
        "ffmpeg",
        "-rtsp_transport", "tcp",
        "-i", rtsp_url,
        "-frames:v", "1",
        "-q:v", "2",
        "-y",
        str(output_path)
    ]

    try:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=FFMPEG_TIMEOUT)
        elapsed = time.time() - start
        print(f"[{cam_name}] ✅ Saved -> {output_path} | {elapsed:.2f}s")
        return (cam_name, True, elapsed)
    except Exception as e:
        elapsed = time.time() - start
        print(f"[{cam_name}] ❌ Failed | {elapsed:.2f}s | {e}")
        return (cam_name, False, elapsed)


# ================================
# MAIN PIPELINE
# ================================
def main():
    print(f"📘 Reading Excel: {EXCEL_PATH}")
    df = pd.read_excel(EXCEL_PATH)
    df.columns = [c.strip().upper() for c in df.columns]

    ip_col = next((c for c in df.columns if "IP" in c), df.columns[7])
    cam_type_col = next((c for c in df.columns if "TYPE OF CAMERA" in c), None)
    analytics_col = next((c for c in df.columns if "ANALYTIC" in c), "TYPE OF ANALYTICS")

    allowed_types = ["ANALYTICS", "FIXED", "PTZ"]
    df = df[df[cam_type_col].astype(str).str.upper().isin(allowed_types)]
    df = df.drop_duplicates(subset=[ip_col])

    print(f"🔁 Total cameras: {len(df)}")

    failed = []
    total = success = failed_count = 0
    futures = {}

    start_all = time.time()

    with ThreadPoolExecutor(max_workers=MAX_THREADS) as executor:
        for _, row in df.iterrows():

            ip = str(row[ip_col]).strip()
            if not ip or ip.lower() == "nan":
                continue

            cam_type = str(row.get(cam_type_col, "")).strip().upper()
            cam_name = str(row.get("LOCATION NAME", f"Cam_{ip}")).strip()
            analytics_val = str(row.get(analytics_col, "")).lower()

            # password rules
            if "surveillance" in analytics_val:
                password = PASS_ANALYTICS
            elif cam_type == "ANALYTICS":
                password = PASS_ANALYTICS
            else:
                password = PASS_OTHER

            future = executor.submit(capture_ffmpeg, cam_name, ip, password, cam_type)
            futures[future] = (cam_name, ip, cam_type)
            total += 1

        for f in as_completed(futures):
            cam_name, ip, cam_type = futures[f]
            name, ok, elapsed = f.result()

            if ok:
                success += 1
            else:
                failed_count += 1
                failed.append({
                    "Camera Name": cam_name,
                    "IP": ip,
                    "Camera Type": cam_type,
                    "Failed At": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                })

    if failed:
        pd.DataFrame(failed).to_excel(OUT_DIR / "missing.xlsx", index=False)
        print(f"📁 Saved failed IPs -> {OUT_DIR / 'missing.xlsx'}")

    print("\n📊 Summary")
    print(f"Total Cameras : {total}")
    print(f"Success       : {success}")
    print(f"Failed        : {failed_count}")
    print(f"Total Time    : {time.time() - start_all:.2f}s")


if __name__ == "__main__":
    main()
