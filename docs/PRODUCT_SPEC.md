# SupplyQuest DZ — Product Specification

**Version:** 0.1
**Status:** Initial Product Specification
**Project Type:** Multi-tenant B2B SaaS
**Primary Market:** Algeria
**Primary Currency:** Algerian Dinar (DZD)

---

# 1. Product Vision

SupplyQuest DZ is an intelligent, multi-tenant supply-chain management and business intelligence platform designed for Algerian SMEs, distributors, wholesalers, retailers, and food-sector businesses.

The platform combines traditional supply-chain management with data-driven analytics and explainable operational recommendations.

The core objective is not simply to record transactions.

SupplyQuest DZ should help a business answer three questions:

1. What is happening in our supply chain?
2. Where are the biggest operational risks?
3. What action should we take next?

The system should combine:

* inventory management
* procurement
* sales
* warehouse management
* supplier management
* demand analysis
* forecasting
* inventory optimization
* supplier performance analysis
* business intelligence
* risk detection
* actionable recommendations

The product should feel like a modern enterprise SaaS platform rather than a simple CRUD application.

---

# 2. Target Users

## 2.1 Business Types

The initial target businesses include:

* food distributors
* wholesalers
* retailers
* supermarket groups
* importers
* agricultural businesses
* pharmacies
* restaurant groups
* small manufacturers
* B2B distributors

The architecture should remain generic enough to support additional industries later.

---

# 3. User Roles

The initial roles are:

## ADMIN

Can:

* manage organization settings
* manage users
* assign roles
* manage all business data
* view audit logs

## MANAGER

Can:

* view operational dashboards
* manage products
* manage suppliers
* manage warehouses
* approve purchasing decisions
* view analytics
* review recommendations

## PURCHASER

Can:

* manage suppliers
* create purchase orders
* receive goods
* view purchasing analytics
* review replenishment recommendations

## ANALYST

Can:

* view analytics
* inspect forecasts
* analyze inventory
* analyze suppliers
* export reports

## OPERATOR

Can:

* record inventory movements
* receive goods
* process operational transactions
* view assigned warehouse information

---

# 4. Core Business Workflows

## 4.1 Procurement

The intended workflow is:

Supplier

→ Purchase Order

→ Order Confirmation

→ Goods Received

→ Inventory Transaction

→ Inventory Updated

→ Supplier Performance Updated

A purchase order should support statuses such as:

* DRAFT
* ORDERED
* PARTIALLY_RECEIVED
* RECEIVED
* CANCELLED

---

# 5. Sales Workflow

The intended workflow is:

Customer

→ Sales Order

→ Order Processing

→ Fulfillment

→ Inventory Decrease

→ Completed Sale

Sales orders should support:

* DRAFT
* CONFIRMED
* PROCESSING
* COMPLETED
* CANCELLED

Business rules must prevent accidental negative inventory unless an explicitly authorized override exists.

---

# 6. Inventory Model

Inventory is one of the most important domains in the system.

The platform must distinguish between:

* on-hand quantity
* reserved quantity
* available quantity
* safety stock
* reorder point
* inventory value
* days of inventory remaining

A simplified relationship is:

available quantity =
on-hand quantity - reserved quantity

Inventory should be tracked through inventory transactions rather than simply overwriting historical values.

Examples of inventory transactions:

* PURCHASE_RECEIPT
* SALE
* RETURN
* ADJUSTMENT
* TRANSFER_IN
* TRANSFER_OUT
* INITIAL_STOCK

Important inventory mutations should be auditable.

---

# 7. Product Model

A product should contain information such as:

* SKU
* name
* description
* category
* unit
* purchase price
* selling price
* minimum stock
* safety stock
* preferred supplier
* active/inactive status

Financial values should use precise decimal/numeric representations rather than floating-point arithmetic.

---

# 8. Warehouse Model

Each organization can have multiple warehouses.

A warehouse should contain:

* name
* code
* location
* wilaya
* capacity where applicable
* active/inactive status

The system should support transfers between warehouses.

---

# 9. Supplier Management

Supplier information should include:

* name
* contact information
* location
* wilaya
* average lead time
* delivery reliability
* order history
* purchase volume
* supplier performance indicators

The system should calculate supplier performance from historical transactions.

Potential metrics include:

* average delivery delay
* average lead time
* on-time delivery rate
* order fill rate
* purchasing volume
* supplier stability score

---

# 10. Customer Management

Customers should contain:

* business name
* contact information
* wilaya
* order history
* purchase volume

Future versions may include customer payment-risk analysis.

---

# 11. Inventory Intelligence

SupplyQuest DZ should provide analytics beyond basic inventory reporting.

Important indicators include:

* stockout risk
* overstock risk
* inventory turnover
* inventory aging
* days of inventory remaining
* slow-moving inventory
* dead stock
* inventory value
* demand trend

---

# 12. Replenishment Engine

The platform should eventually calculate recommended replenishment quantities.

A baseline methodology should include:

Expected demand during lead time

*

Safety stock

=

Reorder point

When available inventory falls at or below the reorder point, the system should consider generating a replenishment recommendation.

A recommendation should never be a black-box statement.

It should explain the factors behind the recommendation.

Example:

"Recommended order: 420 units."

Explanation:

* average daily demand: 52 units
* supplier lead time: 6 days
* safety stock: 97 units
* current available inventory: 83 units
* recent demand trend: +8%

The system should display these drivers to the user.

---

# 13. Demand Forecasting

SupplyQuest DZ should initially prioritize explainable forecasting methods.

V1 forecasting methods may include:

* moving average
* weighted moving average
* exponential smoothing
* trend estimation
* basic seasonality where sufficient historical data exists

Forecast horizons:

* 7 days
* 14 days
* 30 days

Forecast output should contain:

* forecast quantity
* forecasting method
* historical average
* trend
* confidence or uncertainty indication where appropriate

The system must not make unsupported claims about forecasting accuracy.

---

# 14. Data Science Layer

Python will provide the analytics layer for more advanced calculations.

The intended architecture is:

PostgreSQL

↓

Node.js API

↓

Python Analytics Service

↓

Forecasts / scores / recommendations

↓

React interface

The Python layer should remain modular so that forecasting algorithms can be improved without redesigning the main backend.

---

# 15. Business Intelligence

The executive dashboard should provide visibility into:

* revenue
* purchases
* inventory value
* inventory turnover
* stockout risk
* supplier performance
* warehouse performance
* product performance
* demand trends

Charts should be generated from actual database data.

Hard-coded dashboard statistics are not acceptable in the final product.

---

# 16. ABC Analysis

The platform should support ABC inventory analysis.

A possible baseline is:

A:
highest-value/highest-contribution products

B:
medium contribution

C:
long-tail/lower contribution

The exact threshold methodology should be documented in the analytics implementation.

---

# 17. Operational Risk

SupplyQuest DZ should calculate operational risk indicators.

Examples:

* predicted stockout
* supplier delay
* unusual demand increase
* excessive inventory
* declining sales
* inventory aging

Each alert should contain:

* severity
* entity involved
* reason
* timestamp
* recommended action where appropriate

---

# 18. Supply Quest System

Supply Quests are the application's RPG-inspired operational recommendation layer.

They are not fictional game objectives.

They represent real business actions identified by the system.

Examples:

"Prevent Tomato Paste Stockout"

"Review slow-moving Olive Oil inventory"

"Investigate supplier delivery delays"

"Rebalance warehouse inventory"

Each Supply Quest should contain:

* title
* description
* priority
* status
* related product
* related supplier
* related warehouse
* estimated business impact
* creation date
* completion date where applicable

Possible statuses:

* OPEN
* IN_PROGRESS
* COMPLETED
* DISMISSED

---

# 19. RPG-Inspired Resource Metrics

The application may use subtle game-inspired concepts to make complex operational metrics easier to understand.

Examples:

## Warehouse Health

Represents the overall operational condition of a warehouse.

## Supply Risk Score

Represents the estimated risk associated with supply continuity.

## Supplier Stability

Represents supplier reliability.

## Stock Efficiency

Represents inventory efficiency.

## Operational Level

A composite indicator representing operational maturity/performance.

These concepts should remain visually professional.

SupplyQuest DZ must look like enterprise software, not a video game.

---

# 20. Localization

The platform must support:

* English
* French
* Arabic

English and French use LTR.

Arabic must support RTL.

The localization architecture should make adding additional languages possible later.

---

# 21. Algerian Context

The initial market is Algeria.

The system should support:

* Algerian Dinar (DZD)
* Algerian wilayas
* French business terminology
* Arabic business terminology
* bilingual/multilingual workflows

The application should avoid assuming that all Algerian companies follow identical workflows.

The architecture must remain configurable.

---

# 22. Multi-Tenancy

SupplyQuest DZ is a multi-tenant SaaS.

A tenant represents an organization/business.

Every organization-owned entity must be associated with the correct organization.

A user must never be able to access another organization's data.

Tenant isolation must be enforced server-side.

Frontend filtering alone is never sufficient.

---

# 23. Auditability

Important business operations must be auditable.

Examples:

* login
* user creation
* role change
* product creation
* product update
* purchase-order creation
* purchase receipt
* inventory adjustment
* stock transfer
* sales completion
* recommendation status changes

Audit records should contain:

* actor
* organization
* action
* entity
* entity ID
* timestamp
* relevant metadata

---

# 24. Security Requirements

The application should implement:

* secure password hashing
* JWT-based authentication
* authorization middleware
* input validation
* centralized error handling
* rate limiting
* secure HTTP headers
* CORS configuration
* organization isolation
* audit logging

Secrets must never be committed to GitHub.

---

# 25. API Design

The backend should use versioned REST APIs.

Preferred convention:

/api/v1/

The API should provide:

* authentication
* organizations
* users
* products
* categories
* suppliers
* customers
* warehouses
* inventory
* purchasing
* sales
* analytics
* forecasting
* recommendations
* alerts
* audit

API responses should follow a consistent structure.

Validation should occur at API boundaries.

Pagination, filtering and sorting should be implemented for appropriate collection endpoints.

---

# 26. Database Principles

PostgreSQL is the primary database.

The schema should prioritize:

* relational integrity
* normalization
* foreign keys
* unique constraints
* appropriate indexes
* transactional consistency
* tenant isolation
* precise financial values

Business transactions that modify multiple related records should use database transactions where appropriate.

Derived metrics should not be redundantly stored unless there is a clear performance or historical-data reason.

---

# 27. Frontend Principles

The frontend should prioritize:

* clear information hierarchy
* professional enterprise UX
* responsive design
* reusable components
* accessibility
* useful empty states
* useful loading states
* useful error states
* searchable/filterable tables
* meaningful charts
* intuitive workflows

Avoid overly decorative UI.

Complex analytics should be understandable to non-technical business users.

---

# 28. Main Application Areas

Future application sections include:

/login

/dashboard

/products

/products/:id

/inventory

/inventory/movements

/purchases

/purchases/:id

/sales

/sales/:id

/suppliers

/suppliers/:id

/customers

/customers/:id

/analytics

/forecasting

/recommendations

/audit

/settings

---

# 29. Development Phases

## Phase 0 — Foundation

Implement:

* repository architecture
* React frontend
* Express backend
* PostgreSQL
* Prisma
* authentication
* RBAC
* multi-tenancy foundation
* initial schema
* seed system
* localization foundation
* testing foundation

## Phase 1 — Core Supply Chain

Implement:

* products
* categories
* suppliers
* customers
* warehouses
* inventory
* inventory transactions
* purchasing
* sales
* receiving
* stock transfers

## Phase 2 — Inventory Intelligence

Implement:

* stockout detection
* reorder points
* safety stock
* inventory aging
* inventory turnover
* slow-moving inventory
* ABC analysis
* supplier performance
* operational alerts

## Phase 3 — Data Science

Implement:

* Python analytics service
* demand forecasting
* forecast evaluation
* supply risk scoring
* replenishment recommendations
* explainable analytics

## Phase 4 — BI & UX

Implement:

* executive dashboard
* advanced analytics
* interactive visualizations
* Supply Quests
* Arabic RTL
* complete French/Arabic/English localization
* responsive UI
* reporting

## Phase 5 — Hardening

Implement:

* security audit
* automated tests
* performance improvements
* database optimization
* API documentation
* error handling improvements
* deployment configuration
* portfolio documentation

---

# 30. V1 Definition of Done

SupplyQuest DZ V1 is considered complete when a demo organization can:

1. Sign in securely.
2. Manage products.
3. Manage suppliers.
4. Manage warehouses.
5. Record inventory.
6. Create purchase orders.
7. Receive goods.
8. Create sales orders.
9. Update inventory through transactions.
10. View inventory analytics.
11. Identify low-stock products.
12. Calculate replenishment recommendations.
13. View supplier performance.
14. View business intelligence dashboards.
15. View basic demand forecasts.
16. Understand why a recommendation was generated.
17. View Supply Quests.
18. Switch between English, French and Arabic.
19. Use Arabic RTL.
20. View audit history.
21. Demonstrate organization-level data isolation.

---

# 31. Portfolio Objectives

SupplyQuest DZ is also a professional software-engineering portfolio project.

It should demonstrate competency in:

* full-stack development
* backend architecture
* REST APIs
* PostgreSQL
* database design
* authentication
* authorization
* multi-tenancy
* data analytics
* Python
* forecasting
* BI dashboards
* business logic
* software testing
* enterprise UX

The project should be explainable during technical interviews.

Architectural decisions should be documented rather than hidden.

The project should prioritize correctness, maintainability and explainability over the use of unnecessary technologies.

---

# 32. Long-Term Vision

Future versions may include:

* advanced forecasting models
* automated procurement planning
* additional optimization algorithms
* supplier scoring
* anomaly detection
* scenario simulation
* what-if analysis
* automated reporting
* external ERP integrations
* payment integrations
* mobile application
* event-driven architecture
* advanced observability
* cloud deployment

These features are outside the initial V1 scope and should not compromise V1 simplicity.
