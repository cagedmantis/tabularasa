module.exports = {
    // Project root is the repository, so coverage can be collected from src/
    rootDir: '..',

    // Test environment
    testEnvironment: 'jsdom',

    // Test files (TypeScript sources are pulled in via require() from the
    // .test.js files and transformed by ts-jest)
    testMatch: [
        '<rootDir>/tests/**/*.test.js'
    ],

    // Setup files
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

    // Coverage
    collectCoverage: true,
    coverageDirectory: '<rootDir>/tests/coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    collectCoverageFrom: [
        '<rootDir>/src/**/*.ts'
    ],
    // A floor a little under what the suite reaches today, so coverage of
    // the shipped code cannot quietly erode. Raise it as coverage grows.
    coverageThreshold: {
        global: {
            statements: 82,
            branches: 72,
            functions: 78,
            lines: 84
        }
    },

    // Module paths
    moduleFileExtensions: ['js', 'json', 'ts'],

    // Transform
    transform: {
        '^.+\\.js$': 'babel-jest',
        '^.+\\.ts$': 'ts-jest'
    },

    // Ignore patterns
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '/icons/'
    ],

    // Verbose output
    verbose: true,

    // Preset
    preset: 'ts-jest'
};
