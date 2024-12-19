<!-- OTPless Internal Billing System - Pull Request Template v1.0.0 -->

## PR Type
<!-- Check all that apply -->
- [ ] Feature
- [ ] Bug Fix
- [ ] Security Update
- [ ] Performance Improvement
- [ ] Refactoring
- [ ] Test
- [ ] Infrastructure
- [ ] CI/CD
- [ ] Documentation

## Description
### Summary
<!-- Provide a clear and concise description of the changes -->


### Related Issues
<!-- Link to related issues using #issue_number -->


### Breaking Changes
<!-- Check if applicable -->
- [ ] Yes - This PR includes breaking changes
<!-- If yes, describe the impact and migration steps -->


## Changes
### Components Modified
<!-- Select the primary component(s) affected -->
- [ ] Event Processing
- [ ] Billing Service
- [ ] Wallet Service
- [ ] Invoice Service
- [ ] API Gateway
- [ ] Web Interface
- [ ] Infrastructure
- [ ] Documentation

### Database Changes
- [ ] Schema modifications
- [ ] Data migrations
- [ ] No database changes

### API Changes
- [ ] New endpoints
- [ ] Modified existing endpoints
- [ ] Updated API documentation
- [ ] No API changes

## Testing
### Test Coverage
<!-- Describe the test coverage and provide metrics -->
- Unit Tests:
- Integration Tests:
- Coverage Metrics:

### Manual Testing
<!-- Describe the manual testing performed -->
#### Development Environment
- Steps taken:
- Results:

#### Staging Environment
- Steps taken:
- Results:

### Performance Testing
<!-- If applicable, provide performance test results -->


## Security
### Security Review
- [ ] Changes require security team review
- [ ] Changes involve authentication/authorization
- [ ] Changes affect data privacy

### Sensitive Data
- [ ] Changes involve PII
- [ ] Changes involve financial data
- [ ] Changes involve credentials/secrets

## Deployment
### Configuration Changes
- [ ] New environment variables
- [ ] Updated configuration files
- [ ] Infrastructure changes

### Database Migrations
- [ ] Forward migration scripts
- [ ] Rollback scripts
- [ ] No migrations required

### Deployment Steps
<!-- Special deployment instructions or rollback procedures -->


## Checklist
<!-- Ensure all items are completed before requesting review -->
- [ ] Code follows project style guidelines
- [ ] Tests are passing in CI
- [ ] Documentation has been updated
- [ ] No credentials or sensitive data in code
- [ ] Security implications have been considered
- [ ] Performance impact has been assessed
- [ ] Breaking changes are documented
- [ ] Rollback procedures are documented

## Reviewers
<!-- Required reviewers based on changes -->
- [ ] Technical Lead
- [ ] Domain Expert
- [ ] Security Team (if security-related)

/label ~needs-review ~component/[component] ~size/[size]
<!-- Add security-review label if security changes are included -->
<!-- Add breaking-change label if breaking changes are included -->