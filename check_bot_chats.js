require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

async function checkBotChats() {
    try {
        const botInfo = await bot.telegram.getMe();
        console.log('\n╔════════════════════════════════════════════════╗');
        console.log('║          BOT INFORMATION                       ║');
        console.log('╚════════════════════════════════════════════════╝');
        console.log(`🤖 Bot Name: ${botInfo.first_name}`);
        console.log(`👤 Username: @${botInfo.username}`);
        console.log(`🆔 Bot ID: ${botInfo.id}`);
        
        console.log('\n╔════════════════════════════════════════════════╗');
        console.log('║       CONFIGURED CHANNELS & GROUPS             ║');
        console.log('╚════════════════════════════════════════════════╝');
        
        const channels = [
            { name: '📺 Prime Channel', id: process.env.PRIME_CHANNEL_ID },
            { name: '👥 Main Group', id: process.env.GROUP_ID },
            { name: '💬 Support Group', id: process.env.SUPPORT_GROUP_ID }
        ];
        
        for (const channel of channels) {
            if (channel.id) {
                try {
                    const chat = await bot.telegram.getChat(channel.id);
                    const botMember = await bot.telegram.getChatMember(channel.id, botInfo.id);
                    
                    console.log(`\n${channel.name}:`);
                    console.log(`  ├─ ID: ${chat.id}`);
                    console.log(`  ├─ Type: ${chat.type}`);
                    console.log(`  ├─ Title: ${chat.title || 'N/A'}`);
                    console.log(`  ├─ Username: ${chat.username ? '@' + chat.username : '🔒 Private'}`);
                    console.log(`  ├─ Bot Status: ${botMember.status}`);
                    console.log(`  └─ Description: ${chat.description ? chat.description.substring(0, 50) + '...' : 'None'}`);
                } catch (error) {
                    console.log(`\n${channel.name}:`);
                    console.log(`  └─ ❌ Error: ${error.message}`);
                }
            }
        }
        
        console.log('\n╔════════════════════════════════════════════════╗');
        console.log('║              SUMMARY                           ║');
        console.log('╚════════════════════════════════════════════════╝');
        console.log('✅ Bot is active and configured\n');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkBotChats();
