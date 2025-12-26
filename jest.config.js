module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/bot/core/bot.js',
  ],
  testMatch: [
    '**/tests/**/*.test.js',
  ],
  coverageThreshold: {
    global: {
      branches: 5,
      functions: 10,
      lines: 8,
      statements: 8,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
};
