# Share Post to Community Group - Quick Start Guide

## 🎯 What Was Built

A complete **Share Post to Community Group** feature in the admin panel that allows you to:
- Create formatted posts with media (photos/videos)
- Send bilingual content (EN/ES) to community groups
- Add interactive buttons (7 preset types + custom URLs)
- Schedule posts 1-12 times into the future
- Set up recurring posts (daily, weekly, monthly)
- Track deliveries and engagement

## 📦 Files Created

### New Files (4)
1. **Database:** `database/migrations/community_posts_schema.sql`
2. **Service:** `src/bot/services/communityPostService.js`
3. **Handler:** `src/bot/handlers/admin/sharePostToCommunityGroup.js`
4. **Scheduler:** `src/bot/core/schedulers/communityPostScheduler.js`

### Modified Files (2)
1. **Admin Panel:** `src/bot/handlers/admin/index.js`
2. **Bot Core:** `src/bot/core/bot.js`

### Documentation (3)
1. `COMMUNITY_POSTS_FEATURE.md` - Full feature documentation
2. `IMPLEMENTATION_CHECKLIST.md` - Deployment guide
3. `QUICK_START.md` - This file

## 🚀 Deployment

### 1. Run Database Migration
```bash
psql -U postgres -d pnptv_bot < database/migrations/community_posts_schema.sql
```

### 2. Restart Bot
```bash
npm restart
```

### 3. Verify in Telegram
- Type `/admin`
- Look for "📤 Compartir Publicación" button

## 🎮 How to Use

1. Click **"📤 Compartir Publicación"** in admin panel
2. **Step 1:** Select target groups
3. **Step 2:** Upload media (photo/video) or skip
4. **Step 3:** Write bilingual text (EN + ES)
5. **Step 4:** Add interactive buttons
6. **Step 5:** Choose visual template
7. **Step 6:** Set recurrence (optional)
8. **Step 7:** Select schedule count (1-12)
9. **Step 8:** Enter dates/times (YYYY-MM-DD HH:MM)
10. **Step 9:** Preview and confirm

**Posts automatically send at scheduled times!**

## 🔧 Configuration

### Groups (6 seeded)
- 📍 Nearby
- 👤 Profile
- 🎯 Main Room
- 🎉 Hangouts
- 🤖 Cristina AI
- 🎬 Videorama

### Buttons (7 types)
- 📍 Nearby
- 👤 Profile
- 🎯 Main Room
- 🎉 Hangouts
- 🤖 Cristina AI
- 🎬 Videorama
- 🔗 Custom Link

### Templates (4)
- Standard
- Featured
- Announcement
- Event

## 📊 Feature Summary

✅ Bilingual (EN/ES)
✅ Media support (photo/video)
✅ 7 button types
✅ 4 templates
✅ 1-12 scheduled posts
✅ Recurring patterns
✅ Auto-execution every 60 seconds
✅ Delivery tracking
✅ Analytics

## 📁 File Structure

```
database/migrations/
  └── community_posts_schema.sql      (7 tables, 7 indexes, seeded data)

src/bot/
  ├── services/
  │   └── communityPostService.js      (400+ lines, 18 methods)
  ├── handlers/admin/
  │   ├── index.js                     (modified - added integration)
  │   └── sharePostToCommunityGroup.js  (800+ lines, 9-step handler)
  └── core/
      ├── bot.js                       (modified - scheduler init)
      └── schedulers/
          └── communityPostScheduler.js (400+ lines, auto-execution)

Documentation/
  ├── COMMUNITY_POSTS_FEATURE.md       (2000+ lines, complete guide)
  ├── IMPLEMENTATION_CHECKLIST.md      (comprehensive checklist)
  └── QUICK_START.md                   (this file)
```

## 🚀 What Happens Automatically

1. **Scheduler runs every 60 seconds**
2. **Checks for posts scheduled for "now or earlier"**
3. **Sends to all target groups**
4. **Tracks delivery success/failure**
5. **For recurring posts, calculates next execution**
6. **Updates post and schedule status**

## 💡 Best Practices

1. Schedule posts at different times (morning, afternoon, evening)
2. Use Featured template for promotions
3. Keep EN/ES content parallel
4. Limit to 2-3 most relevant buttons
5. Monitor delivery rates weekly

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Button not showing | Restart bot, check logs |
| Posts not sending | Verify bot is admin in groups |
| Media fails | Check S3 config, file < 50MB |
| Text too long | Max 1024 chars per language |

## 📊 Monitor Status

```javascript
// In Telegram handler
const stats = await global.communityPostScheduler.getStatistics();
```

Returns: scheduled_posts, sent_posts, failed_posts, pending_schedules, etc.

## 🔗 Quick Links

- **Feature Docs:** `COMMUNITY_POSTS_FEATURE.md`
- **Deployment:** `IMPLEMENTATION_CHECKLIST.md`
- **Service Code:** `src/bot/services/communityPostService.js`
- **Handler Code:** `src/bot/handlers/admin/sharePostToCommunityGroup.js`
- **Scheduler Code:** `src/bot/core/schedulers/communityPostScheduler.js`

---

**Version:** 1.0.0 | **Status:** ✅ Production Ready
