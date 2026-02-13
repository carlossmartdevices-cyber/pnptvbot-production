/**
 * Test script for X Followers Service
 * Tests the unfollow functionality without needing Telegram auth
 */

// Load .env file
require('dotenv').config();

const XFollowersService = require('./src/bot/services/xFollowersService');
const logger = require('./src/utils/logger');

const X_USER_ID = '1614126754892767233'; // @pnpmethdaddy

async function runTest() {
  try {
    console.log('\n🧪 INICIANDO PRUEBA DE X FOLLOWERS SERVICE\n');
    console.log(`📊 Analizando User ID: ${X_USER_ID}\n`);

    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;

    if ((!bearerToken && !accessToken) || (bearerToken && bearerToken.startsWith('YOUR_'))) {
      console.error('❌ Error: No hay token de X configurado en .env');
      process.exit(1);
    }

    const tokenUsed = bearerToken ? 'BEARER_TOKEN' : 'ACCESS_TOKEN';
    console.log(`✅ Token de X encontrado (usando ${tokenUsed})\n`);

    // Step 1: Obtener estadísticas
    console.log('📈 PASO 1: Obteniendo estadísticas...');
    const [followers, following] = await Promise.all([
      XFollowersService.getFollowers(X_USER_ID, 1),
      XFollowersService.getFollowing(X_USER_ID, 1),
    ]);

    const followerCount = followers.meta?.result_count || 0;
    const followingCount = following.meta?.result_count || 0;

    console.log(`  Followers: ${followerCount}`);
    console.log(`  Following: ${followingCount}`);
    console.log('✅ Estadísticas obtenidas\n');

    // Step 2: Analizar no-mutuals
    console.log('🔍 PASO 2: Analizando Non-Mutuals...');
    const analysis = await XFollowersService.findNonMutuals(X_USER_ID);

    console.log(`  Followers totales: ${analysis.followers}`);
    console.log(`  Following totales: ${analysis.following}`);
    console.log(`  No-Mutuals encontrados: ${analysis.nonMutualsCount}\n`);

    if (analysis.nonMutuals.length > 0) {
      console.log('📋 Top 5 No-Mutuals (sigues pero no te siguen):');
      analysis.nonMutuals.slice(0, 5).forEach((user, i) => {
        console.log(`  ${i + 1}. @${user.username} - ${user.name}`);
      });
      console.log('');
    }

    // Step 3: Dry Run
    console.log('🔄 PASO 3: Ejecutando DRY RUN (sin cambios reales)...');
    const dryRunResults = await XFollowersService.unfollowNonMutuals(X_USER_ID, true);

    console.log(`  Total a deseguir: ${dryRunResults.totalNonMutuals}`);
    console.log(`  Que se deseguirían: ${dryRunResults.unfollowed}`);
    console.log(`  Errores: ${dryRunResults.failed}`);
    console.log(`  Dry Run: ${dryRunResults.dryRun ? 'SÍ (sin cambios reales)' : 'NO (CAMBIOS REALES)'}`);
    console.log('✅ Dry Run completado\n');

    // Final summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ PRUEBA COMPLETADA EXITOSAMENTE\n');
    console.log('📊 RESUMEN:');
    console.log(`  • Followers: ${analysis.followers}`);
    console.log(`  • Following: ${analysis.following}`);
    console.log(`  • No-Mutuals: ${analysis.nonMutualsCount}`);
    console.log(`  • Listos para deseguir: ${dryRunResults.unfollowed}`);
    console.log('\n💡 Para deseguir REALMENTE, usa:');
    console.log(`  /xfollowers en Telegram`);
    console.log(`  O: curl -X POST /api/x/followers/unfollow-non-mutuals`);
    console.log('\n🔒 Acción CONFIRMADA y lista para ejecutarse\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
    if (error.response?.data) {
      console.error('API Error:', error.response.data);
    }
    process.exit(1);
  }
}

runTest();
