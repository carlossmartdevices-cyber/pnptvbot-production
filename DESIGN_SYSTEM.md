# PNPtv Unified Design System

## Overview

A comprehensive unified design system has been implemented across all PNPtv HTML applications, ensuring consistent visual branding, typography, and user experience.

---

## Design System Components

### 1. **Unified CSS Framework**
**File:** `/public/unified-design.css`

A centralized CSS file containing:
- Global color palette with CSS variables
- Typography standards
- Button styles and states
- Card and container components
- Form elements styling
- Utility classes
- Animation library
- Responsive design breakpoints

### 2. **Typography**

#### **Title Font: BBH Bartle**
- **Font Family:** `"BBH Bartle", sans-serif`
- **Weight:** 400 (Regular)
- **Usage:** All heading levels (h1-h6)
- **Characteristics:** Clean, elegant, distinctive design element

```css
.bbh-bartle-regular {
  font-family: "BBH Bartle", sans-serif;
  font-weight: 400;
  font-style: normal;
}
```

#### **Body Font: Roboto**
- **Font Family:** `"Roboto", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`
- **Weights:** 300, 400, 500, 700
- **Usage:** All body text, paragraphs, descriptions
- **Characteristics:** Modern, highly readable, excellent for screens

---

## Color Palette

### Primary Colors
```
--primary-color: #667eea (Purple)
--primary-dark: #764ba2 (Dark Purple)
--primary-light: #8b9dff (Light Purple)
```

### Accent Colors
```
--accent-gold: #ffd700 (Gold - CTAs, highlights)
--accent-green: #38ef7d (Green - Success states)
--accent-red: #ff4444 (Red - Errors, warnings)
--accent-orange: #ffaa00 (Orange - Secondary CTAs)
```

### Neutral Colors
```
--text-light: #ffffff (Primary text on dark backgrounds)
--text-dark: #333333 (Primary text on light backgrounds)
--text-muted: #999999 (Secondary/disabled text)
--bg-dark: #1a1a1a (Dark background)
--bg-darker: #0d0d0d (Darkest background)
--bg-light: #f5f5f5 (Light background)
```

### Gradients
```
--gradient-primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
--gradient-secondary: linear-gradient(135deg, #11998e 0%, #38ef7d 100%)
--gradient-warm: linear-gradient(135deg, #f093fb 0%, #f5576c 100%)
--gradient-sunset: linear-gradient(135deg, #ff6b6b 0%, #ffd700 100%)
```

---

## Component Library

### Buttons

#### Primary Button
```html
<button class="btn btn-primary">PAGAR AHORA</button>
```
- Purple gradient background
- White text with uppercase styling
- Elevation on hover

#### Accent Button (CTA)
```html
<button class="btn btn-accent">PAY NOW</button>
```
- Gold to orange gradient
- Dark text for contrast
- Enhanced shadow effect

#### Secondary Button
```html
<button class="btn btn-secondary">Activate</button>
```
- Green gradient background
- Used for success/confirmation actions

#### Outline Button
```html
<button class="btn btn-outline">Learn More</button>
```
- Transparent background with purple border
- Inverts on hover

### Cards
```html
<div class="card">
  <h3>Feature Title</h3>
  <p>Feature description goes here</p>
</div>
```
- Semi-transparent white background
- Frosted glass effect (backdrop blur)
- Elevation on hover

### Form Elements
```html
<input type="text" placeholder="Enter text...">
<textarea placeholder="Your message..."></textarea>
```
- Semi-transparent background
- Focus states with purple glow
- Consistent padding and border radius

---

## Spacing System

```
--spacing-xs: 4px
--spacing-sm: 8px
--spacing-md: 16px
--spacing-lg: 24px
--spacing-xl: 32px
--spacing-2xl: 48px
```

### Usage
```css
.element {
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-md);
}
```

---

## Border Radius Scale

```
--radius-sm: 4px (Subtle)
--radius-md: 8px (Standard inputs)
--radius-lg: 12px (Cards, buttons)
--radius-xl: 16px (Large components)
--radius-2xl: 24px (Hero sections)
--radius-full: 9999px (Pill buttons)
```

---

## Shadow System

```
--shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.1)
--shadow-md: 0 4px 8px rgba(0, 0, 0, 0.15)
--shadow-lg: 0 10px 30px rgba(0, 0, 0, 0.3)
--shadow-xl: 0 15px 40px rgba(0, 0, 0, 0.4)
```

---

## Animations

### Keyframe Animations
- `fadeIn` - Fade in with upward slide
- `slideInLeft` - Slide in from left
- `slideInRight` - Slide in from right
- `spin` - Continuous rotation
- `pulse` - Pulsing opacity effect

### Usage
```html
<div class="animate-fadeIn">Fading in...</div>
<button class="btn-accent animate-spin">Loading...</button>
```

---

## Responsive Breakpoints

### Tablet (max-width: 768px)
- Reduced heading sizes
- Single column grid layouts
- Adjusted padding

### Mobile (max-width: 480px)
- Minimal heading sizes (1.5rem, 1.25rem)
- Optimized button sizes
- Reduced font sizes

### Implementation
```css
@media (max-width: 768px) {
  h1 { font-size: 2rem; }
  .grid-2 { grid-template-columns: 1fr; }
}
```

