# OTPless Internal Billing System

[![Build Status](https://github.com/otpless/billing-system/workflows/CI/badge.svg)](https://github.com/otpless/billing-system/actions)
[![Code Coverage](https://codecov.io/gh/otpless/billing-system/branch/main/graph/badge.svg)](https://codecov.io/gh/otpless/billing-system)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/github/package-json/v/otpless/billing-system)](https://github.com/otpless/billing-system)

A comprehensive, cloud-native billing solution designed to automate and streamline OTPless's authentication service billing operations.

## 🌟 Features

- Real-time usage event processing (1000+ events/second)
- Multi-tenant data architecture with strict isolation
- Automated invoice generation and payment processing
- Real-time prepaid wallet management
- Flexible price plan configuration
- Comprehensive API coverage
- Multi-currency support (USD/IDR)

## 🏗️ Architecture

The system implements a modern, cloud-native architecture featuring:

- Event-driven processing pipeline
- Microservices-based design
- Real-time data processing
- Multi-region deployment capability
- Comprehensive security controls

For detailed architecture information, see [Architecture Documentation](./docs/architecture.md).

## 🚀 Prerequisites

### Required Software

- Docker Engine 24.x
- Docker Compose 2.x
- Node.js 18 LTS
- Java 17 (Corretto)
- Python 3.11
- Go 1.20
- kubectl 1.27+
- Terraform 1.5+

### Cloud Services

- AWS Account with appropriate permissions
- Stripe API access
- Razorpay API access (for regional payments)

## 🏃 Quick Start

1. Clone the repository:
```bash
git clone https://github.com/otpless/billing-system.git
cd billing-system
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start local development environment:
```bash
docker-compose up -d
```

4. Initialize the database:
```bash
./scripts/init-db.sh
```

5. Access the services:
- Admin Portal: http://localhost:3000
- API Documentation: http://localhost:8080/docs
- Monitoring: http://localhost:9090

## 💻 Development Guide

### Project Structure
```
billing-system/
├── src/
│   ├── backend/         # Backend services
│   │   ├── billing/     # Billing service (Java)
│   │   ├── events/      # Event processor (Node.js)
│   │   ├── wallet/      # Wallet service (Go)
│   │   └── invoice/     # Invoice service (Python)
│   └── web/            # Frontend applications
├── infrastructure/     # Infrastructure as Code
│   ├── terraform/     # AWS infrastructure
│   └── kubernetes/    # K8s configurations
├── docs/             # Documentation
└── scripts/         # Utility scripts
```

### Technology Stack

#### Backend Services
- Java 17 (Spring Boot)
- Node.js 18
- Python 3.11
- Go 1.20

#### Frontend
- React 18
- TypeScript 5.0
- Material UI 5

#### Infrastructure
- AWS (EKS, RDS, ElastiCache)
- Kubernetes
- Terraform
- Docker

#### Data Storage
- PostgreSQL
- TimescaleDB
- Redis
- Kafka

## 📦 Deployment

### Development
```bash
./scripts/deploy-dev.sh
```

### Staging
```bash
./scripts/deploy-staging.sh
```

### Production
```bash
./scripts/deploy-prod.sh
```

Detailed deployment instructions are available in the [Deployment Guide](./docs/deploy.md).

## 🧪 Testing

Run all tests:
```bash
./scripts/test-all.sh
```

Run specific service tests:
```bash
./scripts/test.sh <service-name>
```

For detailed testing information, see [Testing Guide](./docs/test.md).

## 📚 API Documentation

- [REST API Reference](./docs/api/README.md)
- [Integration Guide](./docs/integration/README.md)
- [API Examples](./docs/api/examples.md)

## 🔒 Security

- OAuth 2.0 + OIDC authentication
- Role-based access control (RBAC)
- End-to-end encryption
- Regular security audits
- Compliance with PCI DSS and ISO 27001

For security details, see [Security Documentation](./docs/security.md).

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read [Contributing Guidelines](./CONTRIBUTING.md) for details.

## 🔧 Troubleshooting

Common issues and solutions are documented in the [Troubleshooting Guide](./docs/troubleshooting.md).

For additional support:
- Check [GitHub Issues](https://github.com/otpless/billing-system/issues)
- Contact the development team
- Review logs using `./scripts/logs.sh <service-name>`

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OTPless Engineering Team
- Open Source Community
- Contributors and Maintainers

---

For additional information, please refer to the [complete documentation](./docs).