---
name: Tactile Papercraft & Sketchbook
colors:
  surface: '#f7f5ea'
  surface-dim: '#dddad0'
  surface-bright: '#fcf9ef'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f4ea'
  surface-container: '#f1eee4'
  surface-container-high: '#ebe8de'
  surface-container-highest: '#e5e2d9'
  on-surface: '#1e2126'
  on-surface-variant: '#756f65'
  inverse-surface: '#31312a'
  inverse-on-surface: '#f4f1e7'
  outline: '#1e2126'
  outline-variant: '#dfc0b5'
  primary: '#df6930'
  on-primary: '#ffffff'
  primary-container: '#c54f18'
  on-primary-container: '#fffbff'
  secondary: '#4a8c1f'
  on-secondary: '#ffffff'
  tertiary: '#52622d'
  on-tertiary: '#ffffff'
  error: '#c0392b'
  background: '#f7f5ea'
  on-background: '#1e2126'
  surface-variant: '#e5e2d9'
  grid-dot: '#d6d3d1'
  cover-gradient-start: '#d8e8b8'
  cover-gradient-end: '#a8cf78'
  ribbon-locked: '#a8a29e'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 56px
    fontWeight: '900'
    lineHeight: 62px
    letterSpacing: -0.05em
  display-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 36px
    fontWeight: '900'
    lineHeight: 42px
    letterSpacing: -0.05em
  display-card-num:
    fontFamily: Hanken Grotesk
    fontSize: 72px
    fontWeight: '900'
    lineHeight: 76px
    letterSpacing: -0.05em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 34px
    fontWeight: '900'
    lineHeight: 40px
    letterSpacing: -0.05em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 22px
    fontWeight: '800'
    lineHeight: 28px
    letterSpacing: -0.05em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 17px
    fontWeight: '500'
    lineHeight: 26px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '800'
    lineHeight: 20px
    letterSpacing: -0.05em
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 13px
    fontWeight: '700'
    lineHeight: 18px
    letterSpacing: -0.05em
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 11px
    fontWeight: '800'
    lineHeight: 16px
    letterSpacing: 0.08em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2.5rem
  space-xs: 0.375rem
  space-sm: 0.75rem
  space-md: 1.25rem
  space-lg: 2rem
---

## Brand & Style
This design system crafts a tactile, imaginative universe rooted in hands-on creativity. It fuses **Tactile Papercraft** with **Punchy Neobrutalism**:
- **Tangible Craftsmanship:** Inner dashed stitch lines, chevron ribbon pennants, and subtle paper mottling.
- **Graphic Contrast:** Heavy 3px ink outlines paired with crisp, **zero-blur hard offset drop shadows**. No synthetic blurs.
- **Approachable Spirit:** Punchy, tightly-tracked geometric titles (Hanken Grotesk), warm humanist body copy (Plus Jakarta Sans).

## Colors
- **Primary (`#df6930`):** Stitched terracotta craft orange. Forms the signature identity of cards, ribbons, and active buttons.
- **Ink (`#1e2126`):** Deep charcoal. Drives high-contrast borders, text, and hard comic shadows.
- **Secondary (`#4a8c1f`):** Earthy olive-mint. Used for success states, active toggles, and play icons.
- **Neutral (`#f7f5ea`):** Cream unbleached sketchbook paper for interior backgrounds, punctuated by grid dots (`#d6d3d1`).

## Elevation & Depth
- **Comic Hard Shadows:** Interactive cards and ribbons utilize zero-blur, solid offset drop shadows.
  - Small elements: `box-shadow: 3px 3px 0px #1e2126;`
  - Large elements: `box-shadow: 5px 5px 0px #1e2126;`
  - Click state: `transform: translate(1px, 1px); box-shadow: 2px 2px 0px #1e2126;`
- **Heavy Ink Strokes:** All physical foreground modules are bordered with solid `3px` ink contours (`#1e2126`).
- **Tactile Stitched Insets:** Primary orange surfaces incorporate an inner dashed perimeter (`2px dashed rgba(255, 255, 255, 0.4)`).

## Shapes
- **Cards & Pods:** Radii range from `1rem` to `1.5rem`.
- **Ribbon Chevron Notches:** Hanging level ribbons use: `clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 88%, 0 100%)`. **CRITICAL:** Use `filter: drop-shadow(5px 5px 0 #1e2126)` on the wrapper instead of `box-shadow`.
- **Pills:** Only used for toggles and status badges.

## Components
- **Buttons:** Solid background, Hanken Grotesk (weight 800), 3px ink border, `3px 3px 0` hard shadow.
- **Stitched Game Card:** Terracotta `#df6930`, 3px ink border, `5px 5px 0` hard shadow, inner dashed border. Cards can be rotated (`-3deg`, `+3deg`) for organic feel.
- **Toggle Switch:** Track `#1e2126` when OFF, `#4a8c1f` when ON. White circular knob.
- **Ribbon Level Pennants:** Active = `#df6930`, Locked = `#a8a29e`. Centered white circle token with play/lock icon.