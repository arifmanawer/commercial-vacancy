# commercial-vacancy

## testing


# Project Scope
## Overview
This project is a web-based property management platform designed to streamline communication and task handling between renters, landlords, and contractors. The system provides role-based access, allowing each user type to interact with features specific to their responsibilities while maintaining a clear and efficient workflow.

The primary goal of the project is to create a functional and realistic Minimum Viable Product (MVP) that solves an NYC specific problem of how to make effective and practical use of vacant commercial buildings. In addition, demonstrating full-stack development concepts, including frontend interfaces, backend logic, and database design.

## Objectives
* Provide a centralized platform for managing rental properties and maintenance requests
* Support multiple user roles with distinct permissions and dashboards
* Simplify maintenance request submission, tracking, and assignment to contractors
* Demonstrate practical software engineering practices such as modular design and version control

## User Roles
* Renter
  * Registers and logs into the system
  * Views assigned rental property information
  * Submits maintenance/service requests
  * Views the status of submitted requests
* Landlord
  * Registers and logs into the system
  * Creates and manages property listings
  * Views maintenance/service requests for owned properties
  * Assigns requests to contractors
* Contractor
  * Registers and logs into the system
  * Creates and manages a contractor profile
  * Views assigned jobs
  * Updates job status

## Core Features (MVP)
* Authentication and Authorization
  * User sign-up and sign-in
  * Secure password handling
  * Role-based access control
* Property Management
  * Landlords can add, edit, and view properties
  * Properties are associated with renters and maintenance requests
* Service Request Workflow
  * Renters submit service requests
  * Landlords review and assign requests
  * Contractors update job progress and completion status
* Dashboards
  * Role-specific dashboards for renters, landlords, and contractors
  * Centralized view of relevant actions and data for each role

## Stretch Features
* File uploads for maintenance request images
* Searching and filtering for contractors
* Email notifications for status updates
* Integration of city or public data for property information

## Out of Scope
The following features are explicitly excluded from the current project scope to ensure feasibility of our MVP:
* Real-time chat or messaging
* Mobile application development
* Advanced analytics or AI-driven recommendations

## Assumptions and Constraints
* The system will be developed as a web application
* Users access the platform through a modern web browser
* The project timeline is limited to the academic semester

## Success Criteria
* All three user roles can authenticate and access their dashboards
* Core workflows function correctly end-to-end
* Data is stored and retrieved securely from the database
* The application is stable, usable, and well-documented
