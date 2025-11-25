# Image Upload Script Instructions

## Overview
The `upload_to_gcs.py` script uploads all images from your local `images/` folder to the GCP Cloud Storage bucket `llm_dynamic`.

## Prerequisites
- Python 3.7+
- Google Cloud Storage library installed
- Valid `gcs-key.json` file in project root

## Installation

If you haven't already installed the dependencies:
```bash
pip install google-cloud-storage tqdm
```

Or use the requirements file:
```bash
pip install -r requirements-upload.txt
```

## Usage

Simply run the script:
```bash
python upload_to_gcs.py
```

## What it does

1. **Scans** the local `images/` directory recursively
2. **Finds** all image files (.jpg, .jpeg, .png, .gif, .bmp)
3. **Maintains** the folder structure: `images/YYYY-MM-DD/ANALYTICS|FIXED|PTZ/`
4. **Uploads** each image to the GCP bucket
5. **Skips** files that already exist (with same size)
6. **Shows** progress bar and summary

## Configuration

You can modify these variables in the script if needed:

```python
LOCAL_IMAGES_DIR = Path(r"D:\chandu sir\llm_dynamic_daily\images")
BUCKET_NAME = "llm_dynamic"
GCS_KEY_PATH = Path(r"D:\chandu sir\llm_dynamic_daily\gcs-key.json")
```

## Example Output

```
Initializing GCS client with key: D:\chandu sir\llm_dynamic_daily\gcs-key.json
Connected to bucket: llm_dynamic
Scanning local directory: D:\chandu sir\llm_dynamic_daily\images

Found 345 image files to upload

Uploading: 100%|████████████| 345/345 [02:15<00:00,  2.55file/s]

==================================================
Upload Summary:
  Total files: 345
  Uploaded: 345
  Skipped (already exists): 0
  Failed: 0
==================================================
```

## Notes

- The script preserves the exact folder structure from local to GCS
- Files are skipped if they already exist with the same size
- Only image files are uploaded (Excel files and other non-images are ignored)
- The script is safe to run multiple times (won't re-upload existing files)

