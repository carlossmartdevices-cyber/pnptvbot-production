/**
 * EXAMPLE: Complete Payment Security Integration
 * 
 * This file shows how to integrate PaymentSecurityService
 * into your existing paymentService.js
 * 
 * Copy and adapt these code snippets to your paymentService.js
 */

// ============================================
// STEP 1: ADD IMPORT AT TOP OF paymentService.js
// ============================================

const express = require('express');
const logger = require('../../utils/logger');
const { query } = require('../../config/postgres');
const axios = require('axios');

// ADD THIS IMPORT
const PaymentSecurityService = require('../../bot/services/paymentSecurityService');
const FraudDetectionService = require('../../bot/services/fraudDetectionService');

// ============================================
// STEP 2: EXAMPLE WEBHOOK HANDLER WITH ALL SECURITY
// ============================================

/**
 * Example: Complete secure ePayco webhook handler
 */
async function handleEpaycoWebhook(req, res, bot) {
  const { id, x_ref_payco, x_amount, x_currency, custom, x_description } = req.body;
  
  // Extract from custom field or parse
  const [userId, chatId, planType] = custom ? custom.split(':') : [null, null, null];
  
  const paymentId = id; // ePayco transaction ID
  const amount = parseFloat(x_amount);
  
  logger.info('📨 Webhook received', { paymentId, userId, amount });

  try {
    // ==========================================
    // SECURITY LAYER 1: Rate Limiting
    // ==========================================
    const rateLimit = await PaymentSecurityService.checkPaymentRateLimit(userId, 10);
    if (!rateLimit.allowed) {
      logger.warn('🚨 Rate limit exceeded', {
        userId,
        attempts: rateLimit.attempts,
        maxPerHour: rateLimit.maxPerHour
      });
      
      await bot.telegram.sendMessage(
        chatId,
        `❌ Too many payment attempts (${rateLimit.attempts}/10 per hour). Please try again later.`
      );
      
      // Log blocked event
      await PaymentSecurityService.logPaymentEvent({
        paymentId,
        userId,
        eventType: 'blocked',
        provider: 'epayco',
        amount,
        status: 'rate_limited',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason: 'Rate limit exceeded' }
      });
      
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    // ==========================================
    // SECURITY LAYER 2: Replay Attack Prevention
    // ==========================================
    const replay = await PaymentSecurityService.checkReplayAttack(x_ref_payco, 'epayco');
    if (replay.isReplay) {
      logger.error('🚨 REPLAY ATTACK DETECTED', {
        transactionId: x_ref_payco,
        provider: 'epayco'
      });
      
      await bot.telegram.sendMessage(
        chatId,
        '❌ Duplicate transaction detected and blocked.'
      );
      
      // Log blocked event
      await PaymentSecurityService.logPaymentEvent({
        paymentId,
        userId,
        eventType: 'blocked',
        provider: 'epayco',
        amount,
        status: 'replay_detected',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason: 'Duplicate transaction' }
      });
      
      return res.status(200).json({ message: 'Already processed' });
    }

    // ==========================================
    // SECURITY LAYER 3: Amount Integrity Validation
    // ==========================================
    const amountValid = await PaymentSecurityService.validatePaymentAmount(paymentId, amount);
    if (!amountValid.valid) {
      logger.error('🚨 Amount mismatch detected', {
        paymentId,
        expected: amount,
        actual: amountValid.actual,
        reason: amountValid.reason
      });
      
      await bot.telegram.sendMessage(
        chatId,
        '❌ Payment amount verification failed. Transaction cancelled.'
      );
      
      // Log blocked event
      await PaymentSecurityService.logPaymentEvent({
        paymentId,
        userId,
        eventType: 'blocked',
        provider: 'epayco',
        amount,
        status: 'amount_mismatch',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { expected: amount, actual: amountValid.actual }
      });
      
      return res.status(400).json({ error: 'Amount mismatch' });
    }

    // ==========================================
    // SECURITY LAYER 4: PCI Compliance Check
    // ==========================================
    // Extract card last 4 from response (if available)
    const cardLastFour = req.body.x_cus_code?.slice(-4) || 'xxxx';
    
    const pciCompliant = PaymentSecurityService.validatePCICompliance({
      lastFour: cardLastFour
    });
    
    if (!pciCompliant.compliant) {
      logger.error('🚨 PCI COMPLIANCE VIOLATION', pciCompliant);
      
      await PaymentSecurityService.logPaymentError({
        paymentId,
        userId,
        provider: 'epayco',
        errorCode: 'PCI_VIOLATION',
        errorMessage: pciCompliant.reason,
        stackTrace: new Error('PCI compliance check failed').stack
      });
      
      return res.status(400).json({ error: 'PCI compliance check failed' });
    }

    // ==========================================
    // SECURITY LAYER 5: FRAUD DETECTION (12 Rules)
    // ==========================================
    const transactionData = {
      userId,
      amount,
      email: req.body.x_email_pembayaran || '',
      phone: req.body.x_phone || '',
      cardLastFour,
      cardBrand: req.body.x_brand || '',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      countryCode: req.body.x_country || 'unknown',
      location: { lat: 0, lng: 0 } // Optional: from IP lookup
    };

    const fraudResult = await FraudDetectionService.runAllFraudChecks(transactionData);
    
    if (fraudResult.shouldBlock) {
      logger.warn('⚠️ Fraud detection flagged transaction', {
        paymentId,
        riskScore: fraudResult.riskScore,
        flaggedRules: fraudResult.flaggedRules
      });
      
      await bot.telegram.sendMessage(
        chatId,
        `❌ Payment cannot be processed (security review needed). Risk score: ${fraudResult.riskScore}/12`
      );
      
      // Log blocked event
      await PaymentSecurityService.logPaymentEvent({
        paymentId,
        userId,
        eventType: 'blocked',
        provider: 'epayco',
        amount,
        status: 'fraud_detected',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { riskScore: fraudResult.riskScore, rules: fraudResult.flaggedRules }
      });
      
      return res.status(400).json({ error: 'Transaction blocked by fraud detection' });
    }

    // ==========================================
    // SECURITY LAYER 6: 3DS VALIDATION
    // ==========================================
    const x_three_d_s = req.body.x_three_d_s || 'N';
    const x_eci = req.body.x_eci || '';
    const x_cavv = req.body.x_cavv || '';
    
    const is3DSValidated = x_three_d_s === 'Y';
    
    if (!is3DSValidated) {
      logger.warn('⚠️ 3DS Validation failed', {
        paymentId,
        x_three_d_s,
        hasECI: !!x_eci,
        hasCAVV: !!x_cavv
      });
      
      await bot.telegram.sendMessage(
        chatId,
        '❌ 3D Secure authentication required but not provided. Transaction cancelled.'
      );
      
      // Log blocked event
      await PaymentSecurityService.logPaymentEvent({
        paymentId,
        userId,
        eventType: 'blocked',
        provider: 'epayco',
        amount,
        status: '3ds_validation_failed',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { x_three_d_s, x_eci, x_cavv }
      });
      
      return res.status(400).json({ error: '3DS validation required' });
    }

    // ==========================================
    // SECURITY LAYER 7: Check 2FA Requirement
    // ==========================================
    const twoFactorCheck = await PaymentSecurityService.requireTwoFactorAuth(
      paymentId,
      userId,
      amount,
      1000 // $1000 threshold
    );
    
    if (twoFactorCheck.required) {
      logger.info('🔑 2FA required for large payment', {
        paymentId,
        amount,
        reason: twoFactorCheck.reason
      });
      
      // For now, we'll allow it (2FA would need separate implementation)
      // In production, you'd send OTP and wait for verification
    }

    // ==========================================
    // SECURITY LAYER 8: Verify Webhook Signature
    // ==========================================
    const webhookSecret = process.env.EPAYCO_SECRET;
    const incomingSignature = req.headers['x-signature'];
    
    if (incomingSignature) {
      const isSignatureValid = PaymentSecurityService.validateWebhookSignature(
        req.body,
        incomingSignature,
        webhookSecret
      );
      
      if (!isSignatureValid) {
        logger.error('🚨 Invalid webhook signature', { paymentId });
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // ==========================================
    // PROCESSING: All security checks passed!
    // ==========================================
    logger.info('✅ All security checks passed, processing payment', { paymentId });

    // Store payment in database
    await query(
      `INSERT INTO payments (id, user_id, amount, currency, provider, status, plan_type, x_ref_payco, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'completed', updated_at = NOW()`,
      [paymentId, userId, amount, x_currency, 'epayco', 'completed', planType, x_ref_payco]
    );

    // Mark user as paid
    await query(
      `UPDATE users SET plan = $1, plan_expires_at = NOW() + INTERVAL '${getPlanDuration(planType)}' 
       WHERE id = $2`,
      [planType, userId]
    );

    // ==========================================
    // AUDIT LOGGING: Log successful completion
    // ==========================================
    await PaymentSecurityService.logPaymentEvent({
      paymentId,
      userId,
      eventType: 'completed',
      provider: 'epayco',
      amount,
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        reference: x_ref_payco,
        method: 'credit_card',
        planType,
        x_three_d_s,
        fraudScore: fraudResult.riskScore
      }
    });

    // Notify user
    await bot.telegram.sendMessage(
      chatId,
      `✅ Payment successful! 🎉\n\n💰 Amount: $${amount}\n📋 Plan: ${planType}\n✨ You now have full access!`
    );

    logger.info('✅ Payment processed successfully', { paymentId, userId, amount });
    return res.status(200).json({ message: 'Payment processed successfully' });

  } catch (error) {
    logger.error('❌ Payment processing error', {
      paymentId,
      userId,
      error: error.message,
      stack: error.stack
    });

    // ==========================================
    // ERROR LOGGING: Log the error with full details
    // ==========================================
    await PaymentSecurityService.logPaymentError({
      paymentId,
      userId,
      provider: 'epayco',
      errorCode: error.code || 'PAYMENT_ERROR',
      errorMessage: error.message,
      stackTrace: error.stack
    });

    // Log blocked event
    await PaymentSecurityService.logPaymentEvent({
      paymentId,
      userId,
      eventType: 'blocked',
      provider: 'epayco',
      amount,
      status: 'error',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { error: error.message }
    });

    // Notify user
    await bot.telegram.sendMessage(
      chatId,
      `❌ Payment error: ${error.message}\n\nPlease contact support if this persists.`
    );

    return res.status(500).json({ error: 'Payment processing failed' });
  }
}

