# Internal Billing System for OTPless

## WHY - Vision & Purpose

### 1. Purpose & Users

- **Primary Problem Solved:**

  - Automate the processing of merchant invoices based on agreed and configured price plans, factoring in platform usage, recurring fixed fees, or custom fees.

  - Manage prepaid accounts in real-time by deducting usage or subscription fees from the wallet balance.

- **Target Users:**

  - **Finance Team:** Automate invoice generation, manage payments (manual or via payment gateways like Razorpay and Stripe), and prevent revenue leakage while ensuring zero errors.

  - **Engineering Team:** Provide an API-first, fully managed metering and pricing service.

  - **Product Team:** Leverage data to optimize pricing decisions and introduce new pricing models efficiently.

- **Value Proposition:**

  - Provide an automated billing platform capable of processing usage events, managing customer price plans, generating invoices, managing prepaid wallets, and providing alerting and analytics to reduce manual intervention and improve operational efficiency.

----------

## WHAT - Core Requirements

### 2. Functional Requirements

#### Core Features

The system must:

1. **Create/Manage Customer Profiles**

   - Enable the creation and management of customer profiles, including contact information, billing addresses, and account hierarchies.

2. **Billable Items**

   - Define billable items representing line items in customer invoices, enabling flexible modeling of services and products.

3. **Price Configurations**

   - Configure pricing plans with flexible tenures and various pricing structures.

   - Support one-time, subscription-based, and usage-based pricing models.

   - Allow multi-currency pricing.

   - Manage rate cards for different billing scenarios, including fixed fees, usage-based rates, and licensing models.

4. **Lifecycle Management**

   - Enable versioning of price plans to handle iterations, grandfathering, and migration seamlessly.

   - Provide overrides for custom contracts and ad-hoc pricing adjustments.

5. **Ingestion**

   - Serve as the event data store to support high-throughput, high-cardinality event streams.

   - Handle asynchronous processing and real-time metered entitlements.

   - Support event updates/reprocessing with inbuilt idempotency guarantees.

6. **Integrations**

   - Provide integration with payment gateways like Stripe and Razorpay.

   - Offer flexibility for custom payment gateways to handle invoice payments (postpaid) or wallet top-ups (prepaid).

7. **Insights**

   - Provide real-time analytics on an internal console.

   - Expose APIs to support customer-facing dashboards.

   - Enable alerting for usage thresholds, revenue milestones, and wallet balance alerts for prepaid customers.

8. **Invoice Generation**

   - Generate invoices with tax support for Indian GST, CGST, and IGST.

   - Allow for invoice review, approval, voiding, or custom invoice creation.

#### User Capabilities

Users must be able to:

1. **Meter and Store Usage:**

   - Track OTPless authentication usage based on attributes like country, channel, status, and other factors.

2. **Manage Pricing:**

   - Configure and update product pricing models as required.

3. **Automate Billing and Payment Workflows:**

   - Streamline invoice generation and payment workflows for customers.

4. **Derive Insights:**

   - Utilize financial reports and real-time analytics to optimize monetization strategies.

5. **Dashboard Capabilities:**

   - Update customer information.

   - Override pricing models for individual customers.

   - View and manage invoices.

   - Monitor and update wallets and payments.

----------

## Features on Admin Panel and via API

### 1. Create/Manage Customer Profiles

- Add and manage customer information, billing addresses, and account hierarchies.

- Associate multiple accounts to a customer.

- Support for alias IDs to consolidate usage and invoicing across multiple accounts.

### 2. Billable Items

- Define and manage billable items forming the basis for billing services.

- Model line items in invoices, including subscriptions, one-time charges, and usage-based services.

### 3. Pricing Plans

- Configure flexible pricing plans to support:

  - **Product Catalogues:** Define master or subset pricing models.

  - **Subscription Tiers:** Package features into good-better-best models.

  - **Custom Contracts:** Tailor pricing for large organizations.

- Support lifecycle management of price plans:

  - Draft, Active, and Archived states.

  - Versioning and migration between versions.

- Define pricing cycles, including:

  - Billing intervals (weekly, monthly, etc.).

  - Grace periods for invoice corrections.

  - Anniversary or fixed cycle start dates.

- Rate card configurations:

  - Fixed Fees: One-time or recurring charges.

  - Usage-Based Rates: Pay-as-you-go models with tiers/slabs.

  - Licensing Models: Seat/user-based pricing.

  - Entitlement and Overage Pricing: Pre-paid and threshold-based models.

  - Credit Grants: Promotional discounts and minimum commitments.

### 4. Invoicing

- Automatic invoice generation based on configured pricing and usage data.

- Support for:

  - Custom charges.

  - Tax calculations.

  - Invoice grouping for consolidated billing.

- Status management:

  - Draft, Ongoing, Due, Paid, and Void.

- Customizable invoice templates.

### 5. Wallet Management

- Maintain prepaid wallets for customers.

- Real-time deductions for usage or subscription charges.

- Alerts for low balances.

- Net-off wallet balances against invoices.

### 6. Insights and Analytics

- Provide real-time usage and cost data.

- Alerting system for thresholds and balances.

- Dashboard and API access to analytics and reporting.

### 7. Integrations

- Native integrations with Stripe and Razorpay.

- Support for custom payment gateways.

- Automatic reconciliation of payments to invoices and wallets.

----------

## HOW - Planning & Implementation

### 3. Technical Foundation

#### Required Stack Components

- **Frontend:** Web-based administrative panel for internal users.

- **Backend:** RESTful API architecture to manage billing workflows and expose features to other OTPless services.

- **Storage:** Secure database for usage data, pricing configurations, invoices, and wallet balances.

- **Payment Gateway Integration:** SDKs for Stripe, Razorpay, and custom payment providers.

- **Ingestion Pipeline:** High-performance pipeline for event processing with idempotency guarantees.

- **Tax Engine:** GST compliance engine for invoicing in India.

- **Alerting System:** Real-time notification and alert management system.

- **Analytics Engine:** Support for real-time data visualization and reporting.

#### System Requirements

- **Performance:** Handle high event throughput with low-latency processing.

- **Scalability:** Support millions of usage events daily.

- **Security:** Encrypted storage, secure API access, and compliance with data protection regulations.

- **Reliability:** Ensure 99.9% uptime.

- **Flexibility:** Allow for configurable pricing models and workflows.

----------

## 6. Implementation Priorities

### High Priority (Must Have)

- Ingestion pipeline for event data.

- Pricing configuration interface.

- Prepaid wallet management.

- Invoice generation with tax compliance.

- Real-time analytics and alerting.

- Secure REST APIs.

### Medium Priority (Should Have)

- Payment gateway integrations.

- Custom invoice creation.

- Customer-facing dashboard API.

- Batch processing for large datasets.

### Low Priority (Nice to Have)

- Advanced analytics dashboards.

- Multi-currency support.

- Forecasting tools for revenue.

- Multiple pricing templates for A/B testing.