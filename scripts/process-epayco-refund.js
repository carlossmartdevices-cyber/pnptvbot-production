#!/usr/bin/env node
/**
 * Process ePayco Refund
 * Initiate a refund through ePayco REST API
 * 
 * Usage:
 *   node scripts/process-epayco-refund.js <ref_payco>
 * 
 * Example:
 *   node scripts/process-epayco-refund.js 320358448
 * 
 * Documentation:
 * https://docs.epayco.co/payments/anular-transacciones
 */

require('dotenv').config();
const axios = require('axios');
const logger = require('../src/utils/logger');

const EPAYCO_API_URL = 'https://api.secure.payco.co';

/**
 * Get ePayco Bearer token for API authentication
 * @returns {Promise<string>} Bearer token
 */
async function getEpaycoToken() {
  try {
    const response = await axios.post(`${EPAYCO_API_URL}/v1/auth/login`, {
      public_key: process.env.EPAYCO_PUBLIC_KEY,
      private_key: process.env.EPAYCO_PRIVATE_KEY,
    });

    if (response.data && response.data.token) {
      return response.data.token;
    }

    throw new Error('No token received from ePayco');
  } catch (error) {
    logger.error('Error getting ePayco token:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Process refund for an ePayco transaction
 * @param {string} refPayco - ePayco reference (x_ref_payco)
 * @returns {Promise<Object>} Refund result
 */
async function processRefund(refPayco) {
  try {
    console.log('\n💳 Processing ePayco Refund...');
    console.log(`Reference (Ref.Payco): ${refPayco}`);
    console.log('');

    // Get authentication token
    console.log('🔐 Authenticating with ePayco API...');
    const token = await getEpaycoToken();
    console.log('✅ Authentication successful');
    console.log('');

    // Call refund API
    console.log('💰 Initiating refund...');
    const refundResponse = await axios.post(
      `${EPAYCO_API_URL}/v1/transaction/${refPayco}/cancel`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (refundResponse.data.success) {
      console.log('✅ REFUND SUCCESSFUL!');
      console.log('');
      console.log('Refund Details:');
      console.log(`  Transaction ID: ${refundResponse.data.data?.transaction_id || 'N/A'}`);
      console.log(`  Status: ${refundResponse.data.data?.status || 'Refunded'}`);
      console.log(`  Amount: ${refundResponse.data.data?.amount || 'N/A'}`);
      console.log('');
      console.log('⚠️  Next Steps:');
      console.log('  1. Update the payment status in the database');
      console.log('  2. Notify the user about the refund');
      console.log('  3. Check ePayco dashboard to verify refund processing');
      console.log('');
      
      return {
        success: true,
        data: refundResponse.data,
      };
    } else {
      console.error('❌ Refund failed:', refundResponse.data.error || 'Unknown error');
      return {
        success: false,
        error: refundResponse.data.error,
      };
    }
  } catch (error) {
    console.error('\n❌ ERROR processing refund:');
    
    if (error.response) {
      console.error('API Error:', error.response.data);
      console.error('Status Code:', error.response.status);
      
      // Common error messages
      if (error.response.status === 404) {
        console.error('\n💡 Transaction not found. Possible reasons:');
        console.error('   - Invalid reference number');
        console.error('   - Transaction already refunded');
        console.error('   - Reference does not exist in ePayco');
      } else if (error.response.status === 401) {
        console.error('\n💡 Authentication failed. Check your ePayco credentials in .env');
      } else if (error.response.status === 400) {
        console.error('\n💡 Bad request. The transaction may not be eligible for refund.');
        console.error('   Reasons could include:');
        console.error('   - Transaction already refunded');
        console.error('   - Refund window expired');
        console.error('   - Transaction status does not allow refunds');
      }
    } else {
      console.error('Error:', error.message);
    }
    
    console.error('\n📖 Alternative: Manual refund via ePayco Dashboard');
    console.error('   1. Login to https://dashboard.epayco.co');
    console.error(`   2. Search for transaction: ${refPayco}`);
    console.error('   3. Click "Anular" (Cancel/Refund)');
    console.error('');
    
    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 1) {
  console.log('Usage: node scripts/process-epayco-refund.js <ref_payco>');
  console.log('');
  console.log('Example:');
  console.log('  node scripts/process-epayco-refund.js 320358448');
  console.log('');
  console.log('To process multiple refunds:');
  console.log('  node scripts/process-epayco-refund.js 320358448');
  console.log('  node scripts/process-epayco-refund.js 320357719');
  process.exit(1);
}

const refPayco = args[0];

processRefund(refPayco).then((result) => {
  if (result.success) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});
