# 🚀 Pre-Deployment Checklist

## 1. Environment Variables Setup

### Required Environment Variables

Create a `.env.local` file (or set in your deployment platform):

```env
# OpenAI API Key
OPENAI_API_KEY=sk-...

# Google Maps API Key (for map view)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...

# GCP Credentials - Option 1: JSON content as string (RECOMMENDED for deployment)
# Copy the entire content of gcs-key.json and paste it here (as a single line)
GCS_CREDENTIALS_JSON={"type":"service_account","project_id":"...","private_key":"...",...}

# GCP Credentials - Option 2: Path to credentials file (alternative)
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcs-key.json
```

**Note**: For `GCS_CREDENTIALS_JSON`, copy the entire JSON content from `gcs-key.json` and paste it as a single-line string. The code will automatically parse it.

### Important Notes:
- ✅ **Never commit** `.env.local` or `gcs-key.json` to git
- ✅ Add them to `.gitignore`
- ✅ Set these as environment variables in your deployment platform (Vercel, AWS, etc.)

---

## 2. GCP Credentials & Files

### Files to Secure:
- ✅ `gcs-key.json` - GCP service account key (NEVER commit to git)
- ✅ `guntur.xlsx` - Location mapping file (needed for map view)

### Actions:
- [ ] Verify `gcs-key.json` has correct permissions
- [ ] Ensure GCP bucket `llm_dynamic` is accessible
- [ ] Verify `guntur.xlsx` is in project root (or update path in code)
- [ ] Test GCP connection in production environment

---

## 3. Build & Test

### Build Commands:
```bash
# Test production build locally
npm run build

# Test production server locally
npm run start
```

### Checklist:
- [ ] Run `npm run build` - should complete without errors
- [ ] Run `npm run start` - test production build locally
- [ ] Test all pages: Dashboard, Analysis, Results
- [ ] Test image analysis functionality
- [ ] Test map view with Google Maps API
- [ ] Verify all API routes work correctly

---

## 4. Code Quality

### Linting:
```bash
npm run lint
```

- [ ] Fix all linting errors
- [ ] Remove console.log statements (or use proper logging)
- [ ] Remove commented-out code
- [ ] Verify TypeScript types are correct

---

## 5. Security Checklist

- [ ] **API Keys**: All API keys in environment variables (not hardcoded)
- [ ] **GCP Key**: `gcs-key.json` is in `.gitignore` and not committed
- [ ] **Environment Files**: `.env.local` is in `.gitignore`
- [ ] **Sensitive Data**: No hardcoded credentials in code
- [ ] **CORS**: Configure CORS if needed for your domain
- [ ] **Rate Limiting**: Consider adding rate limiting for API routes

---

## 6. File Structure

### Files to Include:
- ✅ `guntur.xlsx` - Location mapping (needed for map view)
- ✅ All source files in `src/`
- ✅ `package.json` and `package-lock.json`
- ✅ `next.config.ts`
- ✅ `tsconfig.json`

### Files to Exclude (via .gitignore):
- ❌ `gcs-key.json` - Use environment variable or secure storage
- ❌ `.env.local` - Use deployment platform's environment variables
- ❌ `node_modules/` - Will be installed during build
- ❌ `.next/` - Build output
- ❌ `images/` - Local test images (already in GCP)

---

## 7. Dependencies

### Verify All Dependencies:
```bash
npm install
```

- [ ] All dependencies are in `package.json`
- [ ] No missing dependencies
- [ ] Check for security vulnerabilities: `npm audit`
- [ ] Update outdated packages if needed

---

## 8. Next.js Configuration

### Check `next.config.ts`:
- [ ] Server components external packages configured
- [ ] No Turbopack issues (if using)
- [ ] Output mode set correctly (if needed)

---

## 9. API Routes Testing

Test all API endpoints:
- [ ] `/api/images/list` - List dates and images
- [ ] `/api/images/url` - Get signed URLs
- [ ] `/api/analyze` - Batch analysis
- [ ] `/api/analyze/stream` - Streaming analysis
- [ ] `/api/analytics` - Analytics generation
- [ ] `/api/results/list` - List previous results
- [ ] `/api/results/get` - Get specific result
- [ ] `/api/locations/mapping` - Location mapping

---

## 10. Performance Optimization

- [ ] Remove unnecessary console.logs
- [ ] Optimize image loading (if needed)
- [ ] Check bundle size: `npm run build` shows bundle analysis
- [ ] Consider adding loading states for better UX
- [ ] Test with large number of images (100+)

---

## 11. Error Handling

- [ ] All API routes have proper error handling
- [ ] User-friendly error messages
- [ ] Fallback mechanisms (e.g., base64 fallback for signed URLs)
- [ ] Proper HTTP status codes

---

## 12. Browser Compatibility

Test in:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (if needed)
- [ ] Mobile browsers (if needed)

---

## 13. Deployment Platform Specific

### For Vercel:
- [ ] Connect GitHub repository
- [ ] Set environment variables in Vercel dashboard
- [ ] Upload `guntur.xlsx` as a file (or use Vercel file storage)
- [ ] Configure `gcs-key.json` via environment variable or secure storage
- [ ] Set build command: `npm run build`
- [ ] Set output directory: `.next`

### For AWS/Other Platforms:
- [ ] Configure environment variables
- [ ] Set up file storage for `guntur.xlsx` and `gcs-key.json`
- [ ] Configure Node.js runtime
- [ ] Set up proper file permissions

---

## 14. Post-Deployment Testing

After deployment:
- [ ] Test dashboard loads correctly
- [ ] Test image analysis works
- [ ] Test map view displays correctly
- [ ] Test previous results page
- [ ] Verify GCP connection works
- [ ] Check console for errors
- [ ] Test with real images from GCP

---

## 15. Monitoring & Logging

Consider adding:
- [ ] Error tracking (Sentry, etc.)
- [ ] Analytics (Google Analytics, etc.)
- [ ] Performance monitoring
- [ ] API usage monitoring

---

## Quick Deployment Commands

```bash
# 1. Install dependencies
npm install

# 2. Build for production
npm run build

# 3. Test production build locally
npm run start

# 4. Deploy (platform-specific)
# Vercel: vercel --prod
# AWS: Follow AWS deployment guide
# Other: Follow platform-specific guide
```

---

## Critical Files Checklist

Before deploying, ensure these are set up:

- [ ] `.env.local` with all required keys (or set in deployment platform)
- [ ] `gcs-key.json` accessible (via environment or secure storage)
- [ ] `guntur.xlsx` accessible (in project root or configured path)
- [ ] `.gitignore` includes sensitive files
- [ ] All environment variables set in deployment platform

---

## Common Issues & Solutions

### Issue: "Cannot find module 'gcs-key.json'"
**Solution**: Upload `gcs-key.json` to deployment platform or use `GOOGLE_APPLICATION_CREDENTIALS` environment variable

### Issue: "Cannot find module 'guntur.xlsx'"
**Solution**: Ensure `guntur.xlsx` is in project root or update path in `/api/locations/mapping/route.ts`

### Issue: "Google Maps API key not configured"
**Solution**: Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in environment variables

### Issue: "OpenAI API key not found"
**Solution**: Set `OPENAI_API_KEY` in environment variables

---

## Final Checklist

- [ ] All environment variables configured
- [ ] Build completes successfully
- [ ] All tests pass
- [ ] Security review completed
- [ ] Files properly excluded from git
- [ ] Documentation updated
- [ ] Ready for deployment! 🚀

