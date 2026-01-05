# Payment Flow Screenshots Documentation

This document provides a comprehensive guide for capturing screenshots of all payment steps across all payment methods supported by the PnP TV Bot.

## Overview

The bot supports **3 payment methods**:
1. **ePayco** (Colombian payment processor - Credit/Debit cards)
2. **Daimo Pay** (Crypto/Web3 - USDC payments)
3. **PayPal** (International payments)

Each payment method has multiple steps and options that need to be documented with screenshots.

---

## Screenshot Naming Convention

Use the following naming pattern for all screenshots:
```
{step_number}_{payment_method}_{description}.png
```

Examples:
- `01_epayco_plan_selection.png`
- `02_daimo_payment_method_selection.png`
- `03_paypal_checkout_page.png`

---

## 📸 Screenshot Checklist

### **STEP 1: Initial Subscription Flow** (Common to all methods)

#### 1.1 Starting Subscription
- [ ] **File**: `01_common_start_command.png`
  - **How**: Send `/subscribe` command to the bot
  - **Shows**: Initial response with subscription options

#### 1.2 Subscription Plans Display
- [ ] **File**: `02_common_plans_list.png`
  - **How**: Click "Show subscription plans" button
  - **Shows**: All available plans (Trial, Crystal, Diamond, Monthly, Lifetime)
  - **Contains**:
    - Plan names
    - Prices in USD
    - Duration information
    - Plan descriptions

#### 1.3 Plan Selection
Create screenshots for **EACH plan type**:

- [ ] **File**: `03a_common_trial_plan_selected.png`
  - **How**: Click "Trial" plan button
  - **Shows**: Trial plan confirmation message

- [ ] **File**: `03b_common_crystal_plan_selected.png`
  - **How**: Click "Crystal" plan button
  - **Shows**: Crystal plan confirmation message

- [ ] **File**: `03c_common_diamond_plan_selected.png`
  - **How**: Click "Diamond" plan button
  - **Shows**: Diamond plan confirmation message

- [ ] **File**: `03d_common_monthly_plan_selected.png`
  - **How**: Click "Monthly" plan button
  - **Shows**: Monthly plan confirmation message

- [ ] **File**: `03e_common_lifetime_plan_selected.png`
  - **How**: Click "Lifetime Pass" plan button
  - **Shows**: Lifetime plan confirmation message

#### 1.4 Payment Method Selection
- [ ] **File**: `04_common_payment_methods.png`
  - **How**: After selecting any plan
  - **Shows**: All three payment method buttons:
    - "Pay with ePayco" 💳
    - "Pay with Daimo" 🔷
    - "Pay with PayPal" 🅿️

---

### **METHOD 1: ePayco Payment Flow** 💳

#### 2.1 ePayco - Payment Initialization
- [ ] **File**: `05_epayco_method_selected.png`
  - **How**: Click "Pay with ePayco" button
  - **Shows**: Loading message or confirmation that payment is being prepared

#### 2.2 ePayco - Checkout Page (Desktop)
- [ ] **File**: `06_epayco_checkout_desktop.png`
  - **How**: Open checkout URL in desktop browser
  - **Shows**: ePayco checkout form with:
    - Plan name and amount
    - Card number input field
    - Expiry date field
    - CVV field
    - Cardholder name
    - Email field
    - "Pay Now" button
    - ePayco branding

#### 2.3 ePayco - Checkout Page (Mobile)
- [ ] **File**: `07_epayco_checkout_mobile.png`
  - **How**: Open same checkout URL on mobile device
  - **Shows**: Mobile-responsive version of checkout form

#### 2.4 ePayco - Language Options
- [ ] **File**: `08a_epayco_checkout_spanish.png`
  - **How**: Open checkout URL with `?lang=es` parameter
  - **Shows**: Spanish version of checkout page

- [ ] **File**: `08b_epayco_checkout_english.png`
  - **How**: Open checkout URL with `?lang=en` parameter
  - **Shows**: English version of checkout page

