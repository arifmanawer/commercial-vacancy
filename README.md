# commercial-vacancy

## Running with Docker

Run the entire application (frontend + backend) with a single command. Requires only **Docker** and **Git**—no Node.js or npm needed.

### Start the application

```bash
docker compose up --build
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

### Stop the application

```bash
docker compose down
```

Hot reload is enabled for both services—edit the code and changes will apply automatically.

---

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

## Assumptions and Constraints
* The system will be developed as a web application
* Users access the platform through a modern web browser
* The project timeline is limited to the academic semester

## Success Criteria
* All three user roles can authenticate and access their dashboards
* Core workflows function correctly end-to-end
* Data is stored and retrieved securely from the database
* The application is stable, usable, and well-documented

## Data Flow

### Property Search
1. User searches for available properties
1. Platform retrieves listings from property database
1. Nearby services and transit data retrieved from APIs
1. Results displayed to user

### Property Listing
1. Landlord submits property listing
1. Listing is validated and stored in database
1. Confirmation returned to landlord

### Order & Payment Processing
1. Renter submits payment information
1. Payment system processes transaction
1. Order confirmation returned to renter and landlord

## Tech Stack

### Frontend
* Next.js
* React.js
* Tailwind CSS

### Backend
* Laravel
* Node.js
* Express.js

### Database
* Supabase - PostgreSQL

### Data Sources
* NYC Open Data
* Google Maps API
* Location Insights API

### Deployment
*  Vercel
*  Render
