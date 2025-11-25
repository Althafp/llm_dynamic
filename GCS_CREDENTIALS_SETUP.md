# 🔐 GCP Credentials Setup Guide

## Option 1: Environment Variable (Recommended for Deployment)

You can store the entire content of `gcs-key.json` in an environment variable called `GCS_CREDENTIALS_JSON`.

### Steps:

1. **Open `gcs-key.json`** and copy the entire content
2. **Convert to single line** (remove all line breaks and extra spaces)
3. **Set as environment variable** in your deployment platform

### Example:

**Original `gcs-key.json`:**
```json
{
  "type": "service_account",
  "project_id": "focus-cumulus-477711-g5",
  "private_key_id": "779f507d1ef965e9f96409e0b2cfccf5d0773cb2",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "cctv-storage-access@focus-cumulus-477711-g5.iam.gserviceaccount.com",
  ...
}
```

**As Environment Variable:**
```env
GCS_CREDENTIALS_JSON={"type":"service_account","project_id":"focus-cumulus-477711-g5","private_key_id":"779f507d1ef965e9f96409e0b2cfccf5d0773cb2","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"cctv-storage-access@focus-cumulus-477711-g5.iam.gserviceaccount.com",...}
```

### Quick Conversion (One-liner):

**On Windows (PowerShell):**
```powershell
# Read and convert to single line
$content = Get-Content gcs-key.json -Raw | ConvertFrom-Json | ConvertTo-Json -Compress
$content
# Copy the output and use it as GCS_CREDENTIALS_JSON value
```

**On Linux/Mac:**
```bash
# Read and convert to single line
cat gcs-key.json | jq -c .
# Copy the output and use it as GCS_CREDENTIALS_JSON value
```

**Or manually:**
1. Open `gcs-key.json` in a text editor
2. Select all (Ctrl+A / Cmd+A)
3. Copy (Ctrl+C / Cmd+C)
4. Paste into a JSON minifier (like https://jsonformatter.org/json-minify)
5. Copy the minified result
6. Use it as the value for `GCS_CREDENTIALS_JSON`

---

## Option 2: File Path (Alternative)

If you prefer to keep the file, use the `GOOGLE_APPLICATION_CREDENTIALS` environment variable:

```env
GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcs-key.json
```

**Note:** This requires the file to be accessible on the server, which may not be ideal for cloud deployments.

---

## Option 3: Local Development (Default)

For local development, the code will automatically look for `gcs-key.json` in the project root if no environment variables are set.

---

## Priority Order

The code checks credentials in this order:

1. ✅ `GCS_CREDENTIALS_JSON` environment variable (JSON content as string) - **BEST for deployment**
2. ✅ `GOOGLE_APPLICATION_CREDENTIALS` environment variable (path to file)
3. ✅ `gcs-key.json` file in project root (for local development)

---

## Setting in Deployment Platforms

### Vercel:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add new variable:
   - **Name:** `GCS_CREDENTIALS_JSON`
   - **Value:** (paste the minified JSON string)
   - **Environment:** Production, Preview, Development (select all)

### AWS / Other Platforms:
Set the environment variable `GCS_CREDENTIALS_JSON` with the minified JSON content.

---

## Security Notes

- ✅ **Never commit** `gcs-key.json` to git (already in `.gitignore`)
- ✅ **Never commit** `.env.local` with credentials
- ✅ Use environment variables in deployment platforms
- ✅ Rotate credentials if accidentally exposed

---

## Testing

After setting the environment variable, test locally:

```bash
# Set environment variable (PowerShell)
$env:GCS_CREDENTIALS_JSON = '{"type":"service_account",...}'

# Or create .env.local file
echo "GCS_CREDENTIALS_JSON={\"type\":\"service_account\",...}" > .env.local

# Test
npm run dev
```

The console should show:
```
✅ GCP Storage initialized from GCS_CREDENTIALS_JSON environment variable
```

