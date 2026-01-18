# 📞 Private Calls Booking System - Complete Documentation

## Overview

The Private Calls Booking System is a comprehensive 1:1 video call booking platform integrated into the PNPtv Telegram bot. It allows users to book private calls with verified models, with full admin control over model management, pricing, availability, and real-time status.

## System Architecture

### Database Structure

#### 1. **models** Table
Core model information

```sql
id (PK)
model_id (UNIQUE, Telegram ID or custom ID)
username
display_name
bio
photo_url (profile picture)
price_per_minute (DECIMAL)
min_duration_minutes
max_duration_minutes
is_active (BOOLEAN)
created_at
updated_at
```

#### 2. **model_status** Table
Real-time online/offline/busy status

```sql
id (PK)
model_id (FK, UNIQUE)
status ('online', 'offline', 'busy')
current_booking_id (FK to active booking)
last_updated
```

#### 3. **model_availability** Table
Weekly recurring availability schedule

```sql
id (PK)
model_id (FK)
day_of_week (0-6, Sunday-Saturday)
start_time (HH:MM)
end_time (HH:MM)
is_available (BOOLEAN)
created_at
UNIQUE(model_id, day_of_week)
```

#### 4. **model_bookings** Table
All booking records

```sql
id (PK)
model_id (FK)
user_id (FK)
telegram_user_id
username
scheduled_date (DATE)
start_time (TIME)
duration_minutes
end_time (calculated)
status ('pending', 'confirmed', 'active', 'completed', 'cancelled')
payment_status ('pending', 'paid', 'failed', 'refunded')
payment_method ('stripe', 'epayco', 'daimo')
transaction_id
total_price (DECIMAL)
notes
call_room_url (Jitsi/video platform)
created_at
updated_at
```

#### 5. **model_photos** Table
Model photo gallery

```sql
id (PK)
model_id (FK)
photo_url (VARCHAR)
caption (TEXT)
display_order
is_active (BOOLEAN)
created_at
```

#### 6. **model_reviews** Table
User reviews and ratings

```sql
id (PK)
model_id (FK)
user_id (FK)
booking_id (FK)
rating (1-5)
review_text (TEXT)
created_at
```

#### 7. **model_earnings** Table
Earnings tracking with commission

```sql
id (PK)
model_id (FK)
booking_id (FK)
amount (DECIMAL) - Total booking price
commission_percentage (DECIMAL) - Platform commission (default 30%)
model_earnings (DECIMAL) - Amount model receives
payment_status ('pending', 'paid')
payout_date (DATE)
created_at
```

## User Flow

### 1. Browse & Select Model

```
User taps "📞 Private Calls" →
Sees list of available models with:
  - Real-time status (🟢 Online, 🟡 Busy, ⚪ Offline)
  - Price per minute
  - Average rating
  - Photo preview
```

### 2. View Model Profile

```
Taps model →
Sees:
  - Full bio/description
  - All photos (gallery view with navigation)
  - Price per minute
  - Min/max duration options
  - Rating and reviews
```

### 3. Book a Call (Step by Step)

**Step 1: Select Date**
- Calendar showing next 14 days
- Only shows days when model has availability

**Step 2: Select Time**
- Shows available 15-minute slots
- Greyed out slots are already booked
- Considers model's recurring weekly schedule

**Step 3: Select Duration**
- Options: 15, 30, 45, 60, 90, 120 minutes
- Each option shows live price calculation
- Only shows durations within model's min/max

**Step 4: Confirm & Pay**
- Shows full booking summary
- Offers multiple payment methods:
  - 💳 Stripe
  - 💳 ePayco
  - 💎 Crypto (Daimo)

**Step 5: Booking Confirmed**
- Booking enters "pending" status while waiting for payment
- Once paid → "confirmed" status
- Link to join video call sent to both parties

### 4. Active Call

```
When call start time arrives:
1. Model's status automatically changes to 🔴 "busy"
2. Both parties receive call room link
3. Call room URL generated (Jitsi or custom)
4. Booking status = "active"
```

