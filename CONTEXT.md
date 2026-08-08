# Lyra

Lyra displays bilingual, synchronized lyrics inside Spotify Web Player. This
context records terms specific to the lyrics overlay experience.

## Language

**Cover Palette**:
The three safe colors derived from the current Now Playing cover and applied to
the lyrics background.
_Avoid_: theme, artwork colors

**Cover Color Fallback**:
Lyra's fixed Aurora palette used when no supported cover can produce a safe
Cover Palette.
_Avoid_: error theme, default artwork

**Dynamic Background**:
The user preference that enables Aurora motion; it does not decide whether the
background uses the current Cover Palette.
_Avoid_: cover color setting, theme toggle
