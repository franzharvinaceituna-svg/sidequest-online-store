# SIDE QUEST HQ — Architecture & Integration Decisions

## Status

Phase: Architecture / Discovery

The SIDE QUEST Card Ledger is currently under active upgrade.

No production integration with Card Ledger will be implemented until the upgraded Ledger has been audited and validated in staging.

## A — System Boundaries

SIDE QUEST is planned as a multi-system business platform with distinct responsibilities.

### A.1 Card Ledger

The Card Ledger is the system intended to manage the authoritative identity and business lifecycle of physical collectible inventory.

The current Card Ledger is under active upgrade. Its final schema, authorization model, and integration interface are therefore **not yet treated as confirmed architecture**.

The upgraded Ledger must be audited before production integration.

### A.2 Store Core

The Online Store currently operates on Supabase and manages:

- storefront products and listings
- public product presentation
- physical inventory availability for Store purposes
- customer checkout
- orders and order lifecycle
- reservations and unpaid-order expiry
- payment-method workflow
- Store-side inventory events
- Store-specific product/listing presentation
- Store customer-facing data

The Store already models inventory as one database row per physical unit and provides a nullable, unique `card_ledger_id` field for future Ledger linkage.

### A.3 Customers

Customer records currently live within the Store database.

The Store supports guest checkout and has an `auth_user_id` relationship available for future customer accounts.

Customer ownership, authentication, privacy, and future collector-account capabilities must remain separate from internal inventory/cost data.

### A.4 SIDE QUEST HQ

SIDE QUEST HQ is the planned business command center/control plane.

HQ should eventually provide a unified operational view across the underlying systems without duplicating authoritative business data unnecessarily.

HQ must use explicit system boundaries and permissions rather than becoming an uncontrolled second source of truth.

### A.5 Integration Principle

No system should silently overwrite another system's authoritative data.

Integration should use explicit identifiers, controlled server-side operations, audit events, and reconciliation.

The exact Card Ledger ↔ Store contract remains **OPEN** until the upgraded Card Ledger has been audited.

## B — Database Topology

### B.1 Store Database — Confirmed

The Online Store currently uses a Supabase PostgreSQL database.

The production project is:

- Supabase project: `side-quest-store`
- Project ID: `qkgcfnkwmslipcphezbc`
- Region: Southeast Asia / Singapore
- Store migrations currently installed: `0001` through `0004`

The Store database contains the current Store-side domains, including:

- products
- product images
- inventory items
- inventory item images
- customers
- orders
- order items
- inventory events
- order events
- admin profiles
- wishlists
- contact messages

Row Level Security is enabled across the Store tables. Public storefront access is provided through controlled storefront views rather than direct table access.

### B.2 Card Ledger Database — OPEN / DISCOVERY REQUIRED

The current Card Ledger is under active upgrade.

Its final database topology must therefore be discovered from the upgraded Ledger before any production integration decision is finalized.

Historical Card Ledger deployment folders (`deploy-v51` through `deploy-v54`) have been identified, but they are treated as historical deployment artifacts and **not as the authoritative architecture for the upgraded Ledger**.

The following must be verified from the upgraded Ledger:

- database provider and project
- schema ownership
- tables and relationships
- authentication model
- authorization model
- physical inventory identity
- event/audit model
- server-side functions or APIs
- image/storage architecture
- business/personal ownership model
- integration mechanism available to HQ and Store

### B.3 HQ Database — OPEN

SIDE QUEST HQ should not create a duplicate copy of Ledger or Store master data merely for convenience.

The final HQ database topology is therefore an open architecture decision.

Before creating HQ-owned tables, determine which data is:

1. authoritative in an existing system,
2. operationally derived,
3. genuinely HQ-owned, or
4. required only as an audit/reconciliation record.

Any HQ database should use explicit references to authoritative records rather than silently becoming a competing source of truth.

### B.4 Topology Decision Rule

