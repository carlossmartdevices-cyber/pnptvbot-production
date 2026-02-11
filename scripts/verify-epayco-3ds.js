#!/usr/bin/env node

/**
 * Script to verify if 3DS is enabled in ePayco account
 * Makes a real tokenized test charge and analyzes response for 3DS support.
 *
 * Exit codes:
 * 0 = 3DS verified (pending + bank redirect URL)
 * 1 = technical/configuration error
 * 2 = charge processed but 3DS not enforced
 */

require('dotenv').config({ allowEmptyValues: true });
const epayco = require('epayco-sdk-node');

const epaycoClient = epayco({
  apiKey: process.env.EPAYCO_PUBLIC_KEY,
  privateKey: process.env.EPAYCO_PRIVATE_KEY,
  lang: 'ES',
  test: process.env.EPAYCO_TEST_MODE === 'true',
});

async function verifyEpayco3DS() {
  console.log('\n================================');
  console.log('ePayco 3DS Verification');
  console.log('================================\n');

  console.log('📋 Checking ePayco configuration...');
  console.log(`  Test Mode: ${process.env.EPAYCO_TEST_MODE === 'true' ? 'YES' : 'NO'}`);
  console.log(`  Credentials: ${!!process.env.EPAYCO_PUBLIC_KEY ? '✅' : '❌'}\n`);

  if (!process.env.EPAYCO_PUBLIC_KEY || !process.env.EPAYCO_PRIVATE_KEY) {
    console.error('❌ ERROR: ePayco credentials not configured!');
    process.exit(1);
  }

  try {
    // Step 1: Create token
    console.log('🔄 Step 1: Tokenizing card...');
    const token = await epaycoClient.token.create({
      'card[number]': '4575623182290326',
      'card[exp_year]': '2027',
      'card[exp_month]': '12',
      'card[cvc]': '123',
      hasCvv: true,
    });

    const tokenCard = token?.id || token?.data?.id || token?.data?.token;
    if (!tokenCard) {
      console.error('❌ Tokenization failed:', JSON.stringify(token, null, 2));
      process.exit(1);
    }
    console.log(`✅ Card tokenized: ${tokenCard.substring(0, 20)}...\n`);

    // Step 2: Create customer with tokenized card
    console.log('🔄 Step 2: Creating customer...');
    const customer = await epaycoClient.customers.create({
      token_card: tokenCard,
      name: 'ThreeDS',
      last_name: 'Verifier',
      email: `threeds-${Date.now()}@example.com`,
      default: true,
      city: 'Bogota',
      address: 'Test Street',
      phone: '3001234567',
      cell_phone: '3001234567',
    });

    const customerId = customer?.data?.customerId || customer?.data?.id_customer || customer?.id;
    if (!customerId) {
      console.error('❌ Customer creation failed:', JSON.stringify(customer, null, 2));
      process.exit(1);
    }
    console.log(`✅ Customer created: ${customerId}\n`);

    // Step 3: Make charge with 3DS
    console.log('🔄 Step 3: Making charge with 3DS enabled...');
    const charge = await epaycoClient.charge.create({
      customer_id: customerId,
      token_card: tokenCard,
      doc_type: 'CC',
      doc_number: '1035851980',
      name: 'ThreeDS',
      last_name: 'Verifier',
      email: `threeds-${Date.now()}@example.com`,
      city: 'Bogota',
      address: 'Test Street',
      phone: '3001234567',
      cell_phone: '3001234567',
      bill: 'TEST-3DS-' + Date.now(),
      description: 'Test 3DS Verification',
      value: '100000', // Higher amount to trigger 3DS
      tax: '0',
      tax_base: '0',
      currency: 'COP',
      dues: '1',
      url_response: 'https://pnptv.app/api/payment-response',
      url_confirmation: 'https://easybots.store/api/webhook/epayco',
      method_confirmation: 'POST',
      use_default_card_customer: true,
      three_d_secure: true,
      ip: '127.0.0.1',
    });

    console.log('✅ Charge processed\n');

    // Analyze response
    const chargeData = charge?.data || {};
    const estado = chargeData.estado;

    console.log('📊 Response Analysis:');
    console.log(`  Estado: ${estado || chargeData.status || 'NOT FOUND'}`);
    console.log(`  Ref PayCo: ${chargeData.ref_payco || 'NOT FOUND'}`);

    // Check for 3DS URL
    const has3DSUrl =
      !!chargeData.urlbanco ||
      !!chargeData.url_response_bank ||
      !!chargeData.url ||
      !!chargeData['3DS'];

    console.log(`\n🔍 3DS Detection:`);
    console.log(`  Status requires 3DS: ${estado === 'Pendiente' ? '✅ YES' : '❌ NO'}`);
    console.log(`  Bank URL provided: ${has3DSUrl ? '✅ YES' : '❌ NO'}`);

    if (estado === 'Pendiente' && has3DSUrl) {
      console.log('\n✅ 3D SECURE IS WORKING PROPERLY!');
      console.log('   ePayco would redirect user to bank for authentication');
      process.exit(0);
    } else if (estado === 'Pendiente' && !has3DSUrl) {
      console.log('\n⚠️  ISSUE: 3DS status but no redirect URL');
      console.log('   Check ePayco Dashboard → Configuración → Seguridad');
      process.exit(2);
    } else if (estado === 'Aceptada' || estado === 'Aprobada') {
      console.log('\n⚠️  Payment approved without 3DS');
      console.log('   3DS likely NOT enabled or not required');
      console.log('\n   To enable 3DS:');
      console.log('   1. Go to ePayco Dashboard');
      console.log('   2. Configuración → Seguridad → 3D Secure');
      console.log('   3. Enable it and save');
      process.exit(2);
    } else {
      console.log(`\n❌ Unexpected status: ${estado || chargeData.status || 'UNKNOWN'}`);
      process.exit(1);
    }

    // Show full response for debugging
    console.log('\n📄 Full Charge Response:');
    console.log(JSON.stringify(chargeData, null, 2).substring(0, 1000));

    console.log('\n✅ Verification complete!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Details:', error.response?.data || error);
    process.exit(1);
  }
}

verifyEpayco3DS().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