#### 2.5 ePayco - Card Input States
- [ ] **File**: `09a_epayco_form_empty.png`
  - **Shows**: Empty form (initial state)

- [ ] **File**: `09b_epayco_form_filled.png`
  - **Shows**: Form with test card data filled in
  - **Test card**: Use ePayco test cards from their documentation

- [ ] **File**: `09c_epayco_form_validation_error.png`
  - **Shows**: Validation errors (e.g., invalid card number)

#### 2.6 ePayco - Processing
- [ ] **File**: `10_epayco_processing.png`
  - **How**: Click "Pay Now" with test card
  - **Shows**: Processing/loading state

#### 2.7 ePayco - Success Response
- [ ] **File**: `11_epayco_success_page.png`
  - **Shows**: Success confirmation page from ePayco

- [ ] **File**: `12_epayco_success_telegram.png`
  - **Shows**: Payment confirmation message in Telegram with:
    - Transaction ID
    - Plan details
    - Expiry date
    - Invite link to PRIME channel

#### 2.8 ePayco - Failure Response
- [ ] **File**: `13_epayco_failure_page.png`
  - **How**: Use invalid test card or decline scenario
  - **Shows**: Payment failure message

- [ ] **File**: `14_epayco_failure_telegram.png`
  - **Shows**: Failure notification in Telegram

---

### **METHOD 2: Daimo Pay Flow** 🔷

#### 3.1 Daimo - Payment Initialization
- [ ] **File**: `15_daimo_method_selected.png`
  - **How**: Click "Pay with Daimo" button
  - **Shows**: Message about Daimo payment being prepared

#### 3.2 Daimo - Checkout Page
- [ ] **File**: `16_daimo_checkout_page.png`
  - **How**: Open Daimo checkout URL
  - **Shows**: Daimo Pay interface with:
    - Amount in USDC
    - Network: Optimism
    - Treasury address
    - Payment options selector

#### 3.3 Daimo - Payment App Options
Create screenshots for **EACH payment app option**:

- [ ] **File**: `17a_daimo_option_zelle.png`
  - **Shows**: Zelle payment option selected

- [ ] **File**: `17b_daimo_option_cashapp.png`
  - **Shows**: Cash App option selected

- [ ] **File**: `17c_daimo_option_venmo.png`
  - **Shows**: Venmo option selected

- [ ] **File**: `17d_daimo_option_revolut.png`
  - **Shows**: Revolut option selected

- [ ] **File**: `17e_daimo_option_wise.png`
  - **Shows**: Wise option selected

- [ ] **File**: `17f_daimo_option_crypto_wallet.png`
  - **Shows**: "All crypto wallets" option selected (MetaMask, Rainbow, etc.)

- [ ] **File**: `17g_daimo_option_exchange.png`
  - **Shows**: "All exchanges" option selected (Coinbase, Binance, etc.)

- [ ] **File**: `17h_daimo_option_address.png`
  - **Shows**: Direct address input option

#### 3.4 Daimo - QR Code Display
- [ ] **File**: `18_daimo_qr_code.png`
  - **Shows**: QR code for payment link
  - **Contains**: Scannable QR code and payment link

#### 3.5 Daimo - Payment Link
- [ ] **File**: `19_daimo_payment_link.png`
  - **Shows**: Copyable payment link displayed

#### 3.6 Daimo - Mobile Wallet Connection
- [ ] **File**: `20_daimo_wallet_connect.png`
  - **How**: Scan QR code with mobile wallet app
  - **Shows**: Wallet connection/authorization screen

#### 3.7 Daimo - Transaction Confirmation
- [ ] **File**: `21_daimo_tx_confirm.png`
  - **Shows**: Transaction confirmation in wallet app
  - **Contains**: Amount, recipient address, network, gas fees

#### 3.8 Daimo - Transaction Processing
- [ ] **File**: `22_daimo_tx_processing.png`
  - **Shows**: Transaction being processed on blockchain

