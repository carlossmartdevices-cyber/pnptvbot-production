#!/usr/bin/env python3
"""
Group Text Message Cleanup Script (Python + Telethon)

This script deletes all text-only messages from a Telegram group,
except for messages sent today. Media messages are preserved.

Prerequisites:
    pip install telethon python-dotenv

Usage:
    python scripts/cleanup-text-messages.py

You'll need:
1. API ID and API Hash from https://my.telegram.org
2. Your phone number for authentication
3. Admin rights in the target group
"""

import os
import asyncio
from datetime import datetime, timedelta
from telethon import TelegramClient
from telethon.tl.types import MessageMediaPhoto, MessageMediaDocument
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
API_ID = os.getenv('TELEGRAM_API_ID')
API_HASH = os.getenv('TELEGRAM_API_HASH')
PHONE = os.getenv('TELEGRAM_PHONE')
GROUP_ID = os.getenv('GROUP_ID') or os.getenv('MAIN_GROUP_ID')

# Session name
SESSION_NAME = 'cleanup_session'

# Statistics
stats = {
    'checked': 0,
    'deleted': 0,
    'kept_media': 0,
    'kept_today': 0,
    'errors': 0
}

def is_today(message_date):
    """Check if message is from today"""
    today = datetime.now().date()
    msg_date = message_date.date()
    return msg_date == today

def has_media(message):
    """Check if message contains media"""
    return (
        message.photo is not None or
        message.video is not None or
        message.document is not None or
        message.audio is not None or
        message.voice is not None or
        message.video_note is not None or
        message.sticker is not None or
        message.gif is not None
    )

async def cleanup_messages():
    """Main cleanup function"""
    print('\n🧹 Group Text Message Cleanup\n')

    # Check credentials
    if not API_ID or not API_HASH:
        print('❌ Error: Missing Telegram API credentials')
        print('\nPlease set the following environment variables:')
        print('   TELEGRAM_API_ID=your_api_id')
        print('   TELEGRAM_API_HASH=your_api_hash')
        print('\nGet them from: https://my.telegram.org\n')
        return

    if not GROUP_ID:
        print('❌ Error: Missing GROUP_ID in environment variables')
        return

    # Initialize client
    try:
        client = TelegramClient(SESSION_NAME, int(API_ID), API_HASH)
        await client.start(phone=PHONE or input('Enter your phone number: '))

        print(f'✅ Logged in successfully')
        print(f'📍 Target Group ID: {GROUP_ID}')
        print(f'📅 Today: {datetime.now().strftime("%Y-%m-%d")}\n')

        # Get the group
        try:
            entity = await client.get_entity(int(GROUP_ID))
            print(f'✅ Found group: {entity.title}\n')
        except Exception as e:
            print(f'❌ Error: Could not find group with ID {GROUP_ID}')
            print(f'   Error: {e}\n')
            return

        # Confirm action
        print('⚠️  WARNING: This will delete all text-only messages except from today!')
        print('   Media messages will be preserved.\n')
        confirm = input('Type "yes" to continue: ')

        if confirm.lower() != 'yes':
            print('❌ Cancelled by user\n')
            return

        print('\n🔍 Scanning messages...\n')

        # Fetch and process messages
        messages_to_delete = []
        batch_count = 0

        async for message in client.iter_messages(entity, limit=None):
            stats['checked'] += 1

            # Check if message has media
            if has_media(message):
                stats['kept_media'] += 1
                continue

            # Check if message is from today
            if is_today(message.date):
                stats['kept_today'] += 1
                continue

            # Check if message has text
            if message.text or message.message:
                messages_to_delete.append(message.id)
                date_str = message.date.strftime('%Y-%m-%d %H:%M')
                text_preview = (message.text or message.message)[:40]
                print(f'🗑️  Will delete: [{date_str}] {text_preview}...')

            # Delete in batches of 100
            if len(messages_to_delete) >= 100:
                try:
                    await client.delete_messages(entity, messages_to_delete)
                    stats['deleted'] += len(messages_to_delete)
                    batch_count += 1
                    print(f'\n✅ Deleted batch {batch_count} ({len(messages_to_delete)} messages)\n')
                    messages_to_delete = []
                    await asyncio.sleep(1)  # Rate limiting
                except Exception as e:
                    print(f'❌ Error deleting batch: {e}')
                    stats['errors'] += len(messages_to_delete)
                    messages_to_delete = []

        # Delete remaining messages
        if messages_to_delete:
            try:
                await client.delete_messages(entity, messages_to_delete)
                stats['deleted'] += len(messages_to_delete)
                print(f'\n✅ Deleted final batch ({len(messages_to_delete)} messages)\n')
            except Exception as e:
                print(f'❌ Error deleting final batch: {e}')
                stats['errors'] += len(messages_to_delete)

        # Print summary
        print('\n📊 Cleanup Summary:')
        print('─' * 50)
        print(f'   ✅ Total checked: {stats["checked"]}')
        print(f'   🗑️  Deleted: {stats["deleted"]}')
        print(f'   📸 Kept (media): {stats["kept_media"]}')
        print(f'   📅 Kept (today): {stats["kept_today"]}')
        print(f'   ❌ Errors: {stats["errors"]}')
        print('─' * 50)
        print('\n✅ Cleanup complete!\n')

    except Exception as e:
        print(f'\n❌ Error: {e}\n')
    finally:
        if 'client' in locals():
            await client.disconnect()

if __name__ == '__main__':
    asyncio.run(cleanup_messages())