---

## HTML Files Updated

The following HTML files have been integrated with the unified design system:

### Core Pages
1. **index.html** - Main landing page
2. **lifetime-pass.html** - Lifetime membership landing page
3. **community-room.html** - 24/7 video chat room
4. **radio.html** - Audio streaming platform
5. **checkout.html** - Payment checkout page
6. **age-verification-camera.html** - Age verification interface

### Additional Pages (Ready to integrate)
- payment-checkout.html
- videorama-app/ (React build; replaces legacy video-rooms.html)
- youtube-playlist.html
- policies_en.html
- policies_es.html
- And 10+ other pages

---

## Integration Guide

### Adding Unified Design to New Pages

1. **Link the CSS file** in your `<head>`:
```html
<link rel="stylesheet" href="/unified-design.css">
```

2. **Use CSS Variables** throughout your styles:
```css
h1 {
  font-family: var(--font-title);
  color: var(--primary-color);
  margin-bottom: var(--spacing-lg);
}
```

3. **Leverage Pre-made Components**:
```html
<button class="btn btn-primary">Action</button>
<div class="card">Content</div>
```

4. **Use Utility Classes** for quick styling:
```html
<div class="flex flex-center mb-lg">
  <h2>Centered with margin</h2>
</div>
```

---

## Font Usage Examples

### Headers (BBH Bartle)
```html
<h1>Join PNPtv Lifetime</h1>
<h2>Exclusive Features</h2>
<h3>24/7 Community</h3>
```

### Body Text (Roboto)
```html
<p>Enjoy unlimited access to premium content...</p>
<a href="/lifetime100">Learn More</a>
```

---

## Color Usage Examples

### Gradients
```html
<div style="background: var(--gradient-primary);">
  Purple gradient background
</div>
```

### Accent Colors
```html
<button class="btn btn-accent">Special Offer - $100</button>
<span class="text-accent">Premium Member</span>
```

### Text Colors
```html
<p class="text-muted">Optional information</p>
<a class="text-light">Primary link</a>
```

---

## Button States

### All buttons automatically include:
- ✅ Hover state with elevation
- ✅ Active/pressed state with scale
- ✅ Smooth transitions (0.3s)
- ✅ Focus states (keyboard navigation)
- ✅ Disabled states

### Example:
```html
<button class="btn btn-primary">PAGAR AHORA</button>
<!-- Automatically responds to: hover, active, focus, disabled -->
```

---

## Best Practices

### 1. **Use CSS Variables**
```css
/* ✅ Good */
color: var(--primary-color);
padding: var(--spacing-md);

/* ❌ Avoid */
color: #667eea;
padding: 16px;
```

### 2. **Consistent Spacing**
```css
/* ✅ Good - Uses spacing system */
margin: var(--spacing-lg) 0;
padding: var(--spacing-md);

/* ❌ Avoid - Arbitrary values */
margin: 25px 0;
padding: 14px;
```

### 3. **Typography Hierarchy**
```html
<!-- ✅ Good -->
<h1>Main Title</h1>
<h2>Section Header</h2>
<p>Body text with proper styling</p>

<!-- ❌ Avoid -->
<span style="font-size: 24px;">Main Title</span>
<div style="font-size: 18px;">Section Header</div>
```

### 4. **Leverage Components**
```html
<!-- ✅ Good - Uses component system -->
<button class="btn btn-primary">Action</button>
<div class="card">Content</div>

<!-- ❌ Avoid - Custom styling for standard elements -->
<button style="background: blue; padding: 16px;">Action</button>
```

---

## Customization

All colors and values are defined as CSS variables at the root level, making global changes simple:

```css
:root {
  --primary-color: #667eea; /* Change primary color here */
  --accent-gold: #ffd700;   /* Change accent color here */
  /* All components automatically update */
}
```

---

## Performance

- **Single CSS file:** Reduced HTTP requests
- **CSS Variables:** No need for CSS preprocessors
- **Optimized selectors:** Minimal specificity conflicts
- **Reusable classes:** Reduced total CSS output
- **Font loading:** BBH Bartle via Typekit (Adobe Fonts)

---

## Accessibility

The design system includes:
- ✅ Sufficient color contrast ratios
- ✅ Keyboard navigation support (buttons, forms)
- ✅ Focus states for all interactive elements
- ✅ Semantic HTML structure support
- ✅ Responsive design for all device sizes

---

## Version History

**v1.0 - December 25, 2025**
- Initial unified design system
- BBH Bartle font integration
- Roboto body font system
- Color palette with 10+ custom properties
- Component library (buttons, cards, forms)
- Spacing and sizing scale
- Animation library
- Responsive breakpoints
- Integration in 6+ core pages

---

## Support & Updates

For design system updates or new component requests, maintain consistency with:
- Font family usage (BBH Bartle titles, Roboto body)
- Color palette (primary purple, accent gold)
- Spacing scale (4px base unit)
- Component patterns (buttons, cards, forms)

---

## File References

- **Unified CSS:** `/public/unified-design.css` (370 lines)
- **Integration:** Latest in `/public/lifetime-pass.html`, `/public/index.html`, `/public/community-room.html`, `/public/radio.html`, `/public/checkout.html`, `/public/age-verification-camera.html`
