module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/index.js',
    '!src/start.js',
  ],
  testMatch: [
    '**/tests/**/*.test.js',
  ],
  verbose: true,
};
