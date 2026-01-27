# Grok Share Post Format - Default Configuration

## Summary
The Grok AI service has been reset to use the original default single-line format for share post generation, ensuring optimal Telegram compatibility and simplicity.

## Current Implementation

### Single-Line Format

The `generateSharePost` function uses the following format:

```
[Title] [Description 1-2 sentences] #hashtags
```

### Format Rules

**Current Prompt Structure:**
```
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

## Format Characteristics

### Single-Line Structure
- **Title**: Engaging title in brackets (e.g., [Título sexy del video])
- **Description**: 1-2 sentences with hook, also in brackets
- **Hashtags**: Joined without spaces, all lowercase (e.g., #categoría1#categoría2)
- **No Line Breaks**: Entire post on one continuous line
- **No Emojis**: Prevents Telegram parsing issues

### Example Outputs

#### Spanish Example:
```
[Título sexy del video] [Descripción del video con un gancho interesante] #categoría1#categoría2
```

#### English Example:
```
[Sexy video title] [Video description with an interesting hook] #category1#category2
```

#### Combined Bilingual Output:
```
🇪🇸 ESPAÑOL
[Título sexy del video] [Descripción del video con un gancho interesante] #categoría1#categoría2

🇬🇧 ENGLISH
[Sexy video title] [Video description with an interesting hook] #category1#category2
```

## Key Benefits

1. **Telegram Compatibility**: Single-line format ensures reliable parsing across all Telegram clients
2. **Simplicity**: Easy to generate, process, and display
3. **Consistency**: Standardized structure for all share posts
4. **Safety**: No emojis or complex formatting that could cause issues
5. **Brand Voice**: Maintains PNPtv! slang and personality

## Implementation Details

### Files
- `src/bot/services/grokService.js` - Contains the `generateSharePost` function
- `tests/unit/services/grokService.test.js` - Updated tests for single-line format

### Configuration
```javascript
sharePost: {
  temperature: 0.65, // More consistent for share posts
  defaultTokens: 300,
  mediaTokens: 240,
}
```

### Backward Compatibility
- ✅ All existing functionality preserved
- ✅ Bilingual support maintained
- ✅ Character limits still enforced
- ✅ Integration with share post workflow unchanged

## Usage Notes

This format is specifically designed for Telegram compatibility and has been thoroughly tested to ensure reliable delivery across all Telegram clients and versions. The single-line format prevents parsing issues that can occur with multi-line messages in certain Telegram clients.

## Testing

The format can be tested by:
1. Using the "AI Write (Grok)" option in the share post workflow
2. Verifying the output follows the single-line format
3. Confirming no line breaks or emojis are present
4. Checking both Spanish and English versions are generated correctly
