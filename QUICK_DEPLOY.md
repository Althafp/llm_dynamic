# ⚡ Quick Deployment Guide

## Essential Steps (5 Minutes)

### 1. Environment Variables (Required)
Set these in your deployment platform (Vercel/AWS/etc.):

```env
OPENAI_API_KEY=sk-your-key-here
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza-your-key-here

# GCP Credentials - Copy entire gcs-key.json content as single-line JSON string
GCS_CREDENTIALS_JSON={"type":"service_account","project_id":"...","private_key":"...",...}
```

**How to get GCS_CREDENTIALS_JSON:**
1. Open `gcs-key.json`
2. Copy the entire JSON content (all on one line)
3. Paste it as the value of `GCS_CREDENTIALS_JSON` environment variable

### 2. Required Files
- ✅ `guntur.xlsx` - Must be accessible (in project root or update path)
- ✅ `gcs-key.json` - **NOT NEEDED** if using `GCS_CREDENTIALS_JSON` env var (recommended)

### 3. Build Test
```bash
npm run build
npm run start  # Test locally
```

### 4. Deploy
- Push to GitHub
- Connect to Vercel/your platform
- Set environment variables
- Deploy!

---

## File Handling Options

### Option 1: Use Environment Variable (Recommended)
- Set `GCS_CREDENTIALS_JSON` with the entire JSON content (minified)
- See `GCS_CREDENTIALS_SETUP.md` for detailed instructions
- Add `guntur.xlsx` to git (it's just location data)

### Option 2: Include Files (Alternative)
- Upload `gcs-key.json` to secure storage on your platform
- Use `GOOGLE_APPLICATION_CREDENTIALS` env var pointing to the file path
- Add `guntur.xlsx` to git (it's just location data)

---

## Critical: Before First Deploy

1. ✅ Test build: `npm run build`
2. ✅ Test production: `npm run start`
3. ✅ Verify all API keys are set
4. ✅ Check `.gitignore` includes sensitive files
5. ✅ Test with real GCP images

---

## Common Deployment Platforms

### Vercel (Recommended)
```bash
npm i -g vercel
vercel login
vercel --prod
```

### AWS Amplify
- Connect GitHub repo
- Set environment variables
- Deploy automatically

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

