# Broadcast Wizard Testing Guide

## Overview
This guide provides step-by-step instructions for testing the broadcast wizard after the recent fixes.

## Fixes Applied
1. ✅ Fixed inconsistent step numbering (now 1/5 through 5/5)
2. ✅ Removed duplicate broadcastUtils.js file
3. ✅ Simplified Spanish text handler (removed redundant logic)
4. ✅ Cleaned up "aggressive fix" comments
5. ✅ Improved button picker step management
6. ✅ Made broadcast sending async/non-blocking

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ START: Admin Panel → Broadcast Message                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ SELECT AUDIENCE:                                                 │
│  • 👥 All Users        (broadcast_all)                          │
│  • 💎 Premium Only     (broadcast_premium)                      │
│  • 🆓 Free Only        (broadcast_free)                         │
│  • ↩️ Churned Users    (broadcast_churned)                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1/5: Upload Media (Optional)                               │
│  • Upload: Photo, Video, Document, Audio, Voice                 │
│  • Or click: ⏭️ Skip (Text Only)                               │
│                                                                  │
│ Handler: broadcast_skip_media                                   │
│ Next Step: text_en                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2/5: English Text                                          │
│  • Type message (max 4096 chars, or 1024 with media)           │
│  • Or click: 🤖 AI Write (Grok)                                │
│                                                                  │
│ Handler: Text input → text_en                                   │
│ Next Step: text_es                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3/5: Spanish Text                                          │
│  • Type message (max 4096 chars, or 1024 with media)           │
│  • Or click: 🤖 AI Write (Grok)                                │
│                                                                  │
│ Handler: Text input → text_es                                   │
│ Next Step: buttons                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4/5: Select Buttons                                        │
│  • ✅/➕ Home Button                                            │
│  • ✅/➕ Profile Button                                         │
│  • ✅/➕ Plans Button                                           │
│  • ✅/➕ Main Room Button                                       │
│  • ✅/➕ Hangouts Button                                        │
│  • ✅/➕ Videorama Button                                       │
│  • ✅/➕ Nearby Button                                          │
│  • ✅/➕ Cristina AI Button                                     │
│  • ➕ Custom Link                                               │
│  • ✅ Done                                                       │
│  • ⏭️ No Buttons                                               │
│                                                                  │
│ Handlers:                                                        │
│  - broadcast_toggle_* (toggles selection)                       │
│  - broadcast_continue_with_buttons → preview                    │
│  - broadcast_no_buttons → preview                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ PREVIEW: Broadcast Summary                                       │
│  • Shows EN/ES text                                             │
│  • Shows selected buttons                                       │
│  • Shows media type (if any)                                    │
│  • Displays rendered preview with buttons                       │
│                                                                  │
│ Options:                                                         │
│  • 📤 Send Now                                                  │
│  • 📅 Schedule                                                  │
│  • 🔘 Edit Buttons                                             │
│  • ❌ Cancel                                                    │
│                                                                  │
│ Handlers:                                                        │
│  - broadcast_send_now_with_buttons → sending                    │
│  - broadcast_schedule_with_buttons → schedule_count             │
│  - broadcast_resume_buttons → buttons                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5/5: Send or Schedule                                      │
│                                                                  │
│ OPTION A: SEND NOW                                              │
│  • Shows "Broadcast en Cola" message                            │
│  • Sends broadcast in background                                │
│  • Admin receives notification when complete                    │
│  • Shows stats: sent, failed, total                             │
│                                                                  │
│ OPTION B: SCHEDULE                                              │
│  1. Select count (1-12 scheduled times)                         │
│  2. Enter datetime(s) in format: YYYY-MM-DD HH:MM              │
│  3. Confirms scheduling                                         │
│  4. Broadcast will auto-send at scheduled time(s)               │
└─────────────────────────────────────────────────────────────────┘
```

## Testing Checklist

### Test 1: Basic Flow (Text Only, No Buttons)
- [ ] Open admin panel
- [ ] Click "Broadcast Message"
- [ ] Select "All Users"
- [ ] Verify shows "Paso 1/5: Media"
- [ ] Click "Skip (Text Only)"
- [ ] Verify shows "Paso 2/5: Texto en Inglés"
- [ ] Enter English text (e.g., "Test message EN")
- [ ] Verify shows "Paso 3/5: Texto en Español"
- [ ] Enter Spanish text (e.g., "Test message ES")
- [ ] Verify shows "Paso 4/5: Botones"
- [ ] Click "No Buttons"
- [ ] Verify preview shows both EN/ES text
- [ ] Verify preview shows "Sin botones"
- [ ] Click "Send Now"
- [ ] Verify shows "Broadcast en Cola" message
- [ ] Wait for completion notification
- [ ] Verify stats are correct

### Test 2: With Media and Buttons
- [ ] Open admin panel
- [ ] Click "Broadcast Message"
- [ ] Select "Premium Only"
- [ ] Verify shows "Paso 1/5: Media"
- [ ] Upload an image
- [ ] Verify shows "Paso 2/5: Texto en Inglés"
- [ ] Enter English text (shorter - max 1024 chars)
- [ ] Verify shows "Paso 3/5: Texto en Español"
- [ ] Enter Spanish text (shorter - max 1024 chars)
- [ ] Verify shows "Paso 4/5: Botones"
- [ ] Click "Home" button (should show ✅)
- [ ] Click "Profile" button (should show ✅)
- [ ] Click "Done"
- [ ] Verify preview shows image, text, and 2 buttons
- [ ] Verify preview renders with actual buttons
- [ ] Click "Send Now"
- [ ] Verify broadcast completes successfully

### Test 3: Step Consistency
- [ ] Start broadcast wizard
- [ ] At each step, verify the step number is correct:
  - Step 1/5: Media
  - Step 2/5: English Text
  - Step 3/5: Spanish Text
  - Step 4/5: Buttons
  - Step 5/5: Scheduling (if scheduling)
- [ ] Verify NO steps show "X/4" anywhere

### Test 4: Edge Cases
- [ ] Test text too long (>4096 chars for text-only)
  - Should show error and stay in same step
- [ ] Test text too long with media (>1024 chars)
  - Should show error about media caption limit
- [ ] Click "Edit Buttons" from preview
  - Should return to Step 4/5
  - Should preserve previous button selections
- [ ] Click "Cancel" at any step
  - Should clear session and return to admin panel

### Test 5: Button Toggle
- [ ] At button selection step:
  - [ ] Click a button → should show ✅
  - [ ] Click same button again → should show ➕ (unselected)
  - [ ] Select multiple buttons
  - [ ] Click "Done"
  - [ ] Verify all selected buttons appear in preview

### Test 6: Custom Link
- [ ] At button selection step:
- [ ] Click "Custom Link"
- [ ] Enter invalid format → should show error
- [ ] Enter valid format: `My Link|https://example.com`
- [ ] Should proceed to preview
- [ ] Verify custom link appears in button list