#### 3.9 Daimo - Success Response
- [ ] **File**: `23_daimo_success_page.png`
  - **Shows**: Success confirmation on Daimo checkout page

- [ ] **File**: `24_daimo_success_telegram.png`
  - **Shows**: Payment confirmation in Telegram with:
    - Transaction hash
    - Plan details
    - PRIME channel invite link

#### 3.10 Daimo - Network Information
- [ ] **File**: `25_daimo_network_details.png`
  - **Shows**: Optimism network details (Chain ID: 10)
  - **Contains**: USDC token address (0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85)

---

### **METHOD 3: PayPal Flow** 🅿️

#### 4.1 PayPal - Payment Initialization
- [ ] **File**: `26_paypal_method_selected.png`
  - **How**: Click "Pay with PayPal" button
  - **Shows**: PayPal payment initialization message

#### 4.2 PayPal - Checkout Page
- [ ] **File**: `27_paypal_checkout_page.png`
  - **How**: Open PayPal checkout URL
  - **Shows**: PayPal Smart Payment Buttons interface
  - **Contains**:
    - Plan details
    - Amount
    - PayPal button
    - Alternative payment methods (if available)

#### 4.3 PayPal - Login Screen
- [ ] **File**: `28_paypal_login.png`
  - **How**: Click PayPal button
  - **Shows**: PayPal login/authentication screen

#### 4.4 PayPal - Payment Review
- [ ] **File**: `29_paypal_review.png`
  - **How**: After logging in
  - **Shows**: PayPal payment review screen with:
    - Merchant name (PnP TV)
    - Amount
    - Payment source selection
    - "Pay Now" button

#### 4.5 PayPal - Funding Source Selection
- [ ] **File**: `30a_paypal_funding_balance.png`
  - **Shows**: PayPal Balance selected as funding source

- [ ] **File**: `30b_paypal_funding_card.png`
  - **Shows**: Credit/Debit card selected

- [ ] **File**: `30c_paypal_funding_bank.png`
  - **Shows**: Bank account selected

#### 4.6 PayPal - Processing
- [ ] **File**: `31_paypal_processing.png`
  - **Shows**: Payment processing screen

#### 4.7 PayPal - Success Response
- [ ] **File**: `32_paypal_success_page.png`
  - **Shows**: PayPal success confirmation page

- [ ] **File**: `33_paypal_success_telegram.png`
  - **Shows**: Payment confirmation in Telegram with:
    - PayPal transaction ID
    - Plan details
    - Expiry date
    - PRIME channel invite link

#### 4.8 PayPal - User Cancellation
- [ ] **File**: `34_paypal_cancelled.png`
  - **How**: Click "Cancel and return" during checkout
  - **Shows**: Cancellation confirmation

#### 4.9 PayPal - Sandbox Mode Indicator
- [ ] **File**: `35_paypal_sandbox_mode.png`
  - **Shows**: PayPal sandbox environment indicator (if in test mode)

---

### **STEP 5: Post-Payment Experiences** (Common)

#### 5.1 Payment Confirmation Email - Invoice
- [ ] **File**: `36_email_invoice.png`
  - **Shows**: Email from easybots.store with:
    - Invoice number
    - Amount paid
    - Plan name
    - Payment date
    - Transaction reference

#### 5.2 Payment Confirmation Email - Welcome
- [ ] **File**: `37a_email_welcome_english.png`
  - **Shows**: Welcome email from pnptv.app (English version)

- [ ] **File**: `37b_email_welcome_spanish.png`
  - **Shows**: Welcome email from pnptv.app (Spanish version)

#### 5.3 PRIME Channel Access
- [ ] **File**: `38_prime_channel_invite.png`
  - **Shows**: Unique one-time invite link to PRIME channel

- [ ] **File**: `39_prime_channel_joined.png`
  - **Shows**: Successfully joined PRIME channel

