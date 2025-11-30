"""
Upload all images from local folder to GCP Cloud Storage bucket.
Maintains the folder structure: images/YYYY-MM-DD_location/ANALYTICS|FIXED|PTZ/
Supports both old format (YYYY-MM-DD) and new format (YYYY-MM-DD_location)
"""

import os
from pathlib import Path
from google.cloud import storage
from tqdm import tqdm

# Configuration
LOCAL_IMAGES_DIR = Path(r"D:\chandu sir\llm_dynamic_daily\images\2025-11-26")
BUCKET_NAME = "llm_dynamic"
GCS_KEY_PATH = Path(r"D:\chandu sir\llm_dynamic_daily\gcs-key.json")

# Image extensions to upload
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp'}


def upload_images_to_gcs():
    """Upload all images from local directory to GCP Cloud Storage."""
    
    # Initialize GCS client
    print(f"Initializing GCS client with key: {GCS_KEY_PATH}")
    client = storage.Client.from_service_account_json(str(GCS_KEY_PATH))
    bucket = client.bucket(BUCKET_NAME)
    
    # Check if bucket exists
    if not bucket.exists():
        print(f"Error: Bucket '{BUCKET_NAME}' does not exist!")
        return
    
    print(f"Connected to bucket: {BUCKET_NAME}")
    print(f"Scanning local directory: {LOCAL_IMAGES_DIR}\n")
    
    # Collect all image files
    image_files = []
    for root, dirs, files in os.walk(LOCAL_IMAGES_DIR):
        for file in files:
            file_path = Path(root) / file
            if file_path.suffix.lower() in IMAGE_EXTENSIONS:
                # Get relative path from images directory
                # Folder name can be either "2025-11-25" or "2025-11-25_chittoor"
                DATE_FOLDER_NAME = LOCAL_IMAGES_DIR.name

                rel_path = file_path.relative_to(LOCAL_IMAGES_DIR)

                # Ensure uploaded path is images/<DATE> or images/<DATE_location>/<subfolders>
                gcs_path = f"images/{DATE_FOLDER_NAME}/{rel_path.as_posix()}"

                image_files.append((file_path, gcs_path))
    
    if not image_files:
        print("No image files found to upload!")
        return
    
    print(f"Found {len(image_files)} image files to upload\n")
    
    # Upload files with progress bar
    uploaded = 0
    skipped = 0
    failed = 0
    
    for local_path, gcs_path in tqdm(image_files, desc="Uploading", unit="file"):
        try:
            # Check if file already exists in bucket
            blob = bucket.blob(gcs_path)
            if blob.exists():
                # Compare file sizes to decide if we should skip
                local_size = local_path.stat().st_size
                remote_size = blob.size
                if local_size == remote_size:
                    skipped += 1
                    continue
            
            # Upload the file
            blob.upload_from_filename(str(local_path))
            uploaded += 1
            
        except Exception as e:
            print(f"\nError uploading {local_path}: {e}")
            failed += 1
    
    # Print summary
    print("\n" + "="*50)
    print("Upload Summary:")
    print(f"  Total files: {len(image_files)}")
    print(f"  Uploaded: {uploaded}")
    print(f"  Skipped (already exists): {skipped}")
    print(f"  Failed: {failed}")
    print("="*50)


if __name__ == "__main__":
    # Check if local directory exists
    if not LOCAL_IMAGES_DIR.exists():
        print(f"Error: Local images directory not found: {LOCAL_IMAGES_DIR}")
        exit(1)
    
    # Check if GCS key file exists
    if not GCS_KEY_PATH.exists():
        print(f"Error: GCS key file not found: {GCS_KEY_PATH}")
        exit(1)
    
    try:
        upload_images_to_gcs()
    except Exception as e:
        print(f"\nFatal error: {e}")
        exit(1)