No production database consolidation, replication, synchronization, or cross-system write path will be implemented until the upgraded Card Ledger topology has been inspected and the integration boundary has been documented.

## C — Staff Authorization

### C.1 Store Authorization — Confirmed

The Store uses Supabase Auth for administrator authentication.

Public customer signup is disabled for the current Store administration model.

Store administrator authorization is represented by `public.admin_profiles`, including:

- authenticated user ID
- display name
- role
- permissions
- active status

The confirmed Store roles are:

- `OWNER`
- `STAFF`

Confirmed Store permissions include:

- `VIEW_INVENTORY`
- `EDIT_INVENTORY`
- `MANAGE_ORDERS`
- `MANAGE_PRODUCTS`
- `VIEW_COST`
- `MANAGE_SETTINGS`

Sensitive operations are protected by server-side permission checks rather than relying on frontend visibility.

Cost and other internal information must not be exposed merely because a user can access the Store administration interface.

### C.2 Card Ledger Authorization — OPEN / DISCOVERY REQUIRED

The upgraded Card Ledger's authorization model has not yet been audited.

The following must be verified from the upgraded Ledger:

- authentication provider
- staff/user identity model
- roles
- permissions
- owner/admin capabilities
- write authorization
- service-to-service authorization
- audit attribution
- account lifecycle and deactivation

The historical v51–v54 deployments are not sufficient evidence for the final authorization architecture.

### C.3 HQ Authorization — OPEN

SIDE QUEST HQ should provide centralized operational access without bypassing the authorization boundaries of the underlying systems.

Before implementation, determine whether HQ should:

1. reuse an existing identity provider,
2. use a shared authorization model,
3. maintain HQ-specific permissions, or
4. combine HQ permissions with delegated permissions from the underlying systems.

No HQ administrator role or permission matrix should be treated as final until the Card Ledger authorization model has been audited.

### C.4 Authorization Principle

Authorization must be enforced server-side at the operation or data boundary.

Frontend hiding is not an authorization mechanism.

Cross-system operations must authenticate and authorize the acting user or service explicitly, and audit records must preserve the actor responsible for the operation.

## D — Data Ownership

### D.1 Ownership Principle

Each important business datum should have one authoritative owner.

Other systems may hold references, projections, snapshots, or operational state when necessary, but they must not silently overwrite the authoritative record.

Where ownership has not yet been confirmed, the architecture must explicitly mark it as **OPEN**.

### D.2 Card Ledger — Intended / Pending Validation

Subject to audit of the upgraded Card Ledger, the Ledger is intended to be authoritative for the identity and business history of physical collectible items.

Candidate Ledger-owned domains include:

- physical item identity
- item provenance
- acquisition history
- ownership state
- business versus personal ownership
- condition history
- grading/certification identity
- cost basis
- trades
- transfers
- item-level acquisition and disposal history

These domains remain **provisional until the upgraded Ledger is audited**.

### D.3 Store — Confirmed Ownership

The Store currently owns Store-specific operational data and workflows, including:

- storefront listings
- Store product presentation
- listing descriptions and presentation overrides
- featured/on-sale presentation
- customer checkout
- orders
- payment workflow
- reservations and holds
- Store order lifecycle
- Store inventory availability state
- Store order and inventory audit events

The Store's `inventory_items` table represents physical units for Store operations.

The existing `card_ledger_id` is a reference intended to connect a Store physical unit to its corresponding Ledger item. It does not, by itself, establish that the Store owns the underlying Ledger item data.

### D.4 Customer Data

The Store currently owns its customer records and guest checkout information.

Customer data must remain isolated from internal inventory cost, acquisition, provenance, and other sensitive business information except where an explicit operational need and authorization exist.

### D.5 HQ-Owned Data — OPEN

HQ should own only data that is genuinely required for HQ operations and is not already authoritative elsewhere.

Potential HQ-owned domains may include:

