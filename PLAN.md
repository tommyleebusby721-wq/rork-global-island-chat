# Switch chat media to private bucket with short-lived signed URLs

## What changes

Right now, any image or voice note sent in chat lives in a **public** storage bucket — anyone with the URL can view it forever. We'll lock the bucket down so only signed-in users can read media, and the app will generate fresh short-lived viewing links on the fly.

## Features

- **Private media by default** — photos and voice notes can't be opened by just pasting the URL in a browser.
- **Short-lived viewing links** — when a chat bubble shows an image or plays a voice note, the app quietly requests a 1-hour access link behind the scenes.
- **Automatic refresh** — if a link expires while you're scrolling, it's regenerated on the next view.
- **In-memory cache** — once a link is generated for a message, it's reused across the session so scrolling stays fast.
- **Old messages** — any messages sent before this update will stop loading their media, but since all chat messages auto-expire after 24 hours, this clears itself out within a day.

## How it will feel

- No visible change to you — images and voice notes still appear instantly in chat.
- Slight delay the first time an image loads (a few hundred milliseconds to fetch the signed link), then instant on subsequent views.
- Uploads work exactly the same as today.

## Security improvement

- Storage bucket flipped to private.
- Read access requires being signed in; insert/update/delete still restricted to each user's own folder (unchanged).
- Leaked URLs become useless after 1 hour.

## What gets updated

- The stored storage setup file gets an updated policy block for reference/tracking.
- The media upload helper now returns the storage path (not a permanent public URL).
- A small helper generates signed URLs on demand with caching.
- Chat bubbles (image + voice player) use this helper to resolve the actual playback URL.

## Not changing

- Upload flow, file size limits, per-user quotas (5 photos / 10 voice).
- Message table schema — we'll keep the existing `image_uri` / `voice_uri` columns but store the storage path instead of the full URL going forward.
- The voice recording MIME-type fix and other recent changes stay as-is.