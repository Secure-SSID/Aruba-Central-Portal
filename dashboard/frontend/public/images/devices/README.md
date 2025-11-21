# Device Images

This directory contains device images matched by part number.

## Adding Device Images

1. **Image Naming**: Name images using the device's part number (e.g., `JL679A.jpg`)
   - Example: For part number `JL679A`, save as `JL679A.jpg` or `JL679A.png`

2. **Supported Formats**: 
   - `.jpg` / `.jpeg`
   - `.png`
   - `.webp` (recommended for best compression)

3. **Image Optimization**:
   - Recommended max width: 800px
   - Recommended file size: < 200KB per image
   - Use WebP format when possible for best compression
   - **Remove backgrounds**: Images should have transparent backgrounds (use PNG with transparency or remove background before uploading)
   - Tools: Use image optimization tools like ImageOptim, TinyPNG, or Squoosh
   - Background removal tools: Remove.bg, Photopea, or GIMP

4. **Example**:
   - Device with part number `JL679A` → Save as `JL679A.jpg`
   - Device with part number `CN26KNN2YQ` → Save as `CN26KNN2YQ.jpg`

## Image Matching

The application will automatically match images based on the device's `partNumber` field. If an image is not found, no image will be displayed (graceful fallback).

