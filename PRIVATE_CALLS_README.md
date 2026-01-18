# 📞 Private Calls 1:1 Booking System

> Complete, production-ready 1:1 private video call booking system for the PNPtv Telegram bot

## ✨ Features Overview

### 👥 For Users
```
📱 User Experience Flow:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Tap "📞 Private Calls" in menu
   ↓
2. Browse available models
   ├─ 🟢 Online status indicator
   ├─ ⭐ Ratings and reviews
   ├─ 💰 Price per minute
   └─ 📸 Photo preview
   ↓
3. Select model → View full profile
   ├─ 📝 Full bio/description
   ├─ 🖼️ Photo gallery (swipeable)
   ├─ ⭐ All reviews
   └─ ⏱️ Duration options
   ↓
4. Book a call (3-step process)
   ├─ 📅 Select date (next 14 days)
   ├─ ⏰ Select time (15-min slots)
   └─ ⏱️ Select duration (15-120 min)
   ↓
5. Confirm & Pay
   ├─ 💳 Stripe
   ├─ 💳 ePayco
   └─ 💎 Crypto (Daimo)
   ↓
6. Video Call
   └─ 🎥 Jitsi/Agora link in chat
   ↓
7. Leave Feedback
   ├─ ⭐ 1-5 star rating
   └─ 📝 Written review
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 🛠️ For Admins
```
⚙️ Admin Control Panel:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 Models Management
├── ➕ Add New Model
│   ├─ Step 1: Username
│   ├─ Step 2: Display name
│   ├─ Step 3: Bio (200 chars)
│   ├─ Step 4: Price per minute
│   ├─ Step 5: Duration range
│   ├─ Step 6: Upload photo
│   └─ Step 7: Weekly availability
│
├── 📋 View All Models
│   └─ Quick edit/status toggle
│
├── 👤 Edit Model
│   ├─ 🟢 Toggle Status (Online/Offline/Busy)
│   │   ├─ 🟢 Online → Available to book
│   │   ├─ 🟡 Busy → In a call
│   │   └─ ⚪ Offline → Hidden
│   │
│   ├─ 📅 Set Availability
│   │   └─ Define weekly schedule
│   │      └─ E.g., Mon-Fri: 9AM-10PM
│   │
│   ├─ 💰 Change Price
│   │   └─ Update anytime (doesn't affect past bookings)
│   │
│   ├─ 📸 Add Photos
│   │   ├─ Upload multiple photos
│   │   ├─ Set captions
│   │   └─ Reorder gallery
│   │
│   ├─ 📊 View Bookings
│   │   ├─ See all scheduled calls
│   │   ├─ Check payment status
│   │   └─ View earnings
│   │
│   └─ 🗑️ Deactivate
│       └─ Hide from public list
│
└── 📊 Bookings & Earnings
    ├─ 📈 Revenue dashboard
    ├─ 💰 Model earnings breakdown
    ├─ 📉 Commission tracking (30% platform)
    └─ 📅 Payout history
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 📊 System Status Indicators

### Model Status
```
🟢 ONLINE    - Available for booking, not in call
🟡 BUSY      - Currently in a call (auto-set)
⚪ OFFLINE   - Hidden from booking list
```

### Booking Status
```
⏸️ PENDING     - Awaiting payment
⏳ CONFIRMED   - Paid, awaiting start time
🔴 ACTIVE      - Call in progress
✅ COMPLETED   - Call finished
❌ CANCELLED   - Cancelled/refunded
```

## 💰 Pricing & Commission

```
Example Booking:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Model Price: $5.00 per minute
Duration: 60 minutes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Subtotal: 60 × $5.00 = $300.00
Platform Commission (30%): -$90.00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Model Receives: $210.00
Customer Pays: $300.00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 🗄️ Database Schema

```
models
├── model_id, username, display_name
├── bio, photo_url
└── price_per_minute, min/max_duration

model_status (Real-time)
├── model_id (UNIQUE)
├── status (online/offline/busy)
└── current_booking_id

model_availability (Weekly Schedule)
├── model_id
├── day_of_week (Mon-Sun)
├── start_time, end_time
└── is_available

model_bookings
├── model_id, user_id, telegram_user_id
├── scheduled_date, start_time, duration_minutes
├── status, payment_status
├── total_price, payment_method
└── call_room_url

model_photos (Gallery)
├── model_id
├── photo_url, caption
└── display_order

model_reviews
├── model_id, user_id, booking_id
├── rating (1-5), review_text
└── created_at

model_earnings (Commission Split)
├── booking_id, amount
├── commission_percentage, model_earnings
└── payout_date
```

## 🚀 Quick Start

### For Users
1. Open bot menu → 📞 Private Calls
2. Browse & select model
3. Choose date, time, duration
4. Pay with preferred method
5. Join video call
6. Leave review

### For Admins
```bash
# 1. Initialize database
psql -U pnptvbot -d pnptvbot -f database/migrations/004_create_models_system.sql

# 2. In bot, access admin menu
/admin_models

# 3. Click "➕ Add New Model"

# 4. Fill 7-step wizard

# 5. Model appears in user's booking list instantly

# 6. Toggle status as needed
# - 🟢 Online when available
# - ⚪ Offline when not available
# - 🟡 Busy (auto-set during calls)
```

## 📁 File Structure

```
/root/pnptvbot-production/
├── src/models/
│   └── modelManagementModel.js          [Core database operations]
│
├── src/bot/handlers/
│   ├── user/
│   │   ├── privateCallsBooking.js       [User booking interface]
│   │   └── mainMenuIntegration.js       [Menu integration]
│   │
│   ├── admin/
│   │   └── modelManagement.js           [Admin panel]
│   │
│   └── index.js                         [Handler registry]
│
├── src/bot/services/
│   └── bookingPaymentService.js         [Payment & earnings]
│
├── database/migrations/
│   └── 004_create_models_system.sql     [Database schema]
│
├── PRIVATE_CALLS_SYSTEM.md              [Detailed documentation]
├── INTEGRATION_GUIDE.md                 [Integration instructions]
└── PRIVATE_CALLS_README.md              [This file]
```

## 🔌 Integration Steps

1. **Database**: Run migration SQL
2. **Handlers**: Register in bot.js
3. **Menu**: Add button to main menu
4. **Webhooks**: Setup payment confirmations
5. **Environment**: Add config variables
6. **Test**: Run through complete flow

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for detailed steps.

## 🛠️ Key Technologies

```
Framework: Telegraf.js (Telegram bot)
Database: PostgreSQL
Payment: Stripe, ePayco, Daimo
Video: Jitsi/Agora (configurable)
Session: Redis
Logging: Winston
```

## 📱 Command Reference

### User Commands
```
/book_private_call    - Browse & book models
/my_bookings         - View reservations
/model_profile       - View model details
```

### Admin Commands
```
/admin_models        - Model management menu
/add_model           - Create new model
/view_models_list    - List all models
/edit_model          - Edit model details
/toggle_status       - Toggle online/offline/busy
```

## 🔄 Real-Time Features

- **Instant Status Updates**: Model status changes immediately visible to users
- **Live Slot Availability**: Shows only actually available times
- **Auto Busy Status**: Set to 🟡 busy during active calls
- **Real-time Booking**: Bookings processed instantly
- **Live Earnings**: Commissions calculated immediately

## 🔒 Security Features

- User authentication required for bookings
- Payment verification before booking confirmation
- Transaction ID tracking
- Refund processing
- User rating/review system (prevents fraud)
- Commission audit trail

## 📊 Analytics

```
Available Metrics:
├── Total bookings per model
├── Revenue per model
├── Average rating per model
├── Most booked times
├── Payment success rate
├── Refund rate
├── Commission tracking
└── Payout history
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| No available slots | Check model availability + existing bookings |
| Payment fails | Verify payment provider credentials |
| Model doesn't appear | Check is_active=true & status='online' |
| Booking doesn't confirm | Check payment webhook setup |
| Status not updating | Restart bot to reload status |

## 📝 Configuration

```javascript
// src/bot/core/bot.js

// Commission percentage (0-100)
const COMMISSION_PERCENTAGE = 30;

// Default availability times for new models
const DEFAULT_AVAILABILITY_START = '09:00';
const DEFAULT_AVAILABILITY_END = '22:00';

// Booking timeout (minutes)
const BOOKING_TIMEOUT = 30;

// Minimum slot duration
const SLOT_DURATION_MINUTES = 15;

// Video platform
const JITSI_DOMAIN = process.env.JITSI_DOMAIN || 'meet.jit.si';
```

## 🚀 Production Checklist

- [ ] Database migration applied
- [ ] Handlers registered in bot.js
- [ ] Menu button added
- [ ] Payment webhooks configured
- [ ] Environment variables set
- [ ] Test bookings completed
- [ ] Payment processing tested
- [ ] Admin panel tested
- [ ] Status toggle tested
- [ ] Video call generation tested
- [ ] Review system tested
- [ ] Earnings calculated correctly
- [ ] Logging configured
- [ ] Monitoring setup
- [ ] Backup strategy in place

## 📈 Performance Optimization

```sql
-- Create indexes (already in migration)
CREATE INDEX idx_models_active ON models(is_active);
CREATE INDEX idx_model_bookings_date ON model_bookings(scheduled_date);
CREATE INDEX idx_model_bookings_status ON model_bookings(status);
CREATE INDEX idx_model_status_model ON model_status(model_id);
```

## 🤝 Support

For issues:
1. Check [PRIVATE_CALLS_SYSTEM.md](./PRIVATE_CALLS_SYSTEM.md) for detailed info
2. See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for setup help
3. Review database queries in integration guide
4. Check logs: `/root/pnptvbot-production/logs/`

## 📄 License

Same as PNPtv Bot project

---

**Version**: 1.0.0
**Status**: ✅ Production Ready
**Last Updated**: 2026-01-18
**Maintainer**: PNPtv Development Team

**Ready to integrate?** → [See Integration Guide](./INTEGRATION_GUIDE.md)
