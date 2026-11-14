# KRENOX
## FINAL PRODUCT DOCUMENTATION

### Design and Implementation of a Configurable Virtual Queue Management System for Reducing Waiting Time in High-Traffic Service with Simulation-Based Evaluation of Waiting-Time Reduction

**Project:** Krenox  
**Student:** Besong Wisdom  
**Programme:** B.Tech. in Computer Engineering (Software Engineering)  
**Institution:** University of Buea  
**Academic Year:** 2026/2027  
**Document Type:** Final Product Description and Technical Documentation

---

# 1. INTRODUCTION

## 1.1 Product Overview

Krenox is a configurable virtual queue management system designed to improve the way organisations manage customer queues in high-traffic service environments.

Traditional queue management often requires customers to remain physically present at service locations while waiting for their turns. This can contribute to overcrowding, inconvenience, inefficient use of time, and difficulties in monitoring queue activities.

Krenox provides a digital alternative by allowing customers to join queues remotely through a web interface or QR code, receive digital tickets, and monitor their queue progress. Organisations can configure their facilities, services, service desks, and staff accounts while managing queue operations through dedicated administrative and staff interfaces.

The platform is designed to support multiple independent organisations rather than being restricted to a single institution. Its configurable architecture allows different service environments to use the same platform while maintaining separate operational data.

In addition to the queue management application, Krenox incorporates a simulation-based evaluation component. This component is intended to model queue operations under controlled conditions and compare conventional queue management with the proposed virtual queue approach using measurable performance indicators.

## 1.2 Product Purpose

The purpose of Krenox is to provide an accessible and configurable approach to queue management that:

- Reduces the need for customers to remain physically in queues.
- Improves visibility into queue progress.
- Provides staff with tools for managing customer flow.
- Supports different organisations and service environments.
- Provides information that helps customers make better decisions while waiting.
- Enables the evaluation of queue performance through simulation.

## 1.3 Intended Users

Krenox is designed for the following user groups:

**Customers:** Individuals who need services from an organisation and want to join and monitor queues digitally.

**Service Staff:** Employees responsible for processing customer tickets and providing services.

**Organisation Administrators:** Individuals responsible for configuring facilities, services, staff, and queue operations.

**Platform Administrators:** Individuals responsible for managing the overall platform.

**Researchers and Evaluators:** Individuals responsible for configuring simulation experiments and analysing queue-performance results.

# 2. PRODUCT STRUCTURE

Krenox is organised around two major functional components.

## 2.1 Virtual Queue Management Platform

This is the primary application through which organisations configure and operate digital queues.

Its main capabilities include:

- Organisation registration and management.
- Facility and branch management.
- Service and service-desk configuration.
- Customer queue registration.
- Digital ticket generation.
- Queue-position monitoring.
- Estimated waiting-time information.
- Staff queue operations.
- Administrative monitoring.
- Customer notifications where supported.

## 2.2 Simulation and Evaluation Component

This component supports the experimental evaluation of the queue-management approach.

It provides a controlled environment in which customer arrivals, service times, service counters, and queue operations can be modelled.

The component supports the comparison of conventional queue management and Krenox virtual queue management using performance indicators such as average waiting time, maximum waiting time, average queue length, throughput, and counter utilisation.

# 3. SYSTEM USERS AND FUNCTIONAL AREAS

## 3.1 Customer Module

The customer module provides the public interface for accessing services and joining queues.

A customer can:

1. Open an organisation's queue page using a web link or QR code.
2. Select an available facility or service.
3. Join an open queue.
4. Receive a digital ticket.
5. View the ticket reference and queue position.
6. Monitor queue progress and estimated waiting time.
7. Receive relevant notifications where supported.
8. Cancel an active ticket when necessary.

The customer interface is intended to be accessible through modern web browsers without requiring the installation of a dedicated mobile application.

## 3.2 Staff Module

The staff module provides authorised personnel with tools for processing customers.

Its functions include:

- Viewing assigned queues.
- Calling the next eligible ticket.
- Starting customer service.
- Completing service.
- Marking tickets as absent or skipped.
- Managing permitted ticket-status changes.
- Viewing current queue information.

These operations help staff maintain an organised service process and ensure that queue information is updated as customers are served.

## 3.3 Organisation Administration Module

The organisation administration module allows institutions to configure their operational environment.

An organisation administrator can manage:

- Organisation profile and settings.
- Multiple facilities or branches.
- Services offered at each facility.
- Service desks and counters.
- Staff accounts and assignments.
- Queue availability and configuration.
- Public queue access links and QR codes.
- Basic operational information.

Each organisation operates within its own data boundary.

## 3.4 Platform Administration Module

The platform administration module is intended for managing the overall Krenox environment.

Depending on the implemented administrative scope, this may include organisation management, platform-level settings, and monitoring of platform activity.

Platform-level access must be restricted to appropriately authorised administrators.

# 4. HOW THE SYSTEM WORKS

## 4.1 Organisation Setup

An organisation registers on the platform and establishes its organisational profile.

