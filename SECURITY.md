# Security policy

## Supported versions

Only the latest `main` branch is supported while this portfolio project is under active development.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub Security Advisories for `omid511/inquiry-desk` when the repository is enabled, or contact the repository owner privately through the GitHub profile. Include reproduction steps, affected route/file, impact, and a safe contact method. Remove secrets and real customer data from the report.

The maintainer will acknowledge a report when access is available, validate it against the current branch, and coordinate a fix or mitigation before public disclosure. Never test against a live deployment without permission.

## Data handling

Inquiry text and contact details are sensitive. Use demo fixtures only, keep service-role keys server-side, verify webhook signatures, preserve approval gates, and configure retention before handling real data. If you discover exposed credentials, revoke and rotate them immediately, then report the incident privately.
