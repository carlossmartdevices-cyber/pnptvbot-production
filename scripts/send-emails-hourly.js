#!/usr/bin/env node

/**
 * Script para enviar emails en lotes cada hora
 * Evita el rate limit de Hostinger enviando ~400 emails por hora
 */

require('dotenv').config();
const EmailService = require('../src/services/emailService');
const logger = require('../src/utils/logger');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const BATCH_SIZE = 400; // Emails por hora (bajo el límite de Hostinger)
const DELAY_BETWEEN_EMAILS = 5000; // 5 segundos entre cada email
const SENT_LOG_FILE = path.join(__dirname, '../sent_emails.log');
const CSV_FILE = path.join(__dirname, '../Customes_legacy_pending.csv');

// Cargar emails ya enviados
function loadSentEmails() {
    if (!fs.existsSync(SENT_LOG_FILE)) {
        return new Set();
    }
    const content = fs.readFileSync(SENT_LOG_FILE, 'utf8');
    return new Set(content.split('\n').filter(e => e.trim()).map(e => e.toLowerCase().trim()));
}

// Guardar email enviado
function logSentEmail(email) {
    fs.appendFileSync(SENT_LOG_FILE, email.toLowerCase().trim() + '\n');
}

async function sendBatch() {
    console.log('='.repeat(60));
    console.log(`🚀 Iniciando lote de emails - ${new Date().toISOString()}`);
    console.log('='.repeat(60));

    // Verificar CSV
    if (!fs.existsSync(CSV_FILE)) {
        console.error(`❌ CSV no encontrado: ${CSV_FILE}`);
        return { sent: 0, failed: 0, remaining: 0 };
    }

    // Cargar datos
    const sentEmails = loadSentEmails();
    const csvContent = fs.readFileSync(CSV_FILE, 'utf8');
    const allRecords = parse(csvContent, { columns: true, skip_empty_lines: true });

    // Filtrar emails no enviados y únicos
    const seen = new Set();
    const pendingRecords = allRecords.filter(r => {
        const email = r.Email?.toLowerCase().trim();
        if (!email || sentEmails.has(email) || seen.has(email)) return false;
        seen.add(email);
        return true;
    });

    console.log(`📊 Total en CSV: ${allRecords.length}`);
    console.log(`✅ Ya enviados: ${sentEmails.size}`);
    console.log(`📧 Pendientes únicos: ${pendingRecords.length}`);

    if (pendingRecords.length === 0) {
        console.log('🎉 ¡Todos los emails han sido enviados!');
        return { sent: 0, failed: 0, remaining: 0 };
    }

    // Tomar solo el lote actual
    const batchRecords = pendingRecords.slice(0, BATCH_SIZE);
    console.log(`📤 Enviando lote de ${batchRecords.length} emails...\n`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < batchRecords.length; i++) {
        const customer = batchRecords[i];
        const email = customer.Email;
        const name = customer.Name || 'Cliente';
        const language = customer.language || 'es';

        if (!email || !EmailService.isEmailSafe(email)) {
            failCount++;
            console.log(`❌ [${i + 1}/${batchRecords.length}] Email inválido: ${email}`);
            continue;
        }

        try {
            console.log(`📧 [${i + 1}/${batchRecords.length}] Enviando a ${name} (${email})...`);

            const result = await EmailService.sendReactivationEmail({
                email: email,
                userName: name,
                lifetimeDealLink: "https://pnptv.app/lifetime100",
                telegramLink: "https://t.me/pnplatinotv_bot",
                userLanguage: language
            });

            if (result.success) {
                successCount++;
                logSentEmail(email);
                console.log(`✅ Éxito: ${email}`);
            } else {
                failCount++;
                console.log(`❌ Falló: ${email} - ${result.message}`);

                // Si es rate limit, parar y esperar
                if (result.message?.includes('Ratelimit')) {
                    console.log('\n⚠️ Rate limit detectado. Deteniendo lote...');
                    break;
                }
            }

            // Esperar entre emails
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_EMAILS));

        } catch (error) {
            failCount++;
            console.log(`❌ Error: ${email} - ${error.message}`);

            if (error.message?.includes('Ratelimit')) {
                console.log('\n⚠️ Rate limit detectado. Deteniendo lote...');
                break;
            }
        }
    }

    const remaining = pendingRecords.length - successCount;

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DEL LOTE');
    console.log('='.repeat(60));
    console.log(`✅ Enviados en este lote: ${successCount}`);
    console.log(`❌ Fallidos: ${failCount}`);
    console.log(`📧 Pendientes restantes: ${remaining}`);
    console.log('='.repeat(60));

    return { sent: successCount, failed: failCount, remaining };
}

// Ejecutar
if (require.main === module) {
    sendBatch().then(result => {
        if (result.remaining > 0) {
            console.log(`\n⏰ Quedan ${result.remaining} emails. Ejecuta este script de nuevo en 1 hora.`);
            console.log(`\nPara programar ejecución automática cada hora:`);
            console.log(`  crontab -e`);
            console.log(`  Agregar: 0 * * * * cd /root/pnptvbot-production && node scripts/send-emails-hourly.js >> /var/log/pnp-emails.log 2>&1`);
        }
        process.exit(0);
    });
}

module.exports = { sendBatch };