The administrator configures the organisation's facilities, creates services, establishes service desks, and assigns staff members.

The system provides public access links or QR codes for customers to access the relevant queue entry points.

## 4.2 Customer Queue Registration

A customer accesses the appropriate public queue page using a web link or QR code.

The customer selects the required service and submits a queue registration request.

The system validates the request, confirms that the queue is available, and creates a ticket.

A successful registration provides the customer with a ticket reference and relevant queue information.

## 4.3 Queue Processing

When a service desk becomes available, authorised staff members access their assigned queue and call the next eligible ticket.

The selected ticket moves through the supported queue lifecycle.

Typical ticket states include:

- Waiting
- Called
- Serving
- Completed
- Skipped
- Absent
- Cancelled

The exact transitions are controlled by the queue rules and the permissions assigned to staff.

## 4.4 Customer Queue Monitoring

Customers can access their ticket information to monitor queue progress.

The system provides queue-position information and an estimated waiting time where sufficient information is available.

Queue information is updated as relevant ticket operations occur.

Notifications may be used to inform customers when important queue events occur, depending on the available communication integrations.

## 4.5 Queue Completion

After a customer receives the requested service, the staff member marks the ticket as completed.

The system records the relevant queue event and updates the active queue information.

This information can contribute to operational monitoring and performance analysis.

# 5. CONFIGURABLE MULTI-ORGANISATION ARCHITECTURE

A central characteristic of Krenox is its ability to support different organisations through a shared application.

The platform follows a hierarchical organisational structure:

**Platform → Organisation → Facility → Service → Service Desk → Queue Operations**

An organisation may operate multiple facilities, and each facility may offer multiple services.

For example, a university may configure separate bursary, registration, and student-support facilities. A hospital may configure registration, laboratory, and consultation services.

Although these organisations use the same platform, their operational records and access permissions must remain separate.

The system uses organisational and facility context to determine which services, queues, tickets, and staff operations are accessible to each user.

The multi-organisation design is intended to make Krenox adaptable to different service environments without requiring a separate application for every institution.

# 6. QUEUE MANAGEMENT AND WAITING-TIME ESTIMATION

## 6.1 Queue Management

Krenox manages customers through digital tickets associated with configured services and facilities.

Each ticket represents a customer's position in the relevant queue and contains information required for its processing.

Queue operations are validated to ensure that tickets are handled within their correct organisational and facility context.

## 6.2 Waiting-Time Estimation

The system may estimate a customer's waiting time using available queue information.

Relevant factors may include:

- Number of customers ahead.
- Number of available service counters.
- Historical or observed service durations.
- Current queue activity.
- Changes in service availability.

Estimated waiting time is a prediction and should not be treated as a guaranteed service-start time.

## 6.3 Queue Notifications

Where supported, Krenox can communicate important queue events to customers through available notification channels.

WhatsApp integration may be used to provide queue updates and reminders.

Notification delivery depends on the availability and configuration of the selected messaging service.

A notification failure should not invalidate a successfully created ticket or interrupt the underlying queue-processing operation.

# 7. SIMULATION-BASED EVALUATION

## 7.1 Purpose

The simulation component evaluates the performance of Krenox by comparing its virtual queue approach with a conventional queue-management approach under controlled experimental conditions.

The objective is to determine whether the proposed system produces measurable improvements in the selected waiting-time indicators.

## 7.2 Conventional Queue Scenario

In the conventional scenario, customers arrive at a service centre and join a physical queue.

Customers remain at the service location while waiting for available service counters.

Their service order follows the defined queue discipline.

## 7.3 Krenox Virtual Queue Scenario

In the proposed scenario, customers join a queue digitally and receive tickets.

They can monitor queue progress remotely and approach the service location when their turns are approaching.

The service counters continue processing customers according to the configured queue rules.

## 7.4 Simulation Parameters

The experiments may consider:

- Number of customers.
- Customer arrival patterns.
- Average customer arrival rate.
- Service-time assumptions.
- Number of service counters.
- Simulation duration.
- Queue discipline.
- Variability in customer arrival and service times.
- Customer call-ahead or notification assumptions where modelled.

The same relevant input conditions should be applied to both scenarios to support a meaningful comparison.

## 7.5 Performance Indicators

The evaluation considers the following indicators:

**Average Waiting Time:** Average time customers spend waiting between joining the queue and beginning service.

**Maximum Waiting Time:** The longest waiting period recorded among simulated customers.

**Average Queue Length:** Average number of customers waiting for service during the experiment.

**Throughput:** Number of customers served during the simulation period.

**Counter Utilisation:** Proportion of available service-counter time spent serving customers.

**Physical Waiting Time:** Time customers spend physically waiting at the service location, where represented by the simulation model.

**Waiting-Time Reduction:** Percentage difference between the baseline and proposed scenarios.

The percentage reduction is calculated as:

Waiting-Time Reduction (%) = ((Baseline Waiting Time - Proposed Waiting Time) / Baseline Waiting Time) × 100

The evaluation must clearly distinguish total waiting time from physical waiting time. Allowing customers to wait remotely can improve their experience without necessarily reducing the total time before service begins.

