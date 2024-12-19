---
name: Bug Report
about: Report a bug in the OTPless Internal Billing System
title: "[Component] Brief description"
labels: ["bug", "needs-triage", "needs-reproduction", "billing-system"]
assignees: ["billing-team-lead", "qa-team", "security-team"]
projects: ["OTPless Billing System"]
---

<!-- 
SECURITY NOTICE: Do not include any sensitive information such as:
- API keys or tokens
- Customer PII (Personally Identifiable Information)
- Account credentials
- Financial account details
For security-related bugs, please contact security@otpless.com directly
-->

## Bug Description

### Bug Title
<!-- Follow format: [Component] Brief description -->

### Affected Component
<!-- Select the most specific component -->
- [ ] Event Processing - Usage Tracking
- [ ] Billing Service - Invoice Generation
- [ ] Billing Service - Price Calculation
- [ ] Wallet Service - Balance Management
- [ ] Wallet Service - Transaction Processing
- [ ] Invoice Service - PDF Generation
- [ ] Invoice Service - Tax Calculation
- [ ] API Gateway - Authentication
- [ ] API Gateway - Rate Limiting
- [ ] Web Interface - Admin Portal
- [ ] Web Interface - Customer Portal
- [ ] Infrastructure - AWS Services
- [ ] Infrastructure - Kubernetes
- [ ] Other

### Severity
<!-- Select one based on impact -->
- [ ] Critical - Revenue Impact
- [ ] Critical - System Down
- [ ] High - Customer Facing Impact
- [ ] High - Data Integrity Issue
- [ ] Medium - Feature Degradation
- [ ] Low - Minor Issue

### Security Classification
<!-- Select appropriate classification -->
- [ ] Public
- [ ] Internal
- [ ] Confidential - Security Issue
- [ ] Confidential - Financial Data

## Bug Details

### Current Behavior
<!-- 
Provide a detailed description of the bug
Focus on specific impact on billing or financial operations
Include error messages (sanitized of sensitive data)
-->

### Expected Behavior
<!-- 
Describe what should happen instead
Reference specific business rules or requirements if applicable
-->

### Steps to Reproduce
<!-- 
1. Detailed step-by-step guide to reproduce the issue
2. Include test data (sanitized of sensitive information)
3. Specify any prerequisites or configuration needed
-->

## Environment

### Environment Type
<!-- Select the affected environment -->
- [ ] Production
- [ ] Staging
- [ ] Development
- [ ] DR Site

### Infrastructure Details
<!-- 
Provide relevant details about:
- AWS Region
- Kubernetes Cluster
- Service Versions
- Component Versions
-->

### Relevant Logs
<!-- 
Include sanitized logs, error messages, or stack traces
DO NOT include sensitive data
Use code blocks for formatting
-->
```log
# Insert sanitized logs here
```

## Impact Assessment

### Business Impact
<!-- 
Describe impact on:
- Business operations
- Customer experience
- Service availability
-->

### Financial Impact
<!-- 
Detail any financial implications:
- Revenue impact
- Billing discrepancies
- Transaction issues
DO NOT include specific customer financial data
-->

### Affected Users
<!-- 
Quantify the impact:
- Number of affected customers
- Number of transactions
- Aggregate revenue impact (no specific customer details)
-->

### Workaround
<!-- 
If available, describe:
- Temporary solutions
- Manual interventions
- Customer communication needed
-->

---

**Template Version:** 2.0.0
**Support Contact:** support@otpless.com

<!-- 
For urgent issues:
- Critical severity: Contact on-call team
- Security issues: Contact security@otpless.com
- Revenue impact: Escalate to billing-team-lead
-->