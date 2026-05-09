# Send photos & videos in chats with swipeable full-screen viewer

## What you'll be able to do

- **Send videos** alongside photos in island group chats and private DMs
- **Send multiple items at once** — pick several photos/videos from your library
- **Tap any media in chat** to open a full-screen preview
- **Swipe left/right** through every photo and video in that conversation, just like WhatsApp
- **Tap play** on videos in the full-screen viewer to watch them
- **Pinch-to-zoom** on photos in the full-screen viewer
- Close the viewer by swiping down or tapping the X

## Design

- Video bubbles look just like photo bubbles, with a rounded thumbnail and a centered play button overlay
- Small duration badge in the corner of each video thumbnail (e.g. "0:12")
- Full-screen viewer uses a pure black background for an immersive feel
- Smooth fade + zoom-in animation when opening, swipe-to-dismiss when closing
- Page indicator dots at the bottom so you know where you are in the gallery
- Caption (if any) shown over the bottom of the image, like WhatsApp
- Sender name and timestamp at the top of the viewer

## Behind the scenes

- Videos are compressed and uploaded to your existing media storage, with the same per-user quota system used for photos
- Videos auto-pause when you swipe to a different item, so only one plays at a time
- Old videos rotate out automatically once a user goes over their limit (same as photos today)

## How it shows up

- **Chat screen (island & DM)**: the existing "send image" sheet becomes a "send media" sheet with options for Photo, Video, and Library (multi-select)
- **New full-screen media viewer**: opens on top of the chat when you tap any photo or video, lets you swipe through every photo/video shared in that room