## 7.6 Interpretation of Results

Simulation results will be used to determine how queue performance changes under different operating conditions.

The results may demonstrate that the proposed approach improves certain performance indicators under particular conditions. They may also identify conditions where improvements are limited.

No fixed percentage reduction should be claimed without experimental evidence.

# 8. SYSTEM ARCHITECTURE AND TECHNOLOGIES

## 8.1 Application Architecture

Krenox follows a web-based application architecture consisting of:

1. Presentation layer.
2. Application and business-logic layer.
3. Data-storage layer.
4. Real-time communication and notification services.
5. Simulation and evaluation component.

The presentation layer provides interfaces for customers, staff, and administrators.

The application layer handles authentication, authorisation, queue operations, validation, and business rules.

The data layer stores organisational records, services, tickets, queue events, and other application information.

The simulation component supports experimental modelling and performance analysis.

## 8.2 Proposed Technology Stack

The following technologies form the intended implementation stack. The final technical report should reflect the versions and components actually used.

| Technology | Purpose |
|---|---|
| Next.js | Web application framework |
| React | User interface development |
| TypeScript | Application programming language |
| Tailwind CSS | Interface styling |
| Supabase | Backend platform and database services |
| PostgreSQL | Relational database |
| Supabase Auth | User authentication |
| Supabase Realtime | Live data communication |
| QR Code Technology | Public queue access |
| WhatsApp Integration | Optional customer notifications |
| Simulation Technology | Queue modelling and evaluation |

## 8.3 Database Organisation

The database is organised around the principal entities required by the application.

These include:

- Organisations
- Facilities
- Users
- Organisation memberships
- Services
- Service desks
- Queues
- Tickets
- Queue events
- Notification events
- Simulation experiments

Relationships between these entities support the multi-organisation architecture and maintain the association between tickets and their respective facilities and services.

# 9. SECURITY AND DATA PROTECTION

Security is important because Krenox is designed to serve multiple organisations using a shared platform.

The system is expected to apply the following controls:

- Authentication for authorised administrative and staff users.
- Role-based access control.
- Organisation and facility-level data separation.
- Server-side validation of queue operations.
- Validation of ticket and service ownership.
- Protection of sensitive credentials and application secrets.
- Secure communication between clients and backend services.
- Appropriate logging of important operational events.

The system must not rely solely on organisation or facility identifiers supplied through URLs or browser requests to determine access permissions.

The server must independently verify the authenticated user's permissions and the ownership of the affected resources.

# 10. SYSTEM LIMITATIONS

The system has several limitations that must be considered.

1. Access to online queue functionality depends on internet connectivity.
2. Estimated waiting times may change due to unexpected service delays.
3. Customer notifications depend on external communication services.
4. The effectiveness of the system depends partly on staff adoption and correct queue configuration.
5. Simulation results depend on the accuracy of the assumptions and parameters used.
6. Simulation results may not capture every aspect of real customer behaviour.
7. The initial prototype may not include every feature required for large-scale commercial deployment.

# 11. TESTING AND VALIDATION

The final product should be evaluated through several forms of testing.

## 11.1 Functional Testing

Verify that customers can join queues, receive tickets, and monitor progress, and that staff can process tickets correctly.

## 11.2 Integration Testing

Verify that the application's major components communicate correctly, including authentication, database operations, queue processing, and notification services where implemented.

## 11.3 Security Testing

Verify that users cannot perform unauthorised operations or access information belonging to other organisations.

## 11.4 Concurrency Testing

Verify that simultaneous queue registrations and staff operations do not result in duplicate ticket numbers, inconsistent queue states, or conflicting operations.

## 11.5 Simulation Validation

Verify that simulation inputs are processed correctly, event times are calculated consistently, and the selected performance indicators are computed accurately.

## 11.6 Usability Evaluation

Assess whether customers, staff, and administrators can understand and use their respective interfaces effectively.

# 12. EXPECTED PRODUCT OUTCOME

The completed Krenox product is intended to demonstrate a configurable virtual queue management platform that can support multiple organisations and service environments.

The product should provide customers with a convenient way to join and monitor queues digitally, while giving organisations tools to configure facilities, manage services, and process customer tickets.

The simulation and evaluation component should provide experimental evidence of how the proposed approach performs compared with conventional queue management under the selected conditions.

The overall outcome will be assessed through the implemented system, functional and security tests, and documented simulation results.

# 13. CONCLUSION

Krenox presents a configurable approach to managing queues in high-traffic service environments.

By combining digital queue registration, ticket processing, customer progress monitoring, organisational configuration, and simulation-based evaluation, the system addresses both the operational and analytical aspects of queue management.

Its multi-organisation architecture provides a foundation for adapting the platform to different institutions, while the simulation component provides a structured method for evaluating its performance.

This document describes the intended final product and provides a technical reference for understanding its architecture, modules, workflows, and evaluation approach. The final submitted version should be updated to reflect the features actually implemented, the technologies actually used, and the results obtained during testing and simulation.