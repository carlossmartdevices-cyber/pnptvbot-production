# 📊 Bot Management Spreadsheets - User Guide

Hey! These spreadsheets are your super simple tools to manage and test the bot. No PostgreSQL needed! 🎉

## 📄 Files Created

### 1. `BOT_TEXTS_TRACKING.csv` - Text Management Spreadsheet
**What it does:** Tracks ALL notification texts, menus, buttons, and messages in both English and Spanish.

**How to use it:**

#### To Request a Text Change:
1. Open the CSV file in Excel, Google Sheets, or any spreadsheet app
2. Find the text you want to change
3. In the **CHANGE_FROM** column, copy/paste the EXACT text you want to change
4. In the **CHANGE_TO** column, write the NEW text you want
5. In the **STATUS** column, write: `PENDING CHANGE`
6. In the **NOTES** column, add any extra details (optional)
7. Save and tell me: "Please update the texts marked as PENDING CHANGE in BOT_TEXTS_TRACKING.csv"

#### Example:
```
CHANGE_FROM: "Welcome to PNPtv!"
CHANGE_TO: "Welcome to the PNPtv Community!"
STATUS: PENDING CHANGE
NOTES: Make it sound more welcoming
```

**Columns explained:**
- **KEY**: The internal code name (don't change this)
- **CATEGORY**: What section it belongs to (General, Profile, Subscription, etc.)
- **ENGLISH_TEXT**: Current English text
- **SPANISH_TEXT**: Current Spanish text
- **CHANGE_FROM**: Copy the exact text you want to change here
- **CHANGE_TO**: Write the new text you want here
- **STATUS**: Mark as "PENDING CHANGE" when you want to update something
- **NOTES**: Any comments or reasons for the change

---

### 2. `BOT_FEATURES_TESTING_CHECKLIST.csv` - Testing Checklist
**What it does:** Lists ALL 175 features, buttons, and functionalities in the bot for testing.

**How to use it:**

#### To Test Features:
1. Open the CSV file
2. Go through each feature one by one
3. Test it following the **HOW_TO_TEST** column
4. In the **TEST_STATUS** column, mark it as:
   - `✅ WORKS` - Feature works perfectly
   - `❌ DOESN'T WORK` - Feature is broken
   - `⚠️ NEEDS IMPROVEMENT` - Works but could be better
   - `🗑️ DELETE/ARCHIVE` - Not needed anymore
5. In the **NOTES** column, add details about what you found
6. In the **ACTION_NEEDED** column, write what needs to be done (if anything)

#### Example:
```
FEATURE_NAME: Change Photo
TEST_STATUS: ⚠️ NEEDS IMPROVEMENT
NOTES: Works but takes too long to upload
ACTION_NEEDED: Optimize image upload speed
```

**Columns explained:**
- **FEATURE_ID**: Unique number for the feature
- **CATEGORY**: What section (Main Menu, Profile, Subscription, etc.)
- **FEATURE_NAME**: Name of the feature
- **DESCRIPTION**: What the feature does
- **HOW_TO_TEST**: Step-by-step testing instructions
- **TEST_STATUS**: Mark as ✅ WORKS / ❌ DOESN'T WORK / ⚠️ NEEDS IMPROVEMENT / 🗑️ DELETE/ARCHIVE
- **NOTES**: Your observations and findings
- **ACTION_NEEDED**: What should be done to fix/improve

---

## 🚀 Quick Start Guide

### For Text Changes:
```
1. Open BOT_TEXTS_TRACKING.csv
2. Find the text → Fill CHANGE_FROM & CHANGE_TO columns
3. Set STATUS to "PENDING CHANGE"
4. Tell me to apply the changes
```

### For Feature Testing:
```
1. Open BOT_FEATURES_TESTING_CHECKLIST.csv
2. Test each feature → Mark TEST_STATUS
3. Add notes about what you found
4. Tell me which features need fixes
```

---

## 💡 Pro Tips

1. **Keep it simple**: Just copy/paste exact text when requesting changes
2. **Be specific**: Add notes so we're 100% on the same page
3. **Test systematically**: Go category by category (don't skip around)
4. **Mark clearly**: Use the emojis (✅ ❌ ⚠️ 🗑️) so it's super obvious
5. **Save often**: Save the spreadsheet after updating

---

## 📋 Categories in the Bot

### Text Categories:
- General (welcome messages, buttons, etc.)
- Onboarding (language, age verification, terms)
- Main Menu (navigation buttons)
- Subscription (plans, payments)
- Profile (edit profile, privacy, badges)
- Nearby (find users nearby)
- Live Streams (streaming features)
- VOD (recorded videos)
- Emotes (custom emojis)
- Radio (24/7 music)
- Zoom (video rooms)
- Support (Cristina AI, help)
- Settings (language, notifications)
- Admin (management tools)
- Gamification (badges, leaderboards)
- Moderation (auto-moderation)
- Errors (error messages)

### Feature Categories:
- Onboarding (4 features)
- Main Menu (9 features)
- Subscription (10 features)
- Profile (21 features)
- Nearby (9 features)
- Live Streams (22 features)
- VOD (4 features)
- Emotes (6 features)
- Radio (7 features)
- Zoom (7 features)
- Support (7 features)
- Settings (6 features)
- Admin (18 features)
- Gamification (13 features)
- Moderation (12 features)
- Commands (3 features)
- Notifications (7 features)
- General (9 features)
- Payments (6 features)

**Total: 180 features to test!**

---

## 🎯 Example Workflow

### Scenario: You want to change a welcome message and test the profile feature

**Step 1 - Change Text:**
1. Open `BOT_TEXTS_TRACKING.csv`
2. Find row with KEY = "welcome"
3. Fill in:
   ```
   CHANGE_FROM: 👋 Welcome to PNPtv!
   CHANGE_TO: 👋 Hey! Welcome to PNPtv Community!
   STATUS: PENDING CHANGE
   NOTES: Make it friendlier
   ```
4. Save the file

**Step 2 - Test Feature:**
1. Open `BOT_FEATURES_TESTING_CHECKLIST.csv`
2. Find FEATURE_ID 024 (View Profile)
3. Test it: Click My Profile in the bot
4. Fill in:
   ```
   TEST_STATUS: ✅ WORKS
   NOTES: Displays all profile info correctly
   ACTION_NEEDED: None
   ```
5. Save the file

**Step 3 - Tell Me:**
"Hey! I marked some text changes in BOT_TEXTS_TRACKING.csv as PENDING CHANGE. Please update them. Also, I tested the View Profile feature and it works great!"

---

## ❓ Need Help?

Just tell me:
- "Show me how to use the text spreadsheet"
- "How do I request a text change?"
- "What does TEST_STATUS mean?"
- "Apply all PENDING CHANGE texts"
- "Fix all features marked as DOESN'T WORK"

I'll guide you through it! 🤖

---

## 📌 Important Notes

- **Don't edit the KEY column** in BOT_TEXTS_TRACKING.csv (that's the internal reference)
- **Don't edit the FEATURE_ID column** in BOT_FEATURES_TESTING_CHECKLIST.csv
- Both files are in CSV format - open with Excel, Google Sheets, Numbers, or any spreadsheet app
- Save the files after making changes
- You can filter/sort by categories to work on specific sections

---

Made with ❤️ to make your life easier! No complex databases needed - just simple spreadsheets! 🎉