### 5. Call Completion

```
After call ends:
1. Booking marked as "completed"
2. User prompted for rating/feedback
3. Model can accept/reject feedback
4. Earnings recorded with commission split
```

## Admin Panel - Model Management

### Main Model Menu

```
👥 Models Management
├── ➕ Add New Model
├── 📋 View All Models
├── ⚙️ Model Settings
├── 📊 Bookings & Earnings
└── 🔙 Back
```

### Add New Model (7-Step Wizard)

**Step 1: Username**
- Input: Telegram username
- Example: @modelname

**Step 2: Display Name**
- Input: Public name
- Example: Maria Garcia

**Step 3: Bio**
- Input: Description (max 200 chars)
- Example: Friendly, fun conversations!

**Step 4: Price Per Minute**
- Input: USD price
- Example: 5.00

**Step 5: Duration Range**
- Input: Min and max duration
- Example: 15 120 (15 to 120 minutes)

**Step 6: Profile Photo**
- Upload: Image file
- Auto-downloads and stores URL

**Step 7: Weekly Availability**
- Select: Days when available
- Set times later if needed

### Edit Model

Once created, admin can:

1. **Toggle Status**
   - 🟢 Online → 🟡 Busy → ⚪ Offline
   - Real-time updates visible to users

2. **Set Availability Hours**
   - Select day of week
   - Set start and end times
   - Examples:
     - Monday: 09:00 - 22:00
     - Saturday: 14:00 - 23:00

3. **Change Price**
   - Update price per minute anytime
   - Doesn't affect existing bookings

4. **Add Photos**
   - Upload multiple photos
   - Set caption for each
   - Reorder display order

5. **View Bookings**
   - See all scheduled calls
   - View payment status
   - Edit booking if needed

6. **Deactivate Model**
   - Hide from public booking list
   - Existing bookings remain valid

## Status System

### Model Status States

```
⚪ OFFLINE
   └─ Not available, won't receive booking notifications
   └─ Can be toggled online by admin

🟢 ONLINE
   └─ Available to receive bookings
   └─ Appears in user's booking list
   └─ Can accept new reservations

🟡 BUSY
   └─ Currently in a call (automatically set during active booking)
   └─ Users see as unavailable
   └─ Won't accept new bookings during this period
```

### Booking Status States

```
⏸️ PENDING
   └─ Booking created, awaiting payment
   └─ Expires after 30 minutes if unpaid

⏳ CONFIRMED
   └─ Payment received
   └─ Awaiting call start time

🔴 ACTIVE
   └─ Call in progress
   └─ Model status = "busy"

✅ COMPLETED
   └─ Call finished
   └─ Ready for feedback/review

❌ CANCELLED
   └─ User or admin cancelled
   └─ Refund processed
```

## Payment Processing

### Payment Flow

1. **Create Payment**
   - Booking record created with status "pending"
   - User selects payment method
   - Payment provider URL generated

2. **Process Payment**
   - User completes payment
   - Payment provider sends webhook confirmation
   - Booking status → "confirmed"
   - Earnings recorded for model

3. **Payment Failure**
   - Booking remains "pending"
   - User can retry or cancel
   - Auto-expires after timeout

4. **Refund Processing**
   - On booking cancellation
   - On call completion with shorter duration
   - Processed through payment provider

### Commission Structure

```
Platform Commission: 30% (configurable)
Model Earnings: 70%

Example:
  Booking: $100
  Platform: $30
  Model: $70
```

## Real-Time Updates

### Model Status Changes

```javascript
// Admin toggles model online
await ModelManagementModel.updateModelStatus(model_id, 'online');
// Instantly visible to all users

// During active booking
await ModelManagementModel.updateModelStatus(model_id, 'busy', booking_id);

// After call ends
await ModelManagementModel.updateModelStatus(model_id, 'online');
```

### Availability Checking

System checks:
1. Model's weekly recurring schedule
2. Existing bookings for that date/time
3. Model's current status

Available slots calculated in 15-minute increments.

