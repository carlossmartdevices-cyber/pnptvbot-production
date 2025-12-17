/**
 * Tribe Statistics Script
 * Calculates the percentage distribution of tribes/badges among users
 */

require('dotenv').config();
const { query, getPool, closePool } = require('../src/config/postgres');

async function getTribeStatistics() {
  console.log('📊 TRIBE STATISTICS REPORT');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Get total users with badges
    const totalResult = await query(`
      SELECT COUNT(*) as total 
      FROM users 
      WHERE badges IS NOT NULL AND array_length(badges, 1) > 0
    `);
    const totalWithBadges = parseInt(totalResult.rows[0].total);

    // Get total users overall
    const allUsersResult = await query(`SELECT COUNT(*) as total FROM users`);
    const totalUsers = parseInt(allUsersResult.rows[0].total);

    console.log(`👥 Total Users: ${totalUsers}`);
    console.log(`🏅 Users with Badges: ${totalWithBadges} (${totalUsers > 0 ? ((totalWithBadges / totalUsers) * 100).toFixed(1) : 0}%)`);
    console.log('');
    console.log('-'.repeat(60));
    console.log('');

    // Define tribe badges to look for
    const tribes = ['meth_alpha', 'chem_mermaids', 'slam_slut', 'spun_royal'];
    const tribeEmojis = {
      meth_alpha: '🔥',
      chem_mermaids: '🧜',
      slam_slut: '💉',
      spun_royal: '👑'
    };
    const tribeNames = {
      meth_alpha: 'Meth Alpha',
      chem_mermaids: 'Chem Mermaids',
      slam_slut: 'Slam Slut',
      spun_royal: 'Spun Royal'
    };

    console.log('🏳️‍🌈 TRIBE DISTRIBUTION:');
    console.log('');

    const tribeStats = [];

    for (const tribe of tribes) {
      // Query for users with this tribe badge (badges stored as text array or jsonb)
      const result = await query(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE 
          badges::text LIKE $1
      `, [`%${tribe}%`]);

      const count = parseInt(result.rows[0].count);
      const percentage = totalWithBadges > 0 ? ((count / totalWithBadges) * 100).toFixed(1) : 0;
      const percentageOfAll = totalUsers > 0 ? ((count / totalUsers) * 100).toFixed(1) : 0;

      tribeStats.push({
        tribe,
        name: tribeNames[tribe],
        emoji: tribeEmojis[tribe],
        count,
        percentage,
        percentageOfAll
      });
    }

    // Sort by count descending
    tribeStats.sort((a, b) => b.count - a.count);

    // Display results
    for (const stat of tribeStats) {
      const bar = '█'.repeat(Math.round(parseFloat(stat.percentage) / 5)) || '';
      console.log(`${stat.emoji} ${stat.name.padEnd(15)} : ${stat.count.toString().padStart(5)} users | ${stat.percentage.padStart(5)}% of badged | ${stat.percentageOfAll.padStart(5)}% of all`);
      console.log(`   ${bar}`);
      console.log('');
    }

    // Check for other badges not in the tribe list
    console.log('-'.repeat(60));
    console.log('');
    console.log('🏅 OTHER BADGES:');
    console.log('');

    const otherBadgesResult = await query(`
      SELECT badges 
      FROM users 
      WHERE badges IS NOT NULL AND array_length(badges, 1) > 0
    `);

    const otherBadgeCounts = {};
    
    for (const row of otherBadgesResult.rows) {
      let badges = row.badges || [];
      // Handle if badges is stored as JSON string or array
      if (typeof badges === 'string') {
        try {
          badges = JSON.parse(badges);
        } catch (e) {
          badges = [badges];
        }
      }
      for (const badge of badges) {
        const badgeName = typeof badge === 'string' ? badge : (badge.name || badge.type || JSON.stringify(badge));
        if (!tribes.includes(badgeName)) {
          otherBadgeCounts[badgeName] = (otherBadgeCounts[badgeName] || 0) + 1;
        }
      }
    }

    const otherBadges = Object.entries(otherBadgeCounts)
      .sort((a, b) => b[1] - a[1]);

    if (otherBadges.length === 0) {
      console.log('   No other badges found.');
    } else {
      for (const [badge, count] of otherBadges) {
        const percentage = totalWithBadges > 0 ? ((count / totalWithBadges) * 100).toFixed(1) : 0;
        console.log(`   • ${badge}: ${count} users (${percentage}%)`);
      }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Report complete!');

  } catch (error) {
    console.error('❌ Error generating tribe statistics:', error.message);
    console.error(error.stack);
  } finally {
    try {
      await closePool();
    } catch (e) {
      // Ignore close errors
    }
    process.exit(0);
  }
}

// Run the script
getTribeStatistics();