- cross-system configuration
- workflow assignments
- reconciliation records
- integration health/status
- business-level dashboards or derived metrics
- administrative notes that are explicitly HQ-owned

The final list is **OPEN** and should be determined after the Card Ledger audit.

### D.6 Derived and Snapshot Data

Derived metrics, dashboard counts, search indexes, cached projections, and reporting snapshots may exist outside the authoritative system when required for performance or usability.

Such data must be clearly identified as derived and must be reproducible from the authoritative sources.

### D.7 Ownership Rule

A future integration must define, for every synchronized field:

1. authoritative owner,
2. permitted readers,
3. permitted writers,
4. synchronization direction,
5. conflict behavior,
6. audit requirements, and
7. reconciliation behavior.

No production synchronization should be implemented until these rules are defined.

## E — Card Ledger Integration Contract

### E.1 Status

The Card Ledger integration contract is **PENDING FINAL VALIDATION**.

The current Ledger is under active upgrade. This section defines the requirements that must be evaluated against the upgraded Ledger before production integration.

No historical deployment should be treated as the final integration contract.

### E.2 Physical Item Identity

Every physical collectible that is linked between systems must have a stable identifier.

The Store currently provides:

- `inventory_item_id` as its Store-side physical-unit identifier
- `card_ledger_id` as the nullable unique reference to the future Ledger physical-item identifier

The upgraded Ledger must expose a stable physical-item identifier suitable for this relationship.

The final identity mapping is **OPEN** until the upgraded Ledger is audited.

### E.3 Mapping Requirements

For every linked physical item, the integration must be able to determine:

- Store inventory item ID
- Card Ledger item ID
- product/catalog identity where applicable
- current Store status
- current Ledger ownership/status
- whether the mapping is active, missing, or conflicted

Duplicate Ledger identifiers must not silently map to multiple Store physical units.

### E.4 Lifecycle Synchronization

The final contract must define how the following lifecycle states are represented across systems:

- available for sale
- reserved
- hold extended
- sold
- cancelled/released
- returned to stock
- archived
- transferred between business and personal ownership

The exact event names, direction, and synchronization mechanism are **OPEN** until the upgraded Ledger is audited.

### E.5 Sale Recording

A completed Store sale must eventually be represented in the authoritative business history of the corresponding physical item.

The integration must define:

- which system records the authoritative sale event
- which system supplies the order/reference ID
- how sale price and relevant financial data are recorded
- how the physical item's ownership/status changes
- how duplicate sale submissions are prevented
- how a failed Ledger write is retried or reconciled

No production sale synchronization will be implemented until these rules are finalized.

### E.6 Business and Personal Ownership

The integration must support movement of physical items between:

- personal collection
- SIDE QUEST business inventory

The final workflow must preserve provenance and distinguish an ownership transfer from a new external acquisition.

The upgraded Ledger must be audited to determine its existing support for these concepts.

### E.7 Idempotency

Cross-system operations must be idempotent.

Retrying the same operation must not create:

- duplicate physical items
- duplicate sales
- duplicate transfers
- duplicate ownership changes
- duplicate financial records

Every integration command or event that can be retried must have a stable operation/event identifier.

### E.8 Failure Handling

The integration must explicitly handle partial failure.

Examples include:

- Store operation succeeds but Ledger synchronization fails
- Ledger operation succeeds but Store acknowledgement fails
- network timeout after the remote operation actually succeeded
- duplicate webhook/event delivery
- stale status or conflicting updates

The system must prefer explicit reconciliation over silently guessing the correct state.

### E.9 Auditability

Every cross-system write must preserve:

- acting user or service
- source system
- destination system
- operation/event identifier
- source record identifier
- destination record identifier
- timestamp
- previous state where applicable
- resulting state
- reason/context where applicable

### E.10 Server-Side Boundary

Secrets required for cross-system writes must never be exposed to the browser.

Service credentials, privileged database keys, or equivalent integration credentials must remain server-side.

