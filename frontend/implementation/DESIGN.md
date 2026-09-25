---
name: Atmospheric Precision
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f4'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#3f4a3a'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#6f7a69'
  outline-variant: '#becab6'
  surface-tint: '#006e00'
  primary: '#006400'
  on-primary: '#ffffff'
  primary-container: '#008000'
  on-primary-container: '#ccffba'
  inverse-primary: '#72de5e'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e2e2e2'
  on-secondary-container: '#646464'
  tertiary: '#a01865'
  on-tertiary: '#ffffff'
  tertiary-container: '#c0367e'
  on-tertiary-container: '#ffecf1'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#8dfb77'
  primary-fixed-dim: '#72de5e'
  on-primary-fixed: '#002200'
  on-primary-fixed-variant: '#005300'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c6'
  on-secondary-fixed: '#1b1b1b'
  on-secondary-fixed-variant: '#474747'
  tertiary-fixed: '#ffd9e5'
  tertiary-fixed-dim: '#ffb0cf'
  on-tertiary-fixed: '#3d0023'
  on-tertiary-fixed-variant: '#8c0056'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
  environmental-green: '#008000'
  structural-black: '#000000'
  pure-white: '#FFFFFF'
  surface-gray: '#F5F5F5'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 64px
    fontWeight: '700'
    lineHeight: 72px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Fira Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Fira Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
  max-width: 1280px
---

## Brand & Style

The brand identity centers on the intersection of industrial reliability and environmental harmony. It targets a professional audience that values technical excellence, air quality, and sustainable engineering. The emotional response should be one of profound clarity, freshness, and structural integrity.

This design system utilizes a **Modern Corporate** style with **Minimalist** tendencies. It leverages high-contrast layouts and precision-engineered white space to evoke a sense of breathable air and mechanical efficiency. The aesthetic is clinical yet grounded, emphasizing legibility and functional hierarchy over decorative flourishes.

## Colors

The palette is anchored by "Environmental Green," representing growth and sustainability, and "Structural Black," which provides the weight of industrial authority.

- **Primary (Green):** Used for key calls-to-action, environmental status indicators, and brand-defining accents.
- **Secondary (Black):** Reserved for primary navigation, heavy headings, and high-contrast UI shells.
- **Surface & Backgrounds:** The interface relies heavily on pure white to represent cleanliness and "air." Use subtle off-white (`#F5F5F5`) for container segmentation without introducing visual clutter.
- **Text:** Headings are strictly black. Body copy should utilize a slightly softened black (90% opacity) to maintain readability over long technical documents.

## Typography

The typography strategy pairs **Hanken Grotesk** for structural elements and **Fira Sans** for technical descriptions. This combination ensures a balance between sharp, contemporary branding and highly legible, humanist body text.

- **Scale:** Large display sizes should use tight letter spacing to create a compact, "machine-finished" look.
- **Hierarchy:** Use bold weights for headers to contrast against the airy white space.
- **Labels:** Use uppercase with increased tracking for technical labels and metadata to differentiate from prose.

## Layout & Spacing

This design system employs a **Fixed Grid** model on desktop and a **Fluid Grid** on mobile.

- **Desktop:** A 12-column grid with a 1280px max-width. Content is centered with generous 64px margins to emphasize the minimalist aesthetic.
- **Mobile:** A 4-column grid with 16px margins. 
- **Rhythm:** All spacing (padding, margins) must be increments of the 8px base unit. 
- **White Space:** Intentionally use "over-sized" vertical padding between sections (80px to 120px) to simulate a sense of openness and breathability.

## Elevation & Depth

To maintain a clean and professional appearance, this design system avoids heavy shadows. Depth is communicated through **Tonal Layers** and **Low-contrast Outlines**.

- **Surface Levels:** The base level is pure white. Secondary containers use a 1px border (`#E0E0E0`) rather than a shadow.
- **Hover States:** Subtle shifts in background color (White to `#F5F5F5`) or a thin 2px primary-colored border represent interaction.
- **Overlays:** Only use high-elevation shadows (large blur, low opacity) for critical modal windows to ensure they appear to "float" above the technical data layers.

## Shapes

The shape language is **Soft (0.25rem)**. This slight rounding takes the edge off the industrial aesthetic, making the technology feel more approachable and modern without losing its professional precision. 

- **Buttons:** Use `rounded-sm` for a sharp, disciplined look.
- **Cards:** Use `rounded-lg` (0.5rem) to differentiate large layout blocks from smaller UI elements.
- **Iconography:** Use line icons with consistent 2px stroke weights and slightly rounded terminals to match the font geometry.

## Components

- **Buttons:** Primary buttons are Structural Black with White text. Hover states trigger the Environmental Green background. Secondary buttons use a 1px Black outline.
- **Inputs:** Fields are rectangular with 1px light gray borders. On focus, the border transitions to a 2px Structural Black stroke.
- **Cards:** White background with a 1px border (`#EEEEEE`). No shadow. Titles should be Hanken Grotesk Semibold.
- **Chips:** Small, rectangular tags with `label-sm` typography. Used for categorizing air systems or technical specifications.
- **Data Lists:** Use alternating row highlights or simple hair-line dividers to maintain a spreadsheet-like clarity for technical specs.
- **Specialty Component (Air Status):** A dedicated status indicator utilizing a pulsing Environmental Green glow to signal active system health.