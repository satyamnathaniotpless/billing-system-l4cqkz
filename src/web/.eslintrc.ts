// ESLint configuration for OTPless Internal Billing System Web Frontend
// Version requirements:
// eslint: ^8.40.0
// @typescript-eslint/parser: ^5.59.0
// @typescript-eslint/eslint-plugin: ^5.59.0
// eslint-plugin-react: ^7.32.0
// eslint-plugin-react-hooks: ^4.6.0
// eslint-config-prettier: ^8.8.0

export default {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    },
    project: './tsconfig.json',
    tsconfigRootDir: '.'
  },
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks'
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier'
  ],
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', {
      'argsIgnorePattern': '^_'
    }],
    '@typescript-eslint/naming-convention': [
      'error',
      {
        'selector': 'interface',
        'format': ['PascalCase'],
        'prefix': ['I']
      },
      {
        'selector': 'typeAlias',
        'format': ['PascalCase']
      },
      {
        'selector': 'enum',
        'format': ['PascalCase'],
        'prefix': ['E']
      },
      {
        'selector': 'variable',
        'format': ['camelCase', 'UPPER_CASE'],
        'leadingUnderscore': 'allow'
      }
    ],
    '@typescript-eslint/strict-boolean-expressions': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',

    // React specific rules
    'react/react-in-jsx-scope': 'off', // Not needed in React 18+
    'react/prop-types': 'off', // Using TypeScript for prop validation
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react/jsx-no-target-blank': 'error',
    'react/jsx-key': ['error', {
      'checkFragmentShorthand': true
    }],

    // General code quality rules
    'no-console': ['warn', {
      'allow': ['warn', 'error']
    }],
    'eqeqeq': 'error',
    'no-unused-vars': 'off', // Using TypeScript version instead
    'no-debugger': 'error',
    'no-alert': 'error',
    'complexity': ['error', 15],
    'max-lines': ['error', {
      'max': 300,
      'skipBlankLines': true,
      'skipComments': true
    }],
    'max-depth': ['error', 4]
  },
  settings: {
    'react': {
      'version': 'detect'
    }
  },
  env: {
    'browser': true,
    'es2022': true,
    'node': true,
    'jest': true
  },
  ignorePatterns: [
    'node_modules',
    'build',
    'dist',
    'coverage',
    'vite.config.ts',
    '*.test.ts',
    '*.test.tsx',
    '*.stories.tsx'
  ]
};