The exact mechanism—Supabase Edge Function, database function, API endpoint, or another controlled server-side boundary—is **OPEN** until the upgraded Ledger topology is known.

### E.11 Reconciliation

The final integration must provide a way to identify:

- Store items without Ledger mappings
- Ledger items expected to be online but missing from Store
- conflicting statuses
- conflicting ownership
- failed synchronization operations
- duplicate mappings
- stale projections

Reconciliation must be a deliberate operational capability rather than an ad-hoc database repair.

### E.12 Staging Gate

Before production integration, the upgraded Card Ledger must pass a staging integration test covering at minimum:

1. create/link a physical item
2. publish it to Store
3. reserve it
4. release the reservation
5. reserve again
6. complete a test sale
7. record the sale in Ledger
8. test a failed synchronization and retry
9. test duplicate event delivery
10. test return-to-stock
11. test business/personal transfer
12. verify audit trails and reconciliation

Production integration must not begin until these tests pass and the final ownership/mapping contract is documented.

## F — Store Integration

### F.1 Current Store Architecture

The Store is already operating on Supabase and should be treated as the established Store-side operational system.

The Store represents each physical unit as an `inventory_items` row.

The Store currently has a nullable, unique `card_ledger_id` field intended to link a physical Store unit to its corresponding Card Ledger item.

No replacement inventory model is required solely to support future Ledger integration.

### F.2 Publishing to the Store

The future integration must provide a controlled mechanism for making an eligible physical item available through the Store.

Eligibility rules must be defined by the final Ledger/Store contract.

At minimum, the Store must not publish:

- items without a valid physical identity
- items that are not eligible for business sale
- items that are unavailable or otherwise incompatible with Store availability
- items whose identity mapping conflicts with another physical unit

The exact publication trigger and source of eligibility remain **OPEN** until the upgraded Ledger is audited.

### F.3 Store Listing Ownership

The Store should retain ownership of Store-specific presentation.

This includes, where applicable:

- listing title
- Store description
- featured state
- Store sale presentation
- storefront category placement
- public merchandising
- Store-specific media/presentation metadata

These fields must not be overwritten merely because a Ledger item is synchronized.

### F.4 Physical Item Identity

The Store's `inventory_item_id` remains the Store-side identifier.

The Ledger identifier is stored in `card_ledger_id`.

The integration must preserve both identifiers and must never replace one system's identifier with the other's.

### F.5 Pricing

The final pricing contract is **OPEN** until Ledger pricing ownership is audited.

The integration must explicitly distinguish:

- market/reference value
- Ledger acquisition/cost information
- Store selling price
- Store sale price
- customer-facing price snapshots

Store checkout must continue to use the authoritative database price rather than trusting browser-supplied pricing.

### F.6 Reservations and Holds

Store reservations remain a Store operational concern because they are directly tied to customer checkout and order expiry.

The existing Store reservation lifecycle must continue to protect against double-selling.

Any Ledger synchronization caused by reservation state must be explicit and idempotent.

The Ledger must not bypass Store reservation controls by directly changing Store inventory state.

### F.7 Order Completion and Sale

The Store order lifecycle remains authoritative for Store order processing.

When an order results in a completed physical sale, the final integration must provide the corresponding Ledger sale/business-history record.

The exact transaction boundary and synchronization mechanism remain **OPEN** until the upgraded Ledger has been audited.

### F.8 Cancellation, Expiry and Return

Store cancellation and unpaid-order expiry must continue to release Store reservations according to the existing database lifecycle.

A refund after a committed sale must not automatically imply that an item is available for sale again.

Return-to-stock remains an explicit operational action and must be reconciled with the Ledger when integration is enabled.

### F.9 Photos and Media

The Store may retain Store-facing product and exact-unit images required for merchandising and customer transparency.

The final integration must distinguish:

- Ledger/private item media
- Store/public item media
- catalog/reference imagery

Private Ledger media must not become publicly accessible merely because an item is linked to the Store.