#### 5.4 Payment History
- [ ] **File**: `40_payment_history_command.png`
  - **How**: Send `/payment_history` or similar command
  - **Shows**: User's payment history

- [ ] **File**: `41_payment_history_details.png`
  - **Shows**: Detailed view of a specific payment

#### 5.5 Subscription Status
- [ ] **File**: `42_subscription_status_active.png`
  - **Shows**: Active subscription status with expiry date

- [ ] **File**: `43_subscription_status_lifetime.png`
  - **Shows**: Lifetime subscription status (no expiry)

---

### **ADMIN VIEWS** (Optional but Recommended)

#### 6.1 Admin Payment Notification
- [ ] **File**: `44_admin_payment_alert.png`
  - **Shows**: Admin notification about new purchase
  - **Contains**: Customer details, amount, payment provider

#### 6.2 Admin Payment Analytics
- [ ] **File**: `45_admin_analytics_dashboard.png`
  - **Shows**: Payment analytics dashboard

#### 6.3 Admin Payment List
- [ ] **File**: `46_admin_payment_list.png`
  - **Shows**: List of all payments with filters

---

### **ERROR SCENARIOS** (Important for Debugging)

#### 7.1 Network Error
- [ ] **File**: `47_error_network.png`
  - **Shows**: Network connection error during payment

#### 7.2 Expired Checkout
- [ ] **File**: `48_error_expired_checkout.png`
  - **Shows**: Expired checkout link message

#### 7.3 Insufficient Funds (Daimo/Crypto)
- [ ] **File**: `49_error_insufficient_funds.png`
  - **Shows**: Insufficient USDC balance error

#### 7.4 Invalid Payment Reference
- [ ] **File**: `50_error_invalid_reference.png`
  - **Shows**: Invalid payment reference error

#### 7.5 Webhook Failure
- [ ] **File**: `51_error_webhook_timeout.png`
  - **Shows**: Webhook timeout or failure scenario

---

## 📋 Screenshot Capture Guide

### Prerequisites
1. **Test Environment Access**
   - Bot running locally or on staging server
   - Test API keys configured for all payment providers
   - Access to test payment credentials

2. **Test Accounts Required**
   - ePayco test account with test cards
   - Wallet with USDC on Optimism testnet (for Daimo)
   - PayPal sandbox account

3. **Tools Needed**
   - Screenshot tool (macOS: Cmd+Shift+4, Windows: Snipping Tool, Linux: Flameshot)
   - Mobile device or emulator for mobile screenshots
   - Multiple browsers for cross-browser testing

### Test Credentials

#### ePayco Test Cards
```
Success Card: 4575623182290326
CVV: 123
Expiry: Any future date

Declined Card: 4151611527583283
CVV: 123
Expiry: Any future date
```

#### Daimo Testnet
```
Network: Optimism Goerli (Testnet)
Chain ID: 420
Get test USDC from faucet
```

#### PayPal Sandbox
```
Use PayPal Developer Dashboard:
https://developer.paypal.com/dashboard/
Create sandbox test accounts
```

### Step-by-Step Capture Process

#### For Telegram Bot Screenshots:
1. Clear chat history with bot (optional, for clean screenshots)
2. Start screen recording tool
3. Execute each command/action
4. Take screenshot at each step
5. Annotate if needed (highlight important elements)

#### For Web Checkout Screenshots:
1. Open browser in desired size (1920x1080 for desktop, mobile dimensions for mobile)
2. Clear cookies and cache
3. Navigate to checkout URL
4. Take full-page screenshots
5. Capture different screen sizes (desktop, tablet, mobile)

#### For Email Screenshots:
1. Configure email service to use test email address
2. Complete payment flow
3. Check inbox
4. Take screenshot of email (both HTML and plain text if applicable)

### Quality Standards
- **Resolution**: Minimum 1920x1080 for desktop, actual device resolution for mobile
- **Format**: PNG (lossless compression)
- **Content**: Ensure no real personal information is visible
- **Clarity**: Screenshots should be sharp and readable
- **Annotations**: Add arrows or highlights only if clarifying complex steps

