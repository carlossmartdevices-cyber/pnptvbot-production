# Bot Change Log / Customizations

## 2025-11-19
- /cristina command added: Starts AI support chat (Cristina) and disables auto-delete for its responses, even in group chats.
- All main menu buttons in group chats trigger privacy/redirect message and auto-delete after 30s.
- /menu and /start open the same menu.
- PostgreSQL authentication fixed (md5), password set, bot restarted with latest server and GitHub data.
- Subscription plans are loaded from DB; fallback to defaults if DB is empty.
- 'looking_for' field added to user profile (EN/ES).
- Profile handlers updated for 'looking_for' field.
- Pending: Enforce user language in all profile flows.

## How to update
- Any new customization or fix should be added here for future reference.