### Test 7: Schedule Broadcast
- [ ] Complete steps 1-4
- [ ] At preview, click "Schedule"
- [ ] Select count (e.g., "2 veces")
- [ ] Enter first datetime: `2026-01-20 15:00`
- [ ] Enter second datetime: `2026-01-21 15:00`
- [ ] Verify confirmation shows both scheduled times
- [ ] Verify broadcast saved in database

### Test 8: AI Write Feature
- [ ] At English text step:
- [ ] Click "AI Write (Grok)"
- [ ] Enter prompt: "Promote lifetime pass with urgency"
- [ ] Verify AI generates text
- [ ] Proceed to Spanish step
- [ ] Click "AI Write (Grok)"
- [ ] Enter Spanish prompt
- [ ] Verify flow continues normally

### Test 9: Resume After Error
- [ ] Start broadcast wizard
- [ ] Complete steps 1-3
- [ ] Simulate error (e.g., network issue)
- [ ] Return to admin panel
- [ ] Click "Broadcast Message"
- [ ] Verify system offers to resume or restart
- [ ] Test both "Resume" and "Restart" options

### Test 10: Different Audiences
- [ ] Test with "All Users"
- [ ] Test with "Premium Only"
- [ ] Test with "Free Only"
- [ ] Test with "Churned Users"
- [ ] Verify correct users receive broadcast for each

## Known Issues to Verify Are Fixed
- [x] ~~Step numbers showing 1/4, 2/4, 3/4, 4/4 instead of 1/5 through 5/5~~
- [x] ~~Button picker appearing multiple times after Spanish text~~
- [x] ~~Duplicate broadcastUtils.js file~~
- [x] ~~Redundant "aggressive fix" logic~~

## Expected Behavior After Fixes
1. **Consistent Numbering**: All steps show X/5 format
2. **Single Button Picker**: Shows only once after Spanish text
3. **Clean Flow**: No loops or duplicate steps
4. **Proper Transitions**: Each step transitions cleanly to the next
5. **Session Management**: Step state is properly maintained
6. **Non-blocking Send**: Broadcasts send in background with notification

## Troubleshooting
If you encounter issues:
1. Check logs for "Broadcast" related messages
2. Verify session is being saved correctly
3. Check broadcastStep value in session
4. Ensure only one broadcastUtils.js exists (in src/bot/utils/)
5. Restart bot if step numbers still show X/4

## Success Criteria
✅ All 10 test cases pass without issues
✅ Step numbering is consistent (1/5 through 5/5)
✅ No duplicate step executions
✅ Button picker appears only once
✅ Broadcasts send successfully
✅ Preview displays correctly
✅ Stats are accurate