## Integration Points

### Files & Handlers

```
src/models/
  └── modelManagementModel.js (Core database operations)

src/bot/handlers/
  ├── user/
  │   ├── privateCallsBooking.js (User booking interface)
  │   └── mainMenuIntegration.js (Menu integration)
  └── admin/
      └── modelManagement.js (Admin panel)

src/bot/services/
  └── bookingPaymentService.js (Payment processing)

database/migrations/
  └── 004_create_models_system.sql (Database schema)
```

### Configuration

```javascript
// Price per minute (set per model)
model.price_per_minute = 5.00;

// Duration limits (set per model)
model.min_duration_minutes = 15;
model.max_duration_minutes = 120;

// Commission split (configurable)
const COMMISSION_PERCENTAGE = 30; // Platform gets 30%

// Video platform (Jitsi, Agora, etc.)
process.env.JITSI_DOMAIN = 'meet.jit.si';
```

## Key Features

### ✅ For Users
- Browse available models
- View photos, bio, ratings
- Real-time availability checking
- Easy date/time selection
- Multiple payment methods
- Video call via Jitsi/Agora
- Leave reviews and ratings
- View booking history

### ✅ For Admins
- Add/edit models
- Set pricing per model
- Manage weekly availability
- Toggle real-time status (online/offline/busy)
- Upload model photos (gallery)
- View all bookings
- Track model earnings
- Commission management
- Deactivate models

### ✅ System Features
- Automatic status management (busy during calls)
- Real-time slot availability
- Payment processing & refunds
- Earnings tracking
- Review/rating system
- Call room generation
- Commission split tracking

## API Endpoints (Future)

```
POST /api/models/create
POST /api/models/:id/update
POST /api/models/:id/status
POST /api/models/:id/photos
POST /api/bookings/create
GET  /api/bookings/:userId
GET  /api/availability/:modelId/:date
POST /api/bookings/:id/complete
POST /api/bookings/:id/cancel
```

## Admin Commands

```
/admin_models          - Main model management menu
/add_model             - Create new model (wizard)
/view_models_list      - List all models
/edit_model:[ID]       - Edit model details
/toggle_model_status   - Change online/offline/busy
/set_availability      - Set availability hours
/deactivate_model      - Hide model from booking
```

## User Commands

```
/book_private_call     - Browse and book models
/my_bookings          - View user's reservations
/model:[ID]           - View model profile
```

## Troubleshooting

### Issue: "No available slots"
- Check model's weekly availability schedule
- Check for existing bookings on that date
- Ensure model status is "online" or "busy" (not "offline")

### Issue: Payment failed
- Check payment provider settings
- Verify Stripe/ePayco/Daimo credentials
- Test webhook delivery

### Issue: Model doesn't see online
- Check model's status in database
- Admin must toggle status or it defaults to "offline"
- Verify availability is set for current day

### Issue: Call room not generated
- Check Jitsi domain configuration
- Verify JITSI_DOMAIN environment variable
- Check booking status is "active"

## Future Enhancements

- [ ] Video preview/sample clips
- [ ] Model verification badge system
- [ ] Premium model tier system
- [ ] Loyalty rewards/discounts
- [ ] Scheduled recurring calls
- [ ] Group calls (multiple models)
- [ ] Instant call alerts to model
- [ ] Performance analytics dashboard
- [ ] Custom call themes/backgrounds
- [ ] Model referral system

---

## Quick Start for Admins

1. **Access Admin Panel**: `/admin_models`
2. **Add Your First Model**: Click "➕ Add New Model"
3. **Complete 7-Step Wizard**: Fill in username, name, bio, price, duration, photo, availability
4. **Go Live**: Model appears in users' booking list immediately
5. **Manage Status**: Toggle online/offline as needed throughout day
6. **View Earnings**: Check booking dashboard for revenue tracking

## Support

For issues or questions:
- Check logs: `/root/pnptvbot-production/logs/`
- Check database: `pnptvbot` PostgreSQL database
- Review model status: Check `model_status` table for real-time status
