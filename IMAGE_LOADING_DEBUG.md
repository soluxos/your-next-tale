# Image Loading Diagnostics

## Quick Check: Is Your Bucket Public?

### Test Your Image URLs

1. Open your browser console (F12)
2. Paste this code to test a book image:

```javascript
const testUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/YOUR_IMAGE_PATH.jpg`;
console.log("Testing URL:", testUrl);

fetch(testUrl).then((response) => {
  console.log("Status:", response.status);
  console.log("Headers:", Object.fromEntries(response.headers));
  if (response.ok) {
    console.log("✅ PUBLIC URL WORKS!");
  } else {
    console.log("❌ PUBLIC URL FAILED - Bucket might not be public");
  }
});
```

### Make Bucket Public (If Needed)

If the test fails, make your bucket public:

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **Storage** in left sidebar
4. Find your **"books"** bucket
5. Click the **three dots** (•••) menu
6. Select **"Make public"**
7. Confirm the action

### Alternative: Use Signed URLs (If Bucket Must Stay Private)

If you can't make the bucket public, revert to this approach:

```javascript
useEffect(() => {
  const loadImage = async () => {
    if (!cover_url) return;

    const supabase = await createClient();

    // Get signed URL (works for private buckets)
    const { data, error } = await supabase.storage
      .from("books")
      .createSignedUrl(cover_url, 3600); // 1 hour expiry

    if (error) {
      console.log("Error creating signed URL: ", error);
      return;
    }

    setCoverUrl(data.signedUrl);
  };

  loadImage();
}, [cover_url]);
```

**Note:** Signed URLs expire and need regeneration, so they're slower than public URLs.

## Performance Comparison

### Public URLs (Recommended)

- ⚡ Instant load
- ✅ Browser caching works
- ✅ CDN caching works
- ✅ No API calls
- Speed: **~50-200ms**

### Blob Downloads

- ⏱️ Slow load
- ❌ No browser caching
- ❌ No CDN caching
- ❌ API call for every image
- Speed: **~500-1000ms**

### Signed URLs

- 🔒 Secure but slower
- ⚠️ Limited caching (expires)
- ⚠️ API call for URL generation
- ⚠️ Needs regeneration
- Speed: **~300-600ms**

## Debugging Slow Images

### Check Network Tab

1. Open DevTools (F12)
2. Go to **Network** tab
3. Filter by **Img**
4. Reload the page
5. Look for your book images

**What to check:**

- **Status Code**: Should be `200 OK`
  - `403 Forbidden` = Bucket not public
  - `404 Not Found` = Wrong path
- **Size**: Should show actual file size
- **Time**: Should be < 500ms
- **From cache**: Good sign if you see this

### Check Console Errors

Look for errors like:

- `403 (Forbidden)` - Bucket not public
- `CORS error` - CORS not configured
- `Failed to load resource` - Wrong URL

### Test Public URL Format

Your URL should look like:

```
https://YOUR_PROJECT.supabase.co/storage/v1/object/public/books/path/to/image.jpg
```

**Not like:**

```
blob:http://localhost:3000/some-uuid
```

## Quick Fix

If images are slow, the fastest solution is:

1. **Make bucket public** (recommended for public book covers)
2. **Clear browser cache** (Cmd+Shift+R)
3. **Restart dev server** (`npm run dev`)

## Still Slow?

If images are still slow after making bucket public:

### Check Image File Sizes

```bash
# SSH into your server or check locally
ls -lh public/books/*.jpg
```

**Recommendations:**

- Book covers should be < 200KB
- Use JPEG or WebP format
- Max dimensions: 800x1200px

### Optimize Images

Use ImageMagick or similar:

```bash
# Resize and optimize
convert input.jpg -resize 600x900 -quality 85 output.jpg

# Convert to WebP (smaller)
cwebp -q 80 input.jpg -o output.webp
```

### Check Supabase Region

Images load faster when Supabase is in same region as users:

- Check your project region in Supabase Dashboard
- Consider multi-region CDN if global audience

## Common Issues

### Issue: Images work on localhost but not in production

**Fix:** Make sure `NEXT_PUBLIC_SUPABASE_URL` is set in production env vars

### Issue: Some images load, some don't

**Fix:** Check file paths in database match actual file names (case-sensitive!)

### Issue: Images show briefly then disappear

**Fix:** Cleanup blob URLs properly or use public URLs instead

### Issue: CORS errors

**Fix:** Supabase buckets should allow CORS by default, check bucket settings