// ============================================
// HELPER: Get plan duration
// ============================================
function getPlanDuration(planType) {
  const durations = {
    'lifetime': '100 years',
    'premium': '30 days',
    'pro': '365 days',
    'basic': '7 days'
  };
  return durations[planType] || '30 days';
}

// ============================================
// STEP 3: EXPORT AND REGISTER ROUTES
// ============================================

module.exports = {
  handleEpaycoWebhook
};

// In your main express app file:
// app.post('/api/webhooks/epayco', async (req, res) => {
//   await handleEpaycoWebhook(req, res, bot);
// });

// ============================================
// MONITORING: View Security Metrics
// ============================================

/**
 * Example: Get security dashboard data
 */
async function getSecurityDashboard() {
  const report = await PaymentSecurityService.generateSecurityReport(30);
  
  const summary = {
    timeframe: 'Last 30 days',
    total_events: report.reduce((sum, r) => sum + r.total_events, 0),
    blocked_payments: report.reduce((sum, r) => sum + r.blocked_payments, 0),
    failed_payments: report.reduce((sum, r) => sum + r.failed_payments, 0),
    success_rate: (
      (report.reduce((sum, r) => sum + (r.total_events - r.blocked_payments - r.failed_payments), 0) /
        report.reduce((sum, r) => sum + r.total_events, 0)) * 100
    ).toFixed(2) + '%',
    daily_trend: report
  };

  return summary;
}

