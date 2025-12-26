# Contributing to PNPtv Telegram Bot

Thank you for considering contributing to the PNPtv Telegram Bot! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

1. **Check existing issues** to avoid duplicates
2. **Create a new issue** with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)
   - Logs or screenshots if applicable

### Suggesting Features

1. **Check existing feature requests**
2. **Create a new issue** with:
   - Clear description of the feature
   - Use cases and benefits
   - Potential implementation approach
   - Any relevant examples or mockups

### Pull Requests

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Make your changes**
4. **Write/update tests**
5. **Update documentation**
6. **Commit with clear messages**
7. **Push to your fork**
8. **Submit a pull request**

## Development Setup

### Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- Redis
- Firebase/Firestore account

### Setup Steps

1. **Clone your fork**:
```bash
git clone https://github.com/your-username/pnptv-bot.git
cd pnptv-bot
```

2. **Install dependencies**:
```bash
npm install
```

3. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. **Seed database**:
```bash
npm run seed
```

5. **Run development server**:
```bash
npm run dev
```

## Coding Standards

### JavaScript Style Guide

We follow the Airbnb JavaScript Style Guide with some modifications:

- **Indentation**: 2 spaces
- **Quotes**: Single quotes for strings
- **Semicolons**: Required
- **Line Length**: Max 120 characters
- **Naming**:
  - camelCase for variables and functions
  - PascalCase for classes
  - UPPERCASE for constants

### Linting

Run ESLint before committing:

```bash
npm run lint

# Auto-fix issues
npm run lint:fix
```

### Code Structure

- **Keep functions small**: Aim for single responsibility
- **Use descriptive names**: No abbreviations unless obvious
- **Add comments**: For complex logic only
- **Avoid nesting**: Prefer early returns
- **Error handling**: Always handle errors gracefully

### Example

**Good:**
```javascript
/**
 * Get nearby users within specified radius
 * @param {number} userId - User ID
 * @param {number} radiusKm - Radius in kilometers
 * @returns {Promise<Array>} Nearby users
 */
async function getNearbyUsers(userId, radiusKm) {
  const user = await UserModel.getById(userId);

  if (!user || !user.location) {
    return [];
  }

  const nearby = await UserModel.getNearby(user.location, radiusKm);
  return nearby.filter((u) => u.id !== userId);
}
```

**Bad:**
```javascript
// Get nearby
async function gn(u, r) {
  const usr = await UserModel.getById(u);
  if (usr) {
    if (usr.location) {
      const n = await UserModel.getNearby(usr.location, r);
      return n.filter(x => x.id !== u);
    } else {
      return [];
    }
  }
  return [];
}
```

## Testing

### Writing Tests

- Write tests for all new features
- Update tests when modifying existing features
- Aim for >70% code coverage

### Test Structure

```javascript
describe('FeatureName', () => {
  describe('functionName', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = functionName(input);

      // Assert
      expect(result).toBe('expected');
    });

    it('should handle edge case', () => {
      // Test edge cases
    });

    it('should handle errors', () => {
      // Test error handling
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm test -- --coverage

# Specific file
npm test -- validation.test.js
```

## Git Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates
- `test/description` - Test additions/updates

### Commit Messages

Follow the Conventional Commits specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(payments): add Stripe payment provider

Implement Stripe payment integration with webhook support.
Includes:
- Payment creation
- Webhook handling
- Subscription management

Closes #123
```

```
fix(auth): resolve session timeout issue

Fix issue where sessions expire prematurely due to incorrect
TTL calculation.

Fixes #456
```

### Pull Request Process

1. **Update documentation** if needed
2. **Add tests** for new features
3. **Run linter**: `npm run lint`
4. **Run tests**: `npm test`
5. **Update CHANGELOG.md** if applicable
6. **Reference related issues** in PR description
7. **Request review** from maintainers

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests added/updated
- [ ] All tests passing
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Commented complex code
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Added tests with >70% coverage
- [ ] Dependent changes merged

## Related Issues
Closes #issue_number
```

## Documentation

### Code Documentation

- Add JSDoc comments to all functions
- Document parameters, return values, and exceptions
- Include usage examples for complex functions

### README Updates

Update README.md when:
- Adding new features
- Changing configuration
- Modifying installation steps
- Updating dependencies

### API Documentation

Update docs/API.md when:
- Adding new endpoints
- Modifying request/response formats
- Changing authentication

## Security

### Reporting Security Issues

**DO NOT** open public issues for security vulnerabilities.

Instead, email security@pnptv.com with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Security Best Practices

- Never commit secrets or API keys
- Validate all user inputs
- Use parameterized queries
- Implement rate limiting
- Keep dependencies updated

## Performance

### Performance Guidelines

- Optimize database queries
- Use caching where appropriate
- Implement pagination for large datasets
- Avoid N+1 queries
- Profile code for bottlenecks

### Testing Performance

- Load test new features
- Monitor memory usage
- Check for memory leaks
- Optimize Redis cache usage

## Review Process

### What We Look For

- Code quality and style
- Test coverage
- Documentation
- Performance impact
- Security considerations
- Backward compatibility

### Review Timeline

- Initial review: 1-3 business days
- Follow-up reviews: 1-2 business days
- Merge: After approval from 1+ maintainers

## Getting Help

### Resources

- Documentation: https://docs.pnptv.com
- API Reference: docs/API.md
- Deployment Guide: docs/DEPLOYMENT.md

### Contact

- General questions: dev@pnptv.com
- Security: security@pnptv.com
- Telegram: @pnptv_dev

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Credited in documentation

Thank you for contributing to PNPtv! 🎉
