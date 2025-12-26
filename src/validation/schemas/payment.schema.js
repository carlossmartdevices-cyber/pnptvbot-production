const Joi = require('joi');

/**
 * Payment validation schemas
 * Centralized validation rules for payment-related data
 */
const schemas = {
  /**
   * Payment amount validation
   * Must be positive number with max 2 decimal places
   */
  amount: Joi.number()
    .positive()
    .precision(2)
    .max(1000000)
    .required()
    .messages({
      'number.positive': 'Amount must be a positive number',
      'number.max': 'Amount cannot exceed 1,000,000',
      'any.required': 'Amount is required',
    }),

  /**
   * Plan ID validation
   */
  planId: Joi.string()
    .pattern(/^[a-z0-9_-]+$/)
    .max(50)
    .required()
    .messages({
      'string.pattern.base': 'Plan ID must contain only lowercase letters, numbers, hyphens, and underscores',
      'any.required': 'Plan ID is required',
    }),

  /**
   * Payment provider validation
   */
  provider: Joi.string()
    .valid('daimo', 'epayco', 'paypal')
    .required()
    .messages({
      'any.only': 'Payment provider must be one of: daimo, epayco, paypal',
      'any.required': 'Payment provider is required',
    }),

  /**
   * Payment status validation
   */
  status: Joi.string()
    .valid('pending', 'completed', 'failed', 'refunded', 'cancelled')
    .required()
    .messages({
      'any.only': 'Invalid payment status',
      'any.required': 'Payment status is required',
    }),

  /**
   * Payment ID validation (external provider ID)
   */
  paymentId: Joi.string()
    .min(1)
    .max(255)
    .required()
    .messages({
      'any.required': 'Payment ID is required',
    }),

  /**
   * Transaction hash validation (for blockchain payments)
   */
  txHash: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{64}$/)
    .messages({
      'string.pattern.base': 'Transaction hash must be a valid Ethereum transaction hash',
    }),

  /**
   * Webhook signature validation
   */
  signature: Joi.string()
    .min(1)
    .required()
    .messages({
      'any.required': 'Webhook signature is required',
    }),

  /**
   * Create payment request validation
   */
  createPayment: Joi.object({
    userId: Joi.string().pattern(/^\d+$/).required(),
    planId: Joi.string().pattern(/^[a-z0-9_-]+$/).required(),
    amount: Joi.number().positive().precision(2).required(),
    provider: Joi.string().valid('daimo', 'epayco', 'paypal').required(),
    currency: Joi.string().valid('USD', 'COP', 'USDC').default('USD'),
    metadata: Joi.object().optional(),
  }),

  /**
   * Daimo webhook payload validation
   */
  daimoWebhook: Joi.object({
    event: Joi.string().valid('payment.completed', 'payment.failed', 'payment.refunded').required(),
    payment: Joi.object({
      id: Joi.string().required(),
      amount: Joi.number().positive().required(),
      currency: Joi.string().valid('USDC').required(),
      status: Joi.string().valid('completed', 'failed', 'refunded').required(),
      txHash: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).optional(),
      createdAt: Joi.date().iso().required(),
    }).required(),
    user: Joi.object({
      id: Joi.string().required(),
    }).optional(),
    metadata: Joi.object().optional(),
  }),

  /**
   * ePayco webhook payload validation
   */
  epaycoWebhook: Joi.object({
    x_cust_id_cliente: Joi.string().required(),
    x_ref_payco: Joi.string().required(),
    x_transaction_id: Joi.string().required(),
    x_amount: Joi.number().positive().required(),
    x_currency_code: Joi.string().valid('COP', 'USD').required(),
    x_transaction_state: Joi.string().valid('Aceptada', 'Rechazada', 'Pendiente').required(),
    x_signature: Joi.string().required(),
  }),

  /**
   * Payment query filters validation
   */
  paymentQuery: Joi.object({
    userId: Joi.string().pattern(/^\d+$/).optional(),
    status: Joi.string().valid('pending', 'completed', 'failed', 'refunded', 'cancelled').optional(),
    provider: Joi.string().valid('daimo', 'epayco', 'paypal').optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
    minAmount: Joi.number().positive().optional(),
    maxAmount: Joi.number().positive().min(Joi.ref('minAmount')).optional(),
    limit: Joi.number().integer().min(1).max(100)
      .default(10),
    offset: Joi.number().integer().min(0).default(0),
  }),

  /**
   * Refund request validation
   */
  refundRequest: Joi.object({
    paymentId: Joi.string().required(),
    reason: Joi.string().min(10).max(500).required(),
    amount: Joi.number().positive().precision(2).optional(), // Partial refund
  }),
};

module.exports = { schemas };
