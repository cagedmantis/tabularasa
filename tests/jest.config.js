module.exports = {
    // Test environment
    testEnvironment: 'jsdom',
    
    // Test files
    testMatch: [
        '**/tests/**/*.test.js',
        '**/tests/**/*.test.ts'
    ],
    
    // Setup files
    setupFilesAfterEnv: ['<rootDir>/setup.js'],
    
    // Coverage
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    collectCoverageFrom: [
        '../src/**/*.ts',
        '../dist/**/*.js',
        '!**/node_modules/**',
        '!**/tests/**',
        '!**/coverage/**'
    ],
    
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
    
    // Globals
    globals: {
        'chrome': {},
        'ts-jest': {
            useESM: true
        }
    },
    
    // Verbose output
    verbose: true,
    
    // Preset
    preset: 'ts-jest'
};