# 📧 Bulk Welcome Email Campaign - Instructions

## ✅ System Status: READY FOR BULK EMAILING

The welcome email system is fully configured and ready to send bulk emails to all users with verified email addresses.

## 🎯 What Will Be Sent

Each user will receive:
- **🎨 Professionally designed welcome email** with PNP TV branding
- **🔥 Eye-catching HOT CONTENT banner** highlighting Santino & Lex's work
- **📎 All 4 PDF attachments**:
  - `PNPtv_Calendario_Lanzamiento.pdf` (8.7 KB)
  - `PNPtv_Release_Calendar-1.pdf` (7.5 KB)
  - `PNPtv_Guia_Oficial_Pro.pdf` (18.8 KB)
  - `PNPtv_Official_Guide.pdf` (18.5 KB)
- **🌍 Multi-language support** (English/Spanish based on user preference)
- **🎬 Clear call-to-action** to visit landing page

## 🚀 How to Run the Bulk Email Campaign

### Option 1: Run the Full Campaign

```bash
cd /root/pnptvbot-production
node scripts/send-welcome-to-all-users.js
```

The script will:
1. Ask for confirmation (type "yes" to proceed)
2. Fetch all users with verified email addresses
3. Send emails in batches of 10 with 500ms delay between emails
4. Provide detailed progress reporting
5. Show final summary with success/failure counts

### Option 2: Test with a Small Batch First

To test with just 5 users first, modify the script:

```javascript
// Change the query to limit to 5 users:
const usersQuery = `
    SELECT id, username, first_name, last_name, email, language 
    FROM users 
    WHERE email IS NOT NULL 
    AND email != ''
    AND email_verified = true
    AND is_active = true
    LIMIT 5  -- Changed from 1000 to 5 for testing
`;
```

## ⚠️ Important Considerations

1. **SMTP Rate Limits**: Hostinger SMTP may have sending limits
2. **Batch Processing**: Script sends 10 emails at a time with delays
3. **Error Handling**: Failed emails are logged for review
4. **Database Load**: Large campaigns may impact database performance
5. **User Experience**: Consider sending during off-peak hours

## 📊 Expected Results

The script will output:
- Total users with verified emails
- Progress through batches
- Success/failure count for each email
- Final summary with statistics
- Error details (if any)

## 🎯 Email Content Preview

```
🎉 Welcome to PNP TV Bot!

Dear [User Name],

We're thrilled to welcome you to the PNP TV community!

🔥 HOT PNP ADULT CONTENT 🔥
"The core of our community is the HOT PNP adult content 
created by Santino and Lex!"
🎬 Clouds & Slamming - 100% REAL 🎬

📎 We've included some helpful documents as attachments!

[Visit PNP TV Landing Page Button]
```

## 🔧 Technical Details

- **SMTP Configuration**: Hostinger SMTP (smtp.hostinger.com)
- **From Address**: noreply@pnptv.app
- **Email Service**: Nodemailer with PostgreSQL integration
- **Attachments**: 4 PDF documents (~53.5 KB total)
- **Language Support**: Automatic detection (English/Spanish)

## 📝 Safety Features

- ✅ Confirmation prompt before sending
- ✅ Batch processing to avoid overwhelming server
- ✅ Delay between emails to prevent rate limiting
- ✅ Comprehensive error logging
- ✅ Progress reporting for monitoring

## 🎉 Ready to Launch!

The system is fully configured and tested. When you're ready to send welcome emails to all users, simply run the bulk email script and confirm when prompted.

**🚀 Happy Emailing!**