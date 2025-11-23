/**
 * Script to send membership activation emails to legacy users
 */

require('dotenv').config();

const emailService = require('../src/services/emailService');

// Users who need to activate via bot
const usersToEmail = [
  { email: 'ssbbpp@gmail.com', plan: 'lifetime' },
  { email: 'jarche67@gmail.com', plan: 'lifetime' },
  { email: 'sirdan1989@gmail.com', plan: 'trial week' },
  { email: 'eric.74.oleary@icloud.com', plan: 'lifetime' },
  { email: 'elvindelrio1@gmail.com', plan: 'trial week' },
  { email: 'romeoshafi_99@yahoo.com', plan: 'trial week' },
  { email: 'mnaf1893@gmail.com', plan: 'trial week' },
  { email: 'viennanouvelle@gmail.com', plan: 'trial week' },
  { email: 'latinman8869@gmail.com', plan: 'diamond' },
  { email: 'dp052601@gmail.com', plan: 'trial week' },
  { email: 'britohumberto@yahoo.com', plan: 'trial week' },
  { email: 'drvivekns@gmail.com', plan: 'trial week' },
];

function getEmailTemplate(plan) {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 32px;
            font-weight: bold;
            color: #2D8CFF;
        }
        .title {
            color: #2D8CFF;
            font-size: 24px;
            margin-bottom: 10px;
        }
        .plan-badge {
            background: #f0f8ff;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            font-size: 20px;
            font-weight: bold;
            color: #2D8CFF;
            margin: 20px 0;
        }
        .button {
            display: inline-block;
            background: #2D8CFF;
            color: white !important;
            padding: 15px 40px;
            text-decoration: none;
            border-radius: 50px;
            font-weight: bold;
            margin: 20px 0;
        }
        .info-box {
            background: #f9f9f9;
            padding: 15px;
            border-left: 4px solid #2D8CFF;
            margin: 20px 0;
        }
        .steps {
            margin: 20px 0;
        }
        .step {
            padding: 10px 0;
        }
        .step-number {
            display: inline-block;
            width: 30px;
            height: 30px;
            background: #2D8CFF;
            color: white;
            border-radius: 50%;
            text-align: center;
            line-height: 30px;
            margin-right: 10px;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">PNP.tv PRIME</div>
        </div>

        <h1 class="title">Activate Your Membership</h1>

        <p>We're migrating to our new system and need you to activate your membership through our Telegram bot.</p>

        <div class="plan-badge">Your Plan: ${plan.toUpperCase()}</div>

        <div class="steps">
            <h3>How to Activate:</h3>
            <div class="step">
                <span class="step-number">1</span> Open Telegram and search for <strong>@pnptvbot</strong>
            </div>
            <div class="step">
                <span class="step-number">2</span> Click <strong>START</strong> to begin
            </div>
            <div class="step">
                <span class="step-number">3</span> Reply to us with this email address when prompted, or use /email to set it
            </div>
        </div>

        <div style="text-align: center;">
            <a href="https://t.me/pnptvbot" class="button">Open @pnptvbot</a>
        </div>

        <div class="info-box">
            <strong>Important:</strong><br>
            Once you've started the bot and set your email, we'll activate your <strong>${plan}</strong> membership within 24 hours.
        </div>

        <div class="footer">
            <p><strong>PNP.tv</strong> - Premium Members Only</p>
            <p>Questions? Contact support at <a href="mailto:support@easybots.store">support@easybots.store</a></p>
        </div>
    </div>
</body>
</html>
  `;
}

async function sendEmails() {
  console.log(`\nSending activation emails to ${usersToEmail.length} users\n`);

  const results = {
    success: 0,
    failed: 0,
  };

  for (const user of usersToEmail) {
    try {
      const result = await emailService.send({
        to: user.email,
        subject: 'Activate Your PNP.tv PRIME Membership',
        html: getEmailTemplate(user.plan),
      });

      if (result.success) {
        console.log(`✅ Email sent to ${user.email} (${user.plan})`);
        results.success++;
      } else {
        console.log(`❌ Failed to send to ${user.email}`);
        results.failed++;
      }
    } catch (error) {
      console.log(`❌ Error sending to ${user.email}: ${error.message}`);
      results.failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('EMAIL SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Sent: ${results.success}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log('='.repeat(50));
}

sendEmails()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFailed:', error.message);
    process.exit(1);
  });
