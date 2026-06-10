## Repository description

**Lyra** is a browser extension for Spotify Web Player that displays bilingual lyrics.

## Goal 
Build a simple and reliable lyrics extension that helps users view and understand Spotify lyrics in two languages while listening to music.

---

## Core Features
- Detect the currently playing Spotify track
- Fetch synced lyrics from LRCLIB
- Display two lyrics together
- Highlight the current lyric line during playback
- Provide basic display settings such as language, font size, and lyric position

---

## Local Startup

Use these commands when you need to start the app locally:

---

## Tech stack

Use these versions by default unless a task requires otherwise:

- Node.js 22 LTS
- Vite 8
- React 19
- TypeScript 6
- Tailwind CSS 4
- Playwright 1.59.1
- WXT
- Manifest V3
- RESTful style APIs
- Api:
  - LRCLIB

Do not upgrade major versions without a clear reason.

---

## Project rules

- In the development environment, set the frontend port to 5173
- Keep changes scoped to the correct package
- Follow RESTful conventions for API design
- A design guideline document (for example `DESIGN.md`) does not replace Tailwind. In frontend work, keep the design document as requirements and use Tailwind as the implementation layer
