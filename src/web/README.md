# OTPless Billing System Web Frontend

## Overview

The OTPless Billing System web frontend is a modern, enterprise-grade React application that provides administrative and customer portals for managing billing operations. Built with React 18 and TypeScript, it offers a robust, type-safe, and accessible user interface for billing management, usage tracking, and wallet operations.

### Key Features

- 🔐 Secure authentication via OAuth 2.0 and OIDC
- 💼 Comprehensive admin and customer portals
- 📊 Real-time usage analytics and reporting
- 💳 Wallet management and transaction tracking
- 🌐 Internationalization support
- ♿ WCAG 2.1 Level AA compliance
- 📱 Responsive design for all devices

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0 or yarn >= 1.22.0
- Git

### Recommended VSCode Extensions

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- vscode-styled-components
- Jest Runner
- i18n Ally

## Getting Started

1. Clone the repository:
```bash
git clone <repository-url>
cd src/web
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.development
```

4. Start development server:
```bash
npm run dev
```

## Project Structure

```
src/web/
├── public/                 # Static assets
├── src/
│   ├── assets/            # Images, fonts, etc.
│   ├── components/        # Reusable UI components
│   ├── features/          # Feature-based modules
│   ├── hooks/             # Custom React hooks
│   ├── layouts/           # Page layouts
│   ├── lib/               # Third-party library configurations
│   ├── locales/           # i18n translations
│   ├── pages/             # Route components
│   ├── services/          # API services
│   ├── store/             # Redux store configuration
│   ├── styles/            # Global styles and themes
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   ├── App.tsx           # Root component
│   └── main.tsx          # Entry point
├── tests/                 # Test files
├── .env.example          # Environment variables template
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── vite.config.ts        # Vite configuration
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build production bundle
- `npm run test` - Run test suite
- `npm run lint` - Lint code
- `npm run format` - Format code
- `npm run i18n:extract` - Extract i18n strings
- `npm run analyze` - Analyze bundle size
- `npm run typecheck` - Run TypeScript type checking
- `npm run security` - Run security audit

## Development Guidelines

### Code Style

- Follow TypeScript best practices
- Use functional components with hooks
- Implement proper error boundaries
- Write meaningful component documentation
- Follow atomic design principles

### State Management

- Use Redux Toolkit for global state
- Implement React Query for server state
- Use local state for component-specific data
- Follow Redux best practices for actions and reducers

### Testing

- Maintain minimum 80% test coverage
- Write unit tests for utilities and hooks
- Implement integration tests for features
- Use React Testing Library best practices

## Building for Production

```bash
npm run build
```

The production build will be available in the `dist` directory, optimized for:
- Code splitting
- Tree shaking
- Asset optimization
- Minification
- Source maps generation

## Environment Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| VITE_API_URL | Backend API URL | Yes |
| VITE_AUTH0_DOMAIN | Auth0 domain | Yes |
| VITE_AUTH0_CLIENT_ID | Auth0 client ID | Yes |
| VITE_ENVIRONMENT | Deployment environment | Yes |

## Security Guidelines

### Authentication

- Implement Auth0 SDK for secure authentication
- Use secure token storage
- Implement proper session management
- Handle token refresh automatically

### Data Protection

- Sanitize all user inputs
- Implement proper XSS protection
- Use HTTPS for all API calls
- Follow OWASP security best practices

## Performance Optimization

- Implement code splitting
- Use React.lazy for route-based splitting
- Optimize images and assets
- Implement proper caching strategies
- Use performance monitoring tools

## Accessibility

- Follow WCAG 2.1 Level AA guidelines
- Implement proper ARIA attributes
- Ensure keyboard navigation
- Test with screen readers
- Maintain proper color contrast

## Internationalization

- Use i18next for translations
- Support RTL languages
- Implement number and date formatting
- Handle currency display formats

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Clear node_modules and package-lock.json
   - Reinstall dependencies
   - Check for TypeScript errors

2. **Development Server Issues**
   - Check port availability
   - Verify environment variables
   - Clear Vite cache

3. **Authentication Issues**
   - Verify Auth0 configuration
   - Check token expiration
   - Clear browser cache

## Contributing

1. Follow Git branch naming convention
2. Write meaningful commit messages
3. Submit PR with proper description
4. Ensure all tests pass
5. Follow code review process

## License

[License details here]

## Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

---

For more detailed information about specific features or components, please refer to the corresponding documentation in the `docs` directory.