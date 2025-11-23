const { query } = require('./src/config/postgres');
(async () => {
  const result = await query('SELECT id, badges FROM users');
  for (const user of result.rows) {
    const badges = user.badges || [];
    if (!badges.some(b => b.name === 'PNP Papi')) {
      badges.push({
        name: 'PNP Papi',
        icon: '👑',
        assignedAt: new Date(),
        reason: 'Early adopter',
        benefits: 'Full access to nearby, zoom, live for 6 months'
      });
      await query('UPDATE users SET badges = $1 WHERE id = $2', [JSON.stringify(badges), user.id]);
    }
  }
  console.log('PNP Papi badge assigned to all early users.');
})();
