module.exports = {
    // Test environment
    testEnvironment: 'jsdom',
    
    // Test files
    testMatch: [
        '**/tests/**/*.test.js'
    ],
    
    // Setup files
    setupFilesAfterEnv: ['<rootDir>/setup.js'],
    
    // Coverage
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    collectCoverageFrom: [
        '../popup.js',
        '!**/node_modules/**',
        '!**/tests/**',
        '!**/coverage/**'
    ],
    
    // Module paths
    moduleFileExtensions: ['js', 'json'],
    
    // Transform
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    
    // Ignore patterns
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '/icons/'
    ],
    
    // Globals
    globals: {
        'chrome': {}
    },
    
    // Verbose output
    verbose: true
};