---

## 🔧 Automation Script

A helper script is provided to automate some aspects of screenshot capture:

**Location**: `scripts/capture-payment-screenshots.js`

**Usage**:
```bash
node scripts/capture-payment-screenshots.js --method=epayco --plan=lifetime
```

**Options**:
- `--method`: epayco, daimo, paypal, or all
- `--plan`: trial, crystal, diamond, monthly, lifetime, or all
- `--lang`: en, es, or both (for language-specific screenshots)
- `--output`: Output directory (default: docs/screenshots/payment-flow)

---

## 📊 Progress Tracking

Use this checklist to track screenshot capture progress:

### Overall Progress
- [ ] Common subscription flow (Steps 1.1 - 1.4)
- [ ] ePayco complete flow (all screenshots)
- [ ] Daimo complete flow (all screenshots)
- [ ] PayPal complete flow (all screenshots)
- [ ] Post-payment experiences (all screenshots)
- [ ] Admin views (all screenshots)
- [ ] Error scenarios (all screenshots)

### By Payment Method
- [ ] ePayco: ___/20 screenshots captured
- [ ] Daimo: ___/15 screenshots captured
- [ ] PayPal: ___/12 screenshots captured
- [ ] Common: ___/10 screenshots captured
- [ ] Admin: ___/3 screenshots captured
- [ ] Errors: ___/5 screenshots captured

**Total**: ___/65 screenshots

---

## 📁 File Organization

All screenshots should be organized in the following structure:

```
docs/screenshots/payment-flow/
├── common/
│   ├── 01_common_start_command.png
│   ├── 02_common_plans_list.png
│   ├── 03a_common_trial_plan_selected.png
│   └── ...
├── epayco/
│   ├── 05_epayco_method_selected.png
│   ├── 06_epayco_checkout_desktop.png
│   ├── 07_epayco_checkout_mobile.png
│   └── ...
├── daimo/
│   ├── 15_daimo_method_selected.png
│   ├── 16_daimo_checkout_page.png
│   ├── 17a_daimo_option_zelle.png
│   └── ...
├── paypal/
│   ├── 26_paypal_method_selected.png
│   ├── 27_paypal_checkout_page.png
│   ├── 28_paypal_login.png
│   └── ...
├── post-payment/
│   ├── 36_email_invoice.png
│   ├── 37a_email_welcome_english.png
│   └── ...
├── admin/
│   ├── 44_admin_payment_alert.png
│   └── ...
└── errors/
    ├── 47_error_network.png
    └── ...
```

---

## 🔗 Related Documentation

- [ePayco Integration](./EPAYCO_INTEGRATION.md)
- [Daimo Pay Integration](./DAIMO_PAY_INTEGRATION.md)
- [Payment Reference Tracking](../PAYMENT_REFERENCE_TRACKING.md)
- [Payment Security](../src/bot/services/paymentSecurityService.js)

---

## 📝 Notes

1. **Privacy**: Ensure all screenshots use test data only. No real payment information should be visible.
2. **Consistency**: Use the same test user and test data across all screenshots for consistency.
3. **Updates**: When the UI changes, update screenshots accordingly and note the update date.
4. **Accessibility**: Consider capturing screenshots with different accessibility settings (high contrast, screen readers, etc.)
5. **Localization**: Capture both English and Spanish versions where applicable.

---

## 📅 Maintenance

- **Last Updated**: 2026-01-05
- **Next Review**: Before each major release
- **Responsible**: Development team
- **Version**: 1.0.0

---

## ✅ Sign-off

Once all screenshots are captured and organized:

- [ ] All screenshots captured and named correctly
- [ ] Screenshots organized in proper folder structure
- [ ] Test data verified (no real personal information)
- [ ] Documentation reviewed and approved
- [ ] Screenshots added to version control
- [ ] README updated with links to this documentation
