#!/usr/bin/env node
/**
 * CLI tool to manage promotional offers
 *
 * Usage:
 *   node scripts/manage-promos.js create --code SUMMER50 --plan monthly_pass --discount-type percentage --discount-value 50
 *   node scripts/manage-promos.js list
 *   node scripts/manage-promos.js stats --id 1
 *   node scripts/manage-promos.js deactivate --id 1
 *   node scripts/manage-promos.js link --code SUMMER50
 */

require('dotenv').config();
const { program } = require('commander');

// Initialize database connection
const { initializePostgres } = require('../src/config/postgres');
const { initializeRedis } = require('../src/config/redis');

// Initialize connections before importing models
initializePostgres();
initializeRedis();

const PromoModel = require('../src/models/promoModel');
const PlanModel = require('../src/models/planModel');

program
  .name('manage-promos')
  .description('CLI tool to manage promotional offers')
  .version('1.0.0');

program
  .command('create')
  .description('Create a new promo')
  .requiredOption('-c, --code <code>', 'Unique promo code (used in deep link)')
  .requiredOption('-p, --plan <planId>', 'Base plan ID (e.g., monthly_pass, yearly_pass)')
  .requiredOption('-t, --discount-type <type>', 'Discount type: "percentage" or "fixed_price"')
  .requiredOption('-v, --discount-value <value>', 'Discount value (percentage 0-100, or fixed price in USD)', parseFloat)
  .option('-n, --name <name>', 'Promo name (for display)')
  .option('--name-es <nameEs>', 'Promo name in Spanish')
  .option('-d, --description <description>', 'Promo description')
  .option('--description-es <descriptionEs>', 'Promo description in Spanish')
  .option('-a, --audience <type>', 'Target audience: all, churned, new_users, free_users', 'all')
  .option('-s, --spots <number>', 'Max spots (omit for unlimited)', parseInt)
  .option('-u, --until <date>', 'Valid until date (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)')
  .option('-f, --from <date>', 'Valid from date (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)')
  .option('--days <number>', 'For new_users audience: max days since signup', parseInt)
  .option('--features <features>', 'Comma-separated list of features (English)')
  .option('--features-es <featuresEs>', 'Comma-separated list of features (Spanish)')
  .action(async (options) => {
    try {
      // Validate base plan exists
      const basePlan = await PlanModel.getById(options.plan);
      if (!basePlan) {
        console.error(`Error: Base plan "${options.plan}" not found.`);
        console.log('\nAvailable plans:');
        const plans = await PlanModel.getAll();
        plans.forEach(p => console.log(`  - ${p.id}: ${p.name} ($${p.price})`));
        process.exit(1);
      }

      // Validate discount
      if (options.discountType === 'percentage') {
        if (options.discountValue < 0 || options.discountValue > 100) {
          console.error('Error: Percentage discount must be between 0 and 100');
          process.exit(1);
        }
      } else if (options.discountType === 'fixed_price') {
        if (options.discountValue < 0) {
          console.error('Error: Fixed price must be positive');
          process.exit(1);
        }
        if (options.discountValue > basePlan.price) {
          console.error(`Error: Fixed price ($${options.discountValue}) cannot exceed base plan price ($${basePlan.price})`);
          process.exit(1);
        }
      } else {
        console.error('Error: Discount type must be "percentage" or "fixed_price"');
        process.exit(1);
      }

      const promoData = {
        code: options.code,
        name: options.name || `${options.code} Promo`,
        nameEs: options.nameEs || null,
        description: options.description || null,
        descriptionEs: options.descriptionEs || null,
        basePlanId: options.plan,
        discountType: options.discountType,
        discountValue: options.discountValue,
        targetAudience: options.audience,
        maxSpots: options.spots || null,
        validFrom: options.from ? new Date(options.from) : new Date(),
        validUntil: options.until ? new Date(options.until) : null,
        newUserDays: options.days || 7,
        features: options.features ? options.features.split(',').map(f => f.trim()) : [],
        featuresEs: options.featuresEs ? options.featuresEs.split(',').map(f => f.trim()) : [],
      };

      const promo = await PromoModel.create(promoData);

      // Calculate final price for display
      const pricing = await PromoModel.calculatePrice(promo);

      console.log('\n=== Promo Created Successfully ===\n');
      console.log(`Code:          ${promo.code}`);
      console.log(`Name:          ${promo.name}`);
      console.log(`Base Plan:     ${basePlan.name} ($${basePlan.price})`);
      console.log(`Discount:      ${promo.discountType === 'percentage' ? promo.discountValue + '%' : '$' + promo.discountValue + ' fixed'}`);
      console.log(`Final Price:   $${pricing.finalPrice}`);
      console.log(`Savings:       $${pricing.discountAmount}`);
      console.log(`Audience:      ${promo.targetAudience}`);
      console.log(`Max Spots:     ${promo.maxSpots || 'Unlimited'}`);
      console.log(`Valid Until:   ${promo.validUntil ? new Date(promo.validUntil).toISOString() : 'No expiration'}`);
      console.log(`\nDeep Link:     ${PromoModel.generateDeepLink(promo.code)}`);
      console.log('\nCopy this link to share in broadcasts or posts.\n');

      process.exit(0);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all promos')
  .option('-a, --all', 'Include inactive promos')
  .action(async (options) => {
    try {
      const promos = await PromoModel.getAll(options.all);

      if (promos.length === 0) {
        console.log('No promos found.');
        process.exit(0);
      }

      console.log('\n=== Promotional Offers ===\n');

      for (const p of promos) {
        const pricing = await PromoModel.calculatePrice(p);
        const spotsInfo = p.maxSpots ? `${p.currentSpotsUsed}/${p.maxSpots}` : 'unlimited';
        const statusIcon = p.active ? (PromoModel.isPromoValid(p) ? '[ACTIVE]' : '[EXPIRED/FULL]') : '[INACTIVE]';

        console.log(`${statusIcon} ${p.code}`);
        console.log(`  ID: ${p.id} | Plan: ${p.basePlanId} | Price: $${pricing.finalPrice} (was $${pricing.originalPrice})`);
        console.log(`  Audience: ${p.targetAudience} | Spots: ${spotsInfo} | Completed: ${p.completedRedemptions || 0}`);
        console.log(`  Valid: ${p.validFrom ? new Date(p.validFrom).toLocaleDateString() : 'now'} - ${p.validUntil ? new Date(p.validUntil).toLocaleDateString() : 'forever'}`);
        console.log(`  Link: ${PromoModel.generateDeepLink(p.code)}`);
        console.log('');
      }

      process.exit(0);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('Get promo statistics')
  .requiredOption('-i, --id <id>', 'Promo ID', parseInt)
  .action(async (options) => {
    try {
      const stats = await PromoModel.getStats(options.id);

      if (!stats) {
        console.log('Promo not found.');
        process.exit(1);
      }

      const pricing = await PromoModel.calculatePrice(stats);

      console.log('\n=== Promo Statistics ===\n');
      console.log(`Code:               ${stats.code}`);
      console.log(`Name:               ${stats.name}`);
      console.log(`Status:             ${stats.active ? 'Active' : 'Inactive'}`);
      console.log(`Base Plan:          ${stats.basePlanId}`);
      console.log(`Price:              $${pricing.finalPrice} (was $${pricing.originalPrice})`);
      console.log(`Target Audience:    ${stats.targetAudience}`);
      console.log(`\n--- Redemptions ---`);
      console.log(`Total Claims:       ${stats.stats.totalClaims}`);
      console.log(`Completed:          ${stats.stats.completed}`);
      console.log(`Pending:            ${stats.stats.pending}`);
      console.log(`Expired:            ${stats.stats.expired}`);
      console.log(`\n--- Revenue ---`);
      console.log(`Total Revenue:      $${stats.stats.totalRevenue.toFixed(2)}`);
      console.log(`Total Discount:     $${stats.stats.totalDiscountGiven.toFixed(2)}`);
      console.log(`\n--- Capacity ---`);
      console.log(`Spots Used:         ${stats.currentSpotsUsed}${stats.maxSpots ? '/' + stats.maxSpots : ' (unlimited)'}`);
      console.log(`Valid Until:        ${stats.validUntil ? new Date(stats.validUntil).toISOString() : 'No expiration'}`);
      console.log(`\nDeep Link:          ${PromoModel.generateDeepLink(stats.code)}\n`);

      process.exit(0);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('deactivate')
  .description('Deactivate a promo')
  .requiredOption('-i, --id <id>', 'Promo ID', parseInt)
  .action(async (options) => {
    try {
      const promo = await PromoModel.deactivate(options.id);

      if (!promo) {
        console.log('Promo not found.');
        process.exit(1);
      }

      console.log(`Promo "${promo.code}" has been deactivated.`);
      process.exit(0);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('link')
  .description('Generate deep link for a promo')
  .requiredOption('-c, --code <code>', 'Promo code')
  .action(async (options) => {
    try {
      const promo = await PromoModel.getByCode(options.code);

      if (!promo) {
        console.log(`Promo "${options.code}" not found.`);
        process.exit(1);
      }

      const pricing = await PromoModel.calculatePrice(promo);

      console.log('\n=== Promo Link ===\n');
      console.log(`Code:       ${promo.code}`);
      console.log(`Name:       ${promo.name}`);
      console.log(`Price:      $${pricing.finalPrice} (was $${pricing.originalPrice})`);
      console.log(`Status:     ${promo.active && PromoModel.isPromoValid(promo) ? 'Active' : 'Inactive/Expired'}`);
      console.log(`\nDeep Link:  ${PromoModel.generateDeepLink(promo.code)}\n`);

      process.exit(0);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('update')
  .description('Update a promo')
  .requiredOption('-i, --id <id>', 'Promo ID', parseInt)
  .option('-n, --name <name>', 'New promo name')
  .option('--name-es <nameEs>', 'New promo name in Spanish')
  .option('-s, --spots <number>', 'New max spots', parseInt)
  .option('-u, --until <date>', 'New valid until date (YYYY-MM-DD)')
  .option('--active <boolean>', 'Set active status (true/false)')
  .action(async (options) => {
    try {
      const updates = {};

      if (options.name) updates.name = options.name;
      if (options.nameEs) updates.nameEs = options.nameEs;
      if (options.spots !== undefined) updates.maxSpots = options.spots;
      if (options.until) updates.validUntil = new Date(options.until);
      if (options.active !== undefined) updates.active = options.active === 'true';

      if (Object.keys(updates).length === 0) {
        console.log('No updates specified.');
        process.exit(1);
      }

      const promo = await PromoModel.update(options.id, updates);

      if (!promo) {
        console.log('Promo not found.');
        process.exit(1);
      }

      console.log(`Promo "${promo.code}" has been updated.`);
      console.log(`Deep Link: ${PromoModel.generateDeepLink(promo.code)}`);
      process.exit(0);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program.parse();
