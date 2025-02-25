module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.spec.ts'],
  transformIgnorePatterns: [],
  transform: {
    '^.+.tsx?$': ['@swc/jest', {}],
  },
};
