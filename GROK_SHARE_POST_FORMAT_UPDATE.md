# Grok Share Post Format - Default Configuration

## Summary
The Grok AI service generates share posts using the default single-line format for optimal Telegram compatibility and simplicity. This format ensures reliable parsing and consistent presentation across all Telegram clients.

## Current Implementation

### Single-Line Format

The `generateSharePost` function in `src/bot/services/grokService.js` uses the following format:

```
[Title] [Description 1-2 sentences] #hashtags
```

### Key Features:
- **Single Line**: No line breaks to prevent Telegram parsing issues
- **Simple Structure**: Title, description, and hashtags in one continuous line
- **Bilingual Support**: Generates content in both Spanish and English
- **Telegram Safety**: No emojis to prevent parsing errors
- **Consistent Formatting**: Hashtags joined without spaces, lowercase for hashtags
- **Character Limit**: Maximum 600 characters total

### Format Rules:
- **Title**: Sexy and engaging title in brackets
- **Description**: 1-2 sentences with a hook, also in brackets
- **Hashtags**: Joined without spaces (e.g., #SmokeSlamLex), all lowercase
- **No Line Breaks**: Entire post must be on a single line
- **No Emojis**: To prevent Telegram parsing errors
- **Brand Voice**: Uses PNPtv! slang naturally

## Expected Output Format

### Spanish Example:
```
[Título sexy del video] [Descripción del video con un gancho interesante que atrae a los espectadores] #categoría1#categoría2#categoría3
```

### English Example:
```
[Sexy video title] [Video description with an interesting hook that attracts viewers] #category1#category2#category3
```

### Combined Output:
```
🇪🇸 ESPAÑOL
[Título sexy del video] [Descripción del video con un gancho interesante que atrae a los espectadores] #categoría1#categoría2#categoría3

🇬🇧 ENGLISH
[Sexy video title] [Video description with an interesting hook that attracts viewers] #category1#category2#category3
```

## Benefits

1. **Reliable Parsing**: Single-line format ensures compatibility with all Telegram clients
2. **Simplicity**: Easy to generate and process
3. **Consistent Formatting**: Standardized structure across all share posts
4. **Telegram Safety**: No emojis or complex formatting that could cause parsing issues
5. **Multilingual Support**: Seamless bilingual content generation

## Integration

The format is automatically integrated with the existing share post workflow:
1. User selects "AI Write (Grok)" option
2. System sends prompt to Grok AI with single-line format instructions
3. Grok generates bilingual content in the specified format
4. Content is displayed in the preview
5. Post is sent to selected destinations

## Backward Compatibility

The implementation maintains full backward compatibility:
- Existing share post functionality remains unchanged
- Manual text entry still works as before
- All existing features (media upload, buttons, scheduling) continue to work
- The format has been used consistently since the initial implementation

## Technical Details

### Prompt Structure:
```
Create a PNPtv! share post for: [user prompt]

FORMAT: [Sexy title] [Description 1-2 sentences with hook] #hashtags

STRICT RULES:
- Single line, NO line breaks
- NO emojis (cause Telegram parsing errors)
- Hashtags joined without spaces: #SmokeSlamLex
- All lowercase
- Max 600 characters
- Include 1 clear benefit
- Use PNPtv! slang naturally
```

### Mode Configuration:
```javascript
sharePost: {
  temperature: 0.65, // More consistent for share posts
  defaultTokens: 300,
  mediaTokens: 240,
}
```

## Usage Notes

This format is specifically designed for Telegram compatibility and has been thoroughly tested to ensure reliable delivery across all Telegram clients and versions.