### F.10 Store Write Boundary

The Store must not directly modify Ledger-owned authoritative fields through ordinary frontend operations.

Any future Ledger-affecting operation must use the approved server-side integration boundary and authorization model.

### F.11 Store Failure Behavior

A temporary Ledger integration failure must not silently corrupt the Store's order or reservation state.

The final integration must define whether a Ledger synchronization failure:

- blocks an operation,
- queues it for retry,
- marks it as pending reconciliation, or
- permits the Store operation and records an integration exception.

This decision remains **OPEN** until the upgraded Ledger architecture is known.

### F.12 Compatibility Principle

Card Ledger integration should extend the existing Store architecture rather than replace stable Store mechanisms unnecessarily.

Existing Store protections for pricing, reservations, order state, RLS, audit events, and physical-unit identity must remain intact unless a documented architecture decision explicitly changes them.

## G — Customer & Public Data

### G.1 Public Data Principle

Public-facing Store data must contain only information intentionally published for customers.

Internal business data must never become public merely because systems are integrated.

The public boundary must exclude, unless explicitly intended for publication:

- acquisition cost
- cost basis
- profit or margin
- supplier information
- internal notes
- private provenance details
- private inventory identifiers
- customer information
- order information
- staff information
- private Ledger data

### G.2 Storefront Data — Confirmed

The Store currently exposes public product and inventory information through controlled storefront views.

Public inventory information may include customer-facing fields such as:

- product name
- SKU
- category
- description
- Pokémon
- set
- card number
- language
- condition
- grading information
- selling price
- sale price where applicable
- featured/on-sale presentation
- available quantity
- approved public images

The Store's public views do not expose acquisition cost, internal notes, customer/order records, or other restricted administration data.

### G.3 Exact Physical Items

Exact-unit information may be exposed publicly only when it is intentionally required for customer transparency.

Examples may include:

- condition
- grading company
- grade
- certification number
- approved exact-item photos

Private internal identifiers and internal business information must remain protected.

### G.4 Customer Data

Customer records are currently maintained by the Store.

Guest checkout requires customer contact and shipping information for order processing.

Future authenticated customer accounts may be linked through `auth_user_id`.

Customer data must be accessible only for legitimate operational purposes and must not be exposed to public storefront views.

### G.5 Customer Accounts and Collector Features

The Store database already contains structures intended to support future customer accounts and wishlists.

Future Collector Club, reviews, showcase, want-list, trade, and other collector features must define their privacy and ownership rules before implementation.

Customer-generated information must not automatically become public without an explicit product rule or user-facing consent where appropriate.

### G.6 HQ Access

HQ may eventually aggregate operational information needed for business management.

HQ access must remain subject to role and permission controls.

HQ should not expose internal business or customer information to public-facing Store endpoints merely because HQ can access it.

### G.7 Card Ledger Data

The upgraded Card Ledger may contain sensitive information such as acquisition history, cost basis, provenance, ownership history, trades, transfers, and private item media.

The final Ledger-to-Store contract must explicitly identify which fields are:

1. public,
2. customer-visible,
3. staff-visible,
4. owner-only, or
5. private to the Ledger.

No Ledger field should be assumed to be public by default.

### G.8 Media Boundary

Public Store images must use public-safe assets or references.

Private Ledger media must remain protected and must not be exposed through public URLs solely because an item is linked to the Store.

The final media architecture is **OPEN** until the upgraded Ledger storage model is audited.

### G.9 Public API Principle

Public APIs and views must expose allowlisted fields rather than entire internal records.

New integration fields should be considered private unless explicitly added to the public contract.

## H — Audit & Reconciliation

### H.1 Audit Principle

Every material business-state change must be attributable, reviewable, and recoverable.

Audit records must identify, where applicable:

- actor
- source system
- affected record
- event type
- previous state
- resulting state
- timestamp
- reason or note
- related order, item, or integration operation

Audit data must not be treated as ordinary editable business data.

### H.2 Store Audit — Confirmed

The Store currently maintains separate audit structures for:

- inventory events
- order events

Store inventory lifecycle events include operational states such as:

- CREATED
- RESERVED
- RELEASED
- EXPIRED
- HOLD_EXTENDED
- SOLD
- RETURNED_TO_STOCK
- HOLD
- ARCHIVED
- STATUS_CHANGE

The Store also records order lifecycle events.

These existing audit mechanisms must remain intact when future integration is introduced.

### H.3 Cross-System Audit

Future Card Ledger ↔ Store operations must produce sufficient audit information to reconstruct what happened across both systems.

A cross-system operation should be traceable from:

1. initiating actor
2. source-system operation
3. integration event/operation ID
4. destination-system operation
5. resulting state
6. reconciliation status

### H.4 Integration Event Identity

Every retriable cross-system operation should have a stable unique identifier.

The same event received more than once must be recognized as a duplicate rather than creating another business operation.

The final event model is **OPEN** until the upgraded Card Ledger audit/event architecture is inspected.

### H.5 Reconciliation States

Future HQ or integration tooling should be able to distinguish at minimum:

- synchronized
- pending
- failed
- retrying
- conflicting
- missing mapping
- stale
- manually resolved

These states should represent integration health rather than overwrite authoritative business state.

### H.6 Reconciliation Examples

The system should be able to identify cases such as:

- Store inventory item without a Ledger mapping
- Ledger item expected to be online but missing from Store
- Store and Ledger disagree on availability
- Store and Ledger disagree on ownership
- Store sale without corresponding Ledger sale record
- Ledger sale without corresponding Store order
- duplicate item mapping
- failed synchronization
- stale Store projection
- stale Ledger projection

### H.7 Resolution

Reconciliation tools must not silently choose a winner when authoritative ownership is unclear.

A conflict should provide enough information for an authorized operator to determine the correct resolution according to the documented ownership rules.

Manual resolution must itself be audited.

### H.8 HQ Operational View

SIDE QUEST HQ should eventually provide authorized operators with a consolidated view of:

- integration health
- unresolved mappings
- failed operations
- conflicts
- stale records
- recent cross-system events
- reconciliation history

HQ should surface the underlying records and their authoritative source rather than presenting derived data as if it were authoritative.

### H.9 Audit Retention

The final retention policy for Store, Ledger, and cross-system audit records is **OPEN**.

Before production integration, determine:

- retention period
- archival requirements
- access permissions
- export/backup requirements
- whether audit records are immutable
- recovery requirements

## I — Migration & Rollout

### I.1 Rollout Principle

Card Ledger integration must be introduced incrementally.

Production Store and Card Ledger data must not be modified merely to test an integration design.

Each stage must have a defined rollback or recovery path before proceeding.

### I.2 Stage 0 — Preserve Current Production

Before integration work begins:

- preserve a verified backup of the Store
- preserve the current production database state
- preserve the current Store deployment
- preserve the current Card Ledger state according to its own backup procedure
- record the versions/commits being treated as the pre-integration baseline

The current production Store must remain operational during Card Ledger development.

### I.3 Stage 1 — Complete Card Ledger Upgrade

The Card Ledger upgrade must be completed independently of production Store integration.

No assumptions should be made about its final schema, authorization, event model, or API until the upgraded version is ready for audit.

### I.4 Stage 2 — Audit the Upgraded Ledger

After the Ledger upgrade is complete, inspect the actual implementation and document:

- database topology
- schema
- physical item identity
- ownership model
- business/personal lifecycle
- authentication
- authorization
- audit/events
- storage/media
- server-side operations
- available integration interfaces

Compare the findings against Sections B–E of this document.

Any mismatch becomes an explicit architecture decision before integration proceeds.

### I.5 Stage 3 — Build Staging

Create a staging environment that does not write to production Store or production Ledger data.

Use representative test data covering:

- singles
- graded/slabbed items
- sealed products
- bulk/interchangeable inventory where applicable
- business inventory
- personal collection
- items with and without public media
- orders and reservations

### I.6 Stage 4 — Dry-Run Mapping

Before importing or linking real production inventory:

- map existing Store physical units
- map Ledger physical items
- identify missing mappings
- identify duplicates
- identify ambiguous ownership
- identify items that should not be published
- identify items requiring manual review

The dry run must not modify production authoritative records.

### I.7 Stage 5 — Staging Integration Tests

Run the integration contract tests defined in Section E.

Also verify:

- permission boundaries
- public-data boundaries
- cost/privacy protection
- media access
- duplicate-event handling
- retries
- partial failure
- reconciliation
- audit trails
- rollback/recovery

### I.8 Stage 6 — Production Readiness Gate

Production integration requires all of the following:

- upgraded Ledger audited
- final ownership model documented
- final identifier mapping documented
- final authorization model documented
- server-side integration boundary approved
- staging tests passed
- reconciliation tested
- backups verified
- rollback procedure documented
- public/private data boundaries verified
- no unresolved critical conflicts

### I.9 Stage 7 — Controlled Production Integration

Production integration should begin with a limited, observable subset of inventory.

Do not migrate or publish the entire inventory population in the first production operation.

Monitor:

- synchronization success/failure
- duplicate mappings
- reservation behavior
- sale recording
- reconciliation exceptions
- audit events
- public exposure
- system performance

Expand only after the initial production subset remains stable.

### I.10 Rollback Principle

Rollback must preserve authoritative business history.

A rollback must not:

- delete completed sales
- erase provenance
- duplicate physical inventory
- silently reverse ownership
- overwrite authoritative records with stale snapshots

Where a technical rollback is impossible without losing business history, use an explicit compensating operation and audit it.

### I.11 Migration Completion

Integration is considered complete only when:

- all intended physical items have valid mappings
- unresolved exceptions are documented
- synchronization is observable
- reconciliation is operational
- staff permissions are verified
- public data boundaries are verified
- audit trails are intact
- backups and recovery procedures are tested

## Open Decisions

The following decisions remain intentionally unresolved until the upgraded Card Ledger has been inspected and the staging architecture has been validated.

### Card Ledger

- Final Card Ledger database provider/project and topology
- Final Card Ledger schema and table relationships
- Authoritative physical-item identifier
- Card Ledger authentication and authorization model
- Staff roles and permissions
- Business vs personal ownership model
- Card Ledger lifecycle states and event model
- Card Ledger audit and retention model
- Card Ledger server-side functions/API boundaries
- Card Ledger media/storage architecture
- Card Ledger integration interface

### Store ↔ Ledger

- Final Store-to-Ledger physical-item mapping
- Exact synchronization direction for each shared field
- Authoritative owner for every synchronized field
- Publication eligibility rules
- Pricing synchronization contract
- Reservation/hold synchronization behavior
- Sale-recording transaction boundary
- Return-to-stock synchronization behavior
- Business/personal transfer workflow
- Idempotency/event model
- Retry and failure-handling strategy
- Conflict-resolution workflow
- Reconciliation implementation
- Cross-system audit schema

### SIDE QUEST HQ

- Final HQ database topology
- Whether HQ uses the Store database, Ledger database, a separate database, or a controlled combination
- HQ authentication architecture
- HQ role and permission matrix
- HQ-owned configuration and workflow data
- HQ reporting/analytics architecture
- HQ integration-health and reconciliation interface

### Migration

- Final migration/import strategy after Ledger audit
- Production cutover method
- Initial production inventory subset
- Rollback and recovery implementation
- Audit retention policy
- Backup and disaster-recovery requirements

### Decision Gate

No item above should be resolved by assumption.

Each decision should be supported by inspection of the upgraded Card Ledger, documented ownership rules, staging tests, and the production-readiness gate defined in Section I.

