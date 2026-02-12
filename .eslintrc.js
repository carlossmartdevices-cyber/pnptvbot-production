module.exports = {
  env: {
    node: true,
    es2023: true,
    jest: true,
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 2023,
  },
  globals: {
    Intl: 'readonly',
    fetch: 'readonly',
    globalThis: 'readonly',
  },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off',
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
};
