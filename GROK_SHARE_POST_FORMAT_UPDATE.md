# Grok Share Post Format Update

## Summary
Updated the Grok AI service to generate share posts with a structured format that includes line breaks for better readability and organization. The new format separates content into distinct sections: title, description, hashtags, and performers.

## Changes Made

### 1. Updated `src/bot/services/grokService.js`

#### Modified `generateSharePost` function:
- **Old Format**: Single line format: `[Sexy title] [Description] #hashtags`
- **New Format**: Structured format with line breaks:
  ```
  [Sexy title of video]
  ---
  [Description of video - 1-2 sentences with hook]
  ---
  [Hashtags for categories - joined without spaces: #SmokeSlamLex]
  ---
  [Performers - names separated by commas]
  ```

#### Key Features:
- **Line Breaks**: Uses `---` to separate sections for better readability
- **Structured Content**: Clearly separates title, description, hashtags, and performers
- **Bilingual Support**: Generates content in both Spanish and English
- **Telegram Safety**: No emojis to prevent parsing errors
- **Consistent Formatting**: Hashtags joined without spaces, lowercase for hashtags

### 2. Updated Prompt Structure

The new prompt includes:
- Clear format instructions with section separators
- Specific rules for each content type
- Character limit enforcement (600 characters)
- Brand voice requirements (PNPtv! slang)
- Bilingual generation instructions

## Expected Output Format

### Spanish Example:
```
Título sexy del video
---
Descripción del video con un gancho interesante que atrae a los espectadores
---
#categoría1#categoría2#categoría3
---
Artista1, Artista2, Artista3
```

### English Example:
```
Sexy video title
---
Video description with an interesting hook that attracts viewers
---
#category1#category2#category3
---
Artist1, Artist2, Artist3
```

### Combined Output:
```
🇪🇸 ESPAÑOL
Título sexy del video
---
Descripción del video con un gancho interesante que atrae a los espectadores
---
#categoría1#categoría2#categoría3
---
Artista1, Artista2, Artista3

🇬🇧 ENGLISH
Sexy video title
---
Video description with an interesting hook that attracts viewers
---
#category1#category2#category3
---
Artist1, Artist2, Artist3
```

## Benefits

1. **Improved Readability**: Clear separation of content sections
2. **Better Organization**: Easy to identify and extract specific information
3. **Consistent Formatting**: Standardized structure across all share posts
4. **Enhanced User Experience**: More professional and organized presentation
5. **Multilingual Support**: Seamless bilingual content generation

## Testing

- Created test scripts to verify the new format
- Validated prompt structure and expected output
- Confirmed bilingual generation works correctly
- Verified character limits and formatting rules

## Integration

The updated format is automatically integrated with the existing share post workflow:
1. User selects "AI Write (Grok)" option
2. System sends structured prompt to Grok AI
3. Grok generates bilingual content with new format
4. Content is displayed in the preview with proper formatting
5. Post is sent to selected destinations with structured layout

## Backward Compatibility

The changes maintain full backward compatibility:
- Existing share post functionality remains unchanged
- Manual text entry still works as before
- Only AI-generated posts use the new structured format
- All existing features (media upload, buttons, scheduling) continue to work

## Future Enhancements

Potential improvements for future updates:
- Customizable section separators
- Additional content sections (e.g., call-to-action, links)
- Template-based generation for different post types
- Enhanced hashtag and performer validation
