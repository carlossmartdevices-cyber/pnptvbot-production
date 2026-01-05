#!/usr/bin/env node

/**
 * Payment Screenshot Capture Helper
 *
 * This script helps automate and guide the process of capturing payment flow screenshots.
 * It provides interactive prompts and generates test payment URLs for screenshot capture.
 *
 * Usage:
 *   node scripts/capture-payment-screenshots.js [options]
 *
 * Options:
 *   --method=<epayco|daimo|paypal|all>  Payment method to capture
 *   --plan=<trial|crystal|diamond|monthly|lifetime|all>  Subscription plan
 *   --lang=<en|es|both>  Language for screenshots
 *   --output=<path>  Output directory for screenshots
 *   --interactive  Run in interactive mode (default)
 *   --generate-urls  Only generate test URLs without launching
 *   --help  Show this help message
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const CONFIG = {
  outputDir: 'docs/screenshots/payment-flow',
  methods: ['epayco', 'daimo', 'paypal'],
  plans: ['trial', 'crystal', 'diamond', 'monthly', 'lifetime'],
  languages: ['en', 'es'],
  baseUrl: process.env.BOT_WEBHOOK_DOMAIN || 'http://localhost:3000',
};

// Screenshot checklist based on documentation
const SCREENSHOT_CHECKLIST = {
  common: [
    { file: '01_common_start_command.png', description: '/subscribe command response' },
    { file: '02_common_plans_list.png', description: 'All subscription plans displayed' },
    { file: '03a_common_trial_plan_selected.png', description: 'Trial plan selected', plan: 'trial' },
    { file: '03b_common_crystal_plan_selected.png', description: 'Crystal plan selected', plan: 'crystal' },
    { file: '03c_common_diamond_plan_selected.png', description: 'Diamond plan selected', plan: 'diamond' },
    { file: '03d_common_monthly_plan_selected.png', description: 'Monthly plan selected', plan: 'monthly' },
    { file: '03e_common_lifetime_plan_selected.png', description: 'Lifetime plan selected', plan: 'lifetime' },
    { file: '04_common_payment_methods.png', description: 'Payment method selection buttons' },
  ],
  epayco: [
    { file: '05_epayco_method_selected.png', description: 'ePayco payment method selected' },
    { file: '06_epayco_checkout_desktop.png', description: 'ePayco checkout page (desktop)', device: 'desktop' },
    { file: '07_epayco_checkout_mobile.png', description: 'ePayco checkout page (mobile)', device: 'mobile' },
    { file: '08a_epayco_checkout_spanish.png', description: 'ePayco checkout (Spanish)', lang: 'es' },
    { file: '08b_epayco_checkout_english.png', description: 'ePayco checkout (English)', lang: 'en' },
    { file: '09a_epayco_form_empty.png', description: 'Empty ePayco form' },
    { file: '09b_epayco_form_filled.png', description: 'Filled ePayco form with test card' },
    { file: '09c_epayco_form_validation_error.png', description: 'Form validation errors' },
    { file: '10_epayco_processing.png', description: 'Payment processing state' },
    { file: '11_epayco_success_page.png', description: 'ePayco success page' },
    { file: '12_epayco_success_telegram.png', description: 'Success message in Telegram' },
    { file: '13_epayco_failure_page.png', description: 'ePayco failure page' },
    { file: '14_epayco_failure_telegram.png', description: 'Failure message in Telegram' },
  ],
  daimo: [
    { file: '15_daimo_method_selected.png', description: 'Daimo payment method selected' },
    { file: '16_daimo_checkout_page.png', description: 'Daimo checkout page' },
    { file: '17a_daimo_option_zelle.png', description: 'Zelle option selected', option: 'zelle' },
    { file: '17b_daimo_option_cashapp.png', description: 'Cash App option selected', option: 'cashapp' },
    { file: '17c_daimo_option_venmo.png', description: 'Venmo option selected', option: 'venmo' },
    { file: '17d_daimo_option_revolut.png', description: 'Revolut option selected', option: 'revolut' },
    { file: '17e_daimo_option_wise.png', description: 'Wise option selected', option: 'wise' },
    { file: '17f_daimo_option_crypto_wallet.png', description: 'Crypto wallet option', option: 'wallet' },
    { file: '17g_daimo_option_exchange.png', description: 'Exchange option', option: 'exchange' },
    { file: '17h_daimo_option_address.png', description: 'Direct address input', option: 'address' },
    { file: '18_daimo_qr_code.png', description: 'Daimo QR code display' },
    { file: '19_daimo_payment_link.png', description: 'Daimo payment link' },
    { file: '20_daimo_wallet_connect.png', description: 'Wallet connection screen', device: 'mobile' },
    { file: '21_daimo_tx_confirm.png', description: 'Transaction confirmation' },
    { file: '22_daimo_tx_processing.png', description: 'Transaction processing' },
    { file: '23_daimo_success_page.png', description: 'Daimo success page' },
    { file: '24_daimo_success_telegram.png', description: 'Success message in Telegram' },
    { file: '25_daimo_network_details.png', description: 'Network details (Optimism)' },
  ],
  paypal: [
    { file: '26_paypal_method_selected.png', description: 'PayPal method selected' },
    { file: '27_paypal_checkout_page.png', description: 'PayPal checkout page' },
    { file: '28_paypal_login.png', description: 'PayPal login screen' },
    { file: '29_paypal_review.png', description: 'PayPal payment review' },
    { file: '30a_paypal_funding_balance.png', description: 'PayPal Balance funding source' },
    { file: '30b_paypal_funding_card.png', description: 'Card funding source' },
    { file: '30c_paypal_funding_bank.png', description: 'Bank funding source' },
    { file: '31_paypal_processing.png', description: 'Payment processing' },
    { file: '32_paypal_success_page.png', description: 'PayPal success page' },
    { file: '33_paypal_success_telegram.png', description: 'Success in Telegram' },
    { file: '34_paypal_cancelled.png', description: 'User cancelled payment' },
    { file: '35_paypal_sandbox_mode.png', description: 'Sandbox mode indicator' },
  ],
  'post-payment': [
    { file: '36_email_invoice.png', description: 'Invoice email from easybots.store' },
    { file: '37a_email_welcome_english.png', description: 'Welcome email (English)', lang: 'en' },
    { file: '37b_email_welcome_spanish.png', description: 'Welcome email (Spanish)', lang: 'es' },
    { file: '38_prime_channel_invite.png', description: 'PRIME channel invite link' },
    { file: '39_prime_channel_joined.png', description: 'Successfully joined PRIME channel' },
    { file: '40_payment_history_command.png', description: 'Payment history command' },
    { file: '41_payment_history_details.png', description: 'Payment details view' },
    { file: '42_subscription_status_active.png', description: 'Active subscription status' },
    { file: '43_subscription_status_lifetime.png', description: 'Lifetime subscription status' },
  ],
  admin: [
    { file: '44_admin_payment_alert.png', description: 'Admin payment notification' },
    { file: '45_admin_analytics_dashboard.png', description: 'Payment analytics dashboard' },
    { file: '46_admin_payment_list.png', description: 'Admin payment list' },
  ],
  errors: [
    { file: '47_error_network.png', description: 'Network error' },
    { file: '48_error_expired_checkout.png', description: 'Expired checkout link' },
    { file: '49_error_insufficient_funds.png', description: 'Insufficient funds (Daimo)' },
    { file: '50_error_invalid_reference.png', description: 'Invalid payment reference' },
    { file: '51_error_webhook_timeout.png', description: 'Webhook timeout/failure' },
  ],
};

// Test card data
const TEST_DATA = {
  epayco: {
    successCard: {
      number: '4575623182290326',
      cvv: '123',
      expiry: '12/25',
      name: 'Test User',
    },
    declinedCard: {
      number: '4151611527583283',
      cvv: '123',
      expiry: '12/25',
      name: 'Test User',
    },
  },
  daimo: {
    network: 'Optimism',
    chainId: '10',
    tokenAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    testnetChainId: '420',
  },
  paypal: {
    sandboxAccount: 'buyer@example.com',
    sandboxPassword: 'Test123!',
  },
};

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60) + '\n');
}

function section(title) {
  console.log('');
  log(`▶ ${title}`, 'cyan');
  console.log('─'.repeat(60));
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    method: 'all',
    plan: 'all',
    lang: 'both',
    output: CONFIG.outputDir,
    interactive: true,
    generateUrls: false,
    help: false,
  };

  args.forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (key === 'interactive') options.interactive = true;
      else if (key === 'generate-urls') options.generateUrls = true;
      else if (key === 'help') options.help = true;
      else if (value) options[key] = value;
    }
  });

  return options;
}

// Display help message
function showHelp() {
  header('Payment Screenshot Capture Helper');

  console.log('Usage:');
  console.log('  node scripts/capture-payment-screenshots.js [options]\n');

  console.log('Options:');
  console.log('  --method=<epayco|daimo|paypal|all>    Payment method to capture (default: all)');
  console.log('  --plan=<trial|crystal|diamond|monthly|lifetime|all>  Plan type (default: all)');
  console.log('  --lang=<en|es|both>                    Language for screenshots (default: both)');
  console.log('  --output=<path>                        Output directory (default: docs/screenshots/payment-flow)');
  console.log('  --interactive                          Run in interactive mode (default)');
  console.log('  --generate-urls                        Only generate test URLs');
  console.log('  --help                                 Show this help message\n');

  console.log('Examples:');
  console.log('  node scripts/capture-payment-screenshots.js');
  console.log('  node scripts/capture-payment-screenshots.js --method=epayco --plan=lifetime');
  console.log('  node scripts/capture-payment-screenshots.js --generate-urls');
  console.log('');
}

// Generate test payment URLs
function generateTestUrls(plan = 'trial', method = 'epayco', lang = 'en') {
  const urls = {};

  // Generate a mock payment ID for URL generation
  const mockPaymentId = `test-${Date.now()}`;

  urls.epayco = {
    default: `${CONFIG.baseUrl}/checkout/${mockPaymentId}`,
    english: `${CONFIG.baseUrl}/payment/${mockPaymentId}?lang=en`,
    spanish: `${CONFIG.baseUrl}/payment/${mockPaymentId}?lang=es`,
  };

  urls.daimo = {
    default: `${CONFIG.baseUrl}/daimo-checkout/${mockPaymentId}`,
  };

  urls.paypal = {
    default: `${CONFIG.baseUrl}/paypal-checkout/${mockPaymentId}`,
  };

  return urls;
}

// Display test data
function displayTestData() {
  section('Test Data');

  log('\nePayco Test Cards:', 'green');
  console.log('\nSuccess Card:');
  console.log(`  Number: ${TEST_DATA.epayco.successCard.number}`);
  console.log(`  CVV: ${TEST_DATA.epayco.successCard.cvv}`);
  console.log(`  Expiry: ${TEST_DATA.epayco.successCard.expiry}`);
  console.log(`  Name: ${TEST_DATA.epayco.successCard.name}`);

  console.log('\nDeclined Card:');
  console.log(`  Number: ${TEST_DATA.epayco.declinedCard.number}`);
  console.log(`  CVV: ${TEST_DATA.epayco.declinedCard.cvv}`);
  console.log(`  Expiry: ${TEST_DATA.epayco.declinedCard.expiry}`);

  log('\nDaimo Network Details:', 'green');
  console.log(`  Network: ${TEST_DATA.daimo.network}`);
  console.log(`  Chain ID: ${TEST_DATA.daimo.chainId}`);
  console.log(`  USDC Token: ${TEST_DATA.daimo.tokenAddress}`);
  console.log(`  Testnet Chain ID: ${TEST_DATA.daimo.testnetChainId}`);

  log('\nPayPal Sandbox:', 'green');
  console.log('  Create sandbox accounts at:');
  console.log('  https://developer.paypal.com/dashboard/');
  console.log('');
}

// Display screenshot checklist for a specific method
function displayChecklist(method) {
  if (!SCREENSHOT_CHECKLIST[method]) {
    log(`Unknown method: ${method}`, 'red');
    return;
  }

  section(`${method.toUpperCase()} Screenshot Checklist`);

  const items = SCREENSHOT_CHECKLIST[method];
  console.log(`\nTotal screenshots needed: ${items.length}\n`);

  items.forEach((item, index) => {
    const extras = [];
    if (item.lang) extras.push(`lang: ${item.lang}`);
    if (item.device) extras.push(`device: ${item.device}`);
    if (item.plan) extras.push(`plan: ${item.plan}`);
    if (item.option) extras.push(`option: ${item.option}`);

    const extrasStr = extras.length > 0 ? ` [${extras.join(', ')}]` : '';
    console.log(`  ${(index + 1).toString().padStart(2)}. ${item.file}`);
    console.log(`      ${item.description}${extrasStr}`);
  });

  console.log('');
}

// Display all URLs for testing
function displayTestUrls(plan = 'trial') {
  section('Test URLs');

  const urls = generateTestUrls(plan);

  log('\nePayco URLs:', 'green');
  console.log(`  Default:  ${urls.epayco.default}`);
  console.log(`  English:  ${urls.epayco.english}`);
  console.log(`  Spanish:  ${urls.epayco.spanish}`);

  log('\nDaimo URL:', 'green');
  console.log(`  Default:  ${urls.daimo.default}`);

  log('\nPayPal URL:', 'green');
  console.log(`  Default:  ${urls.paypal.default}`);

  console.log('');
  log('Note: These are template URLs. Actual URLs will be generated when you create a test payment.', 'yellow');
  console.log('');
}

// Progress report
function displayProgress() {
  section('Screenshot Progress Report');

  const outputDir = CONFIG.outputDir;
  const categories = Object.keys(SCREENSHOT_CHECKLIST);

  let totalScreenshots = 0;
  let capturedScreenshots = 0;

  categories.forEach(category => {
    const categoryPath = path.join(outputDir, category);
    const expectedFiles = SCREENSHOT_CHECKLIST[category];
    totalScreenshots += expectedFiles.length;

    if (fs.existsSync(categoryPath)) {
      const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.png'));
      capturedScreenshots += files.length;

      const percentage = ((files.length / expectedFiles.length) * 100).toFixed(1);
      console.log(`  ${category.padEnd(15)} ${files.length}/${expectedFiles.length} (${percentage}%)`);
    } else {
      console.log(`  ${category.padEnd(15)} 0/${expectedFiles.length} (0%)`);
    }
  });

  console.log('\n  ' + '─'.repeat(40));
  const totalPercentage = ((capturedScreenshots / totalScreenshots) * 100).toFixed(1);
  console.log(`  Total Progress:  ${capturedScreenshots}/${totalScreenshots} (${totalPercentage}%)`);
  console.log('');
}

// Create README in screenshots directory
function createReadme() {
  const readmePath = path.join(CONFIG.outputDir, 'README.md');

  const content = `# Payment Flow Screenshots

This directory contains screenshots documenting the complete payment flow for all supported payment methods.

## Organization

Screenshots are organized by category:

- \`common/\` - Common subscription flow steps (applies to all methods)
- \`epayco/\` - ePayco payment method screenshots
- \`daimo/\` - Daimo Pay (crypto) screenshots
- \`paypal/\` - PayPal payment method screenshots
- \`post-payment/\` - Post-payment experiences (emails, confirmations)
- \`admin/\` - Admin dashboard and analytics views
- \`errors/\` - Error scenarios and edge cases

## Naming Convention

Screenshots follow this naming pattern:
\`\`\`
{step_number}_{payment_method}_{description}.png
\`\`\`

Example: \`06_epayco_checkout_desktop.png\`

## Documentation

See [PAYMENT_FLOW_SCREENSHOTS.md](../../PAYMENT_FLOW_SCREENSHOTS.md) for:
- Complete screenshot checklist
- Capture guidelines
- Test credentials
- Quality standards

## Maintenance

- **Last Updated**: ${new Date().toISOString().split('T')[0]}
- **Total Screenshots**: ${Object.values(SCREENSHOT_CHECKLIST).reduce((sum, arr) => sum + arr.length, 0)}
- **Status**: See progress report in main documentation

## Usage

These screenshots are used for:
1. User documentation and guides
2. Developer onboarding
3. QA testing reference
4. Support ticket resolution
5. Marketing materials
6. Payment provider integration documentation

---

Generated by: \`scripts/capture-payment-screenshots.js\`
`;

  fs.writeFileSync(readmePath, content);
  log(`Created README at ${readmePath}`, 'green');
}

// Interactive mode
async function runInteractive() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  header('Payment Screenshot Capture - Interactive Mode');

  console.log('This tool will help you capture payment flow screenshots systematically.\n');

  // Main menu
  while (true) {
    console.log('What would you like to do?\n');
    console.log('  1. View screenshot checklist');
    console.log('  2. View test data (cards, credentials)');
    console.log('  3. Generate test URLs');
    console.log('  4. View progress report');
    console.log('  5. Create screenshot directory structure');
    console.log('  6. Exit\n');

    const choice = await question('Enter your choice (1-6): ');

    switch (choice.trim()) {
      case '1':
        console.log('\nAvailable methods: common, epayco, daimo, paypal, post-payment, admin, errors\n');
        const method = await question('Enter method name (or "all"): ');
        if (method.trim().toLowerCase() === 'all') {
          Object.keys(SCREENSHOT_CHECKLIST).forEach(m => displayChecklist(m));
        } else {
          displayChecklist(method.trim().toLowerCase());
        }
        break;

      case '2':
        displayTestData();
        break;

      case '3':
        const plan = await question('Enter plan type (trial/crystal/diamond/monthly/lifetime): ');
        displayTestUrls(plan.trim().toLowerCase());
        break;

      case '4':
        displayProgress();
        break;

      case '5':
        createDirectoryStructure();
        createReadme();
        log('\nDirectory structure created successfully!', 'green');
        break;

      case '6':
        console.log('\nGoodbye!\n');
        rl.close();
        return;

      default:
        log('\nInvalid choice. Please enter 1-6.\n', 'red');
    }

    await question('\nPress Enter to continue...');
    console.clear();
  }
}

// Create directory structure
function createDirectoryStructure() {
  const categories = Object.keys(SCREENSHOT_CHECKLIST);

  categories.forEach(category => {
    const dir = path.join(CONFIG.outputDir, category);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log(`Created: ${dir}`, 'green');
    }
  });
}

// Main execution
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    return;
  }

  // Create directory structure
  createDirectoryStructure();

  if (options.generateUrls) {
    displayTestUrls(options.plan);
    displayTestData();
    return;
  }

  if (options.interactive) {
    await runInteractive();
  } else {
    // Non-interactive mode
    header('Payment Screenshot Capture Helper');

    if (options.method !== 'all') {
      displayChecklist(options.method);
    } else {
      Object.keys(SCREENSHOT_CHECKLIST).forEach(method => {
        displayChecklist(method);
      });
    }

    displayTestData();
    displayTestUrls(options.plan);
    displayProgress();
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    log(`\nError: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = {
  CONFIG,
  SCREENSHOT_CHECKLIST,
  TEST_DATA,
  generateTestUrls,
  displayTestData,
  displayChecklist,
  displayProgress,
};
