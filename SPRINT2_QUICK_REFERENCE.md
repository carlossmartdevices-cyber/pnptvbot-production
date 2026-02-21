# Sprint 2 Quick Reference Guide

## Import Design Tokens

```css
/* At the top of your CSS file */
@import '@pnptv/ui-kit/src/tokens.css';

/* Or in your main.jsx */
import '@pnptv/ui-kit/src/tokens.css';
```

## Common Token Usage

### Colors
```css
color: var(--color-text-primary);              /* Main text */
background: var(--color-bg-secondary);         /* Cards */
border: 1px solid var(--color-border-subtle);  /* Dividers */
```

### Spacing
```css
padding: var(--space-4);     /* 16px */
margin: var(--space-6);      /* 24px */
gap: var(--space-3);         /* 12px */
```

### Radius & Shadows
```css
border-radius: var(--radius-md);  /* 12px */
box-shadow: var(--shadow-md);     /* Depth */
```

### Typography
```css
font-family: var(--font-family-body);     /* Inter */
font-family: var(--font-family-display);  /* Outfit */
font-size: var(--font-size-lg);
font-weight: var(--font-weight-semibold);
```

### Transitions
```css
transition: all var(--transition-fast);    /* 150ms */
transition: all var(--transition-normal);  /* 250ms */
```

---

## Using Components

### Skeleton Loaders
```jsx
import { PostCardSkeleton, SkeletonGrid } from '../components/ui/Skeleton';

{loading ? <PostCardSkeleton /> : <PostCard {...props} />}
```

### Toast Notifications
```jsx
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';

const { toasts, showToast, closeToast } = useToast();

showToast('Success message', 'success');
showToast('Error message', 'error');

<ToastContainer toasts={toasts} onClose={closeToast} />
```

### Error Boundary
```jsx
import ErrorBoundary from './components/ErrorBoundary';

<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

---

## File Locations

### Core System
- Tokens: `/packages/ui-kit/src/tokens.css`
- UI Index: `/packages/ui-kit/src/index.js`

### Components
- Skeleton: `/apps/hub/src/components/ui/Skeleton.jsx`
- Toast: `/apps/hub/src/components/ui/Toast.jsx`
- Error Boundary: `/apps/hub/src/components/ErrorBoundary.jsx`
- useToast Hook: `/apps/hub/src/hooks/useToast.js`

### Pages Using New System
- FeedPage: `/apps/hub/src/pages/FeedPage.jsx`
- PostCard: `/apps/hub/src/components/social/PostCard.jsx`
- PostComposer: `/apps/hub/src/components/social/PostComposer.jsx`

---

## CSS Variable Cheat Sheet

### Colors
```
--color-text-primary      #ffffff
--color-text-secondary    #b8bcc4
--color-text-muted        #5a6270
--color-bg-primary        #0d0f14
--color-bg-secondary      #1a1d24
--color-brand-prime       #ff3a7d
--color-brand-teal        #2ce2c9
--color-brand-amber       #ff9c38
--color-status-success    #10b981
--color-status-error      #ef4444
--color-status-warning    #f59e0b
--color-status-info       #3b82f6
```

### Spacing (4px scale)
```
--space-1  4px
--space-2  8px
--space-3  12px
--space-4  16px
--space-6  24px
--space-8  32px
--space-12 48px
```

### Radius
```
--radius-sm   8px
--radius-md   12px
--radius-lg   16px
--radius-xl   20px
--radius-full 9999px
```

### Shadows
```
--shadow-sm   Subtle
--shadow-md   Standard
--shadow-lg   Elevated
--shadow-prime Brand color shadow
```

### Typography
```
--font-size-xs    12px
--font-size-sm    14px
--font-size-base  16px
--font-size-lg    18px
--font-size-2xl   24px
--font-size-3xl   30px
```

---

## Responsive Breakpoints

```
Mobile (default)     320px+
Tablet (sm)          640px+
Small Desktop (md)   768px+
Desktop (lg)         1024px+
Large Desktop (xl)   1280px+
```

Example:
```css
@media (min-width: 768px) {
  .component {
    padding: var(--space-8);
  }
}
```

---

## Component Props

### Toast
```jsx
<Toast
  id="unique-id"
  type="error"                    /* success|error|warning|info */
  message="Error message"
  duration={5000}                 /* ms, 0 = no auto-hide */
  onClose={handleClose}
/>
```

### useToast Hook
```jsx
const {
  toasts,                         /* Array of active toasts */
  showToast,                      /* (message, type, duration) */
  closeToast,                     /* (id) */
  clearToasts                     /* () */
} = useToast();
```

### Skeleton
```jsx
<Skeleton
  width={100}                     /* px or % */
  height={20}
  variant="default"               /* default|circle|rounded */
  className="custom-class"
/>
```

---

## Error Handling Pattern

```jsx
const handleAction = async () => {
  const previousState = state;

  try {
    // Optimistic update
    setState(newState);

    // API call
    const result = await api.action();

    // Success feedback
    showToast('Éxito', 'success');
  } catch (err) {
    // Revert state
    setState(previousState);

    // Error feedback
    showToast('Error al procesar', 'error');
    console.error('Error:', err);
  }
};
```

---

## Translation Keys

Spanish translations used throughout:
- "Algo salió mal" - Something went wrong
- "Recargar" - Reload
- "Error al procesar el like" - Error processing like
- "Error al eliminar el post" - Error deleting post
- "Error al cargar las respuestas" - Error loading replies
- "Error al enviar la respuesta" - Error sending reply
- "Post publicado exitosamente" - Post published successfully
- "¿Eliminar este post?" - Delete this post?

---

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- iOS Safari 13+
- Android Chrome 90+

All CSS features are widely supported in these versions.

---

## Documentation Files

1. **DESIGN_SYSTEM_SPRINT2.md** - Full technical documentation
2. **SPRINT2_QUICK_REFERENCE.md** - This file
3. **Code comments** - In-line documentation in each file

---

## Next Steps

After Sprint 2, to continue design system work:

1. **Apply tokens to other apps**
   - media-videorama
   - hangouts
   - media-radio
   - media-live

2. **Create more components**
   - Buttons (primary, secondary, ghost, text)
   - Inputs (text, textarea, select, checkbox, radio)
   - Cards (elevated, outlined, transparent)
   - Navigation (tabs, breadcrumbs, pagination)
   - Modals & Drawers

3. **Add interactive documentation**
   - Storybook setup
   - Token showcase
   - Component gallery
   - Live playground

4. **Theme system**
   - Theme context provider
   - CSS variable switcher
   - Dark/light mode support
   - Custom theme builder

---

## Support & Issues

If you encounter issues:

1. Check that tokens.css is imported
2. Verify CSS variable names (use browser DevTools)
3. Check z-index scale for layering issues
4. Test in actual browser (not just DevTools)
5. Check console for error messages
6. Review DESIGN_SYSTEM_SPRINT2.md for detailed info

---

## Build Commands

```bash
# Development
npm run dev

# Production build
npm run build

# Check build size
npm run build -- --report-compressed-size
```

---

**Last Updated**: 2026-02-21
**Sprint**: 2 - Design System Unification
**Status**: ✅ Complete