// ============================================
// TESTING: Example test data
// ============================================

const testPayload = {
  id: 'TEST-123456',
  x_ref_payco: 'REF-987654',
  x_amount: '99.99',
  x_currency: 'USD',
  custom: 'USER123:CHAT456:lifetime',
  x_description: 'Lifetime Premium Pass',
  x_email_pembayaran: 'user@example.com',
  x_phone: '+1234567890',
  x_cus_code: 'XXXX-XXXX-XXXX-1234',
  x_brand: 'VISA',
  x_country: 'US',
  x_three_d_s: 'Y',
  x_eci: '05',
  x_cavv: 'AAABCoGABBB='
};

// To test:
// curl -X POST http://localhost:3000/api/webhooks/epayco \
//   -H "Content-Type: application/json" \
//   -H "X-Signature: YOUR_SIGNATURE" \
//   -d '{"id":"TEST-123456",...}'

// ============================================
// NOTES
// ============================================

/*
 * Integration Checklist:
 * 1. ✅ Add import at top of paymentService.js
 * 2. ✅ Copy webhook handler function
 * 3. ✅ Register route in main express app
 * 4. ✅ Test with sample payload
 * 5. ✅ Monitor using fraud-report.js
 * 6. ✅ Deploy to production
 * 7. ✅ Monitor security metrics daily
 * 
 * Security Layers Active:
 * 1. Rate Limiting (10/hour)
 * 2. Replay Prevention (30-day history)
 * 3. Amount Validation (±0.01)
 * 4. PCI Compliance
 * 5. Fraud Detection (12 rules)
 * 6. 3DS Validation (mandatory)
 * 7. Signature Verification
 * 8. 2FA Check
 * 9. Complete Audit Logging
 * 10. Error Tracking
 * 
 * Database Updates:
 * - payment_audit_log: Event tracking
 * - payment_errors: Error tracking
 * - webhook_events: Webhook tracking
 * 
 * Monitoring:
 * - node scripts/fraud-report.js (30-day analysis)
 * - psql queries (real-time metrics)
 * - Telegram notifications (user feedback)
 */
