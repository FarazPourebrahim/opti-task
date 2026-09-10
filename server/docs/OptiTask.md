# OptiTask — Intelligent Agile Task Management Platform (Backend Specification)

## Overview

OptiTask is a collaborative task management platform designed for Agile software teams. The system combines traditional project management capabilities with AI-assisted decision making to improve sprint planning, task assignment, and project execution.

The backend is responsible for user management, projects, teams, tasks, workflows, permissions, analytics, and integrations with external AI services.

AI capabilities are consumed as external services and include:

* Story point estimation
* Intelligent task assignment recommendations
* Sprint progress analysis
* AI Scrum Master insights and suggestions

The backend must expose all functionality through a GraphQL API.

---

# Technical Stack

## Backend

Technology:

* Node.js
* Express.js
* GraphQL API
* PostgreSQL database

Architecture principles:

* Feature-based modular architecture
* Repository pattern
* Service layer for business logic
* GraphQL resolvers separated from services
* Role-based authorization
* Strong typing across the entire application
* Transactional consistency for critical operations

---

# Core Concept

Organizations create projects.

Projects contain:

* Teams
* Members
* Sprints
* Tasks
* Epics
* Milestones

Users collaborate on tasks while AI services provide recommendations regarding estimation, assignment, and progress tracking.

The backend remains the source of truth for all project data, while AI systems operate as external advisors.

---

# User Roles

## Organization Owner

Can:

* Create organizations
* Manage billing and settings
* Create projects
* Manage organization members
* Assign project administrators

---

## Project Admin

Can:

* Manage project settings
* Create sprints
* Manage team members
* Configure workflows
* Manage roles and permissions
* View analytics and reports

---

## Team Member

Can:

* Create tasks
* Update assigned tasks
* Comment on work items
* Participate in sprints
* Request AI recommendations
* Track progress

---

## AI Agent (System Role)

The AI system acts as a service consumer and never directly modifies data without user approval.

AI-generated actions include:

* Story point suggestions
* Assignee recommendations
* Sprint health evaluations
* Risk analysis
* Progress predictions

All AI suggestions must be stored with metadata indicating:

* Confidence score
* Timestamp
* AI provider
* User approval status

---

# Organization Module

Organizations contain:

* Name
* Description
* Logo
* Members
* Projects
* Settings

Features:

* Organization invitations
* Membership management
* Role assignments
* Activity tracking

---

# User Module

User profiles include:

* Name
* Email
* Avatar
* Role
* Expertise tags
* Skills
* Seniority level
* Team memberships

System-generated metrics:

* Completed tasks
* Average task completion time
* Velocity
* Historical story points delivered
* Expertise confidence scores

---

# Project Module

Projects contain:

* Name
* Description
* Status
* Teams
* Sprints
* Milestones
* Backlogs
* Workflows

Project states:

* Planning
* Active
* Completed
* Archived

---

# Team Module

Teams include:

* Members
* Roles
* Responsibilities
* Expertise mappings

Each member stores:

* Primary role
* Technical skills
* Areas of expertise
* Historical assignments
* Workload metrics
* Availability status

These attributes are used by external AI services when recommending task assignments.

---

# Task Module

Tasks represent the primary work unit.

Task fields:

* Title
* Description
* Priority
* Status
* Story points
* Assignee
* Reporter
* Sprint
* Epic
* Labels
* Dependencies
* Due dates

Supported priorities:

* Lowest
* Low
* Medium
* High
* Critical

Supported statuses:

* Backlog
* Todo
* In Progress
* In Review
* Testing
* Done
* Blocked

Task capabilities:

* Assignment
* Reassignment
* Comments
* Attachments
* Activity logs
* Dependency management
* Time tracking
* Watchers
* Mentions

---

# Sprint Module

Sprints contain:

* Name
* Goal
* Start date
* End date
* Capacity
* Tasks

Sprint states:

* Planned
* Active
* Completed
* Cancelled

Metrics include:

* Velocity
* Completion rate
* Burndown information
* Remaining story points
* Team workload distribution

---

# Epic Module

Epics group related tasks.

Epics include:

* Name
* Description
* Progress percentage
* Related tasks
* Milestones

Capabilities:

* Progress aggregation
* Dependency visualization
* Completion tracking

---

# Comment & Activity Module

Users can:

* Comment on tasks
* Mention teammates
* Upload attachments
* Edit comments
* Resolve discussions

The system maintains immutable activity logs for:

* Task creation
* Status changes
* Assignments
* Story point updates
* Sprint movements
* AI recommendations
* User approvals

---

# Notification Module

Notifications include:

* Task assignments
* Mentions
* Sprint updates
* Deadline reminders
* AI recommendations
* Approval requests

Delivery channels:

* In-app notifications
* Email integration support

---

# AI Integration Module

The backend does not implement AI models.

Instead, it provides integration points for external AI services.

---

## Story Point Estimation

Users can request AI estimation for tasks.

Inputs:

* Task title
* Description
* Labels
* Historical project data
* Similar completed tasks

Outputs:

* Suggested story points
* Confidence score
* Reasoning metadata

Users may:

* Accept suggestions
* Reject suggestions
* Override suggestions manually

All decisions must be persisted.

---

## Intelligent Task Assignment

AI recommendations use:

* Task description
* Required skills
* Team member roles
* Expertise tags
* Historical assignments
* Current workload
* Sprint capacity
* Performance metrics

The backend must expose APIs to retrieve these datasets.

Assignment recommendations require explicit user approval before becoming effective.

---

## AI Scrum Master Features

The system supports AI-generated insights such as:

### Sprint Health Analysis

Examples:

* Overloaded team members
* Missed deadlines
* Risky sprint commitments
* Velocity deviations

### Progress Tracking

Examples:

* Completion forecasts
* Remaining effort estimates
* Delivery confidence scores
* Blocker identification

### Recommendations

Examples:

* Move tasks to future sprints
* Reassign overloaded members
* Split large work items
* Increase review capacity

The backend stores:

* Recommendation text
* Recommendation type
* Creation timestamp
* Approval status
* Resolution status

---

# Analytics Module

Project analytics include:

* Team velocity
* Story point trends
* Completion rates
* Sprint performance
* Task distribution
* Individual workloads

User analytics include:

* Average delivery time
* Historical assignments
* Expertise evolution
* Productivity metrics

---

# Authentication & Authorization

Authentication features:

* Registration
* Login
* Password management
* Session management
* JWT authentication

Authorization:

* Organization-level permissions
* Project-level permissions
* Team-level permissions
* Role-based access control

Roles:

* Organization Owner
* Project Admin
* Team Lead
* Team Member
* Viewer

---

# GraphQL API Requirements

The backend exposes a GraphQL API exclusively.

Requirements:

* Queries
* Mutations
* Subscriptions for real-time updates
* Strong schema typing
* Pagination support
* Filtering and sorting
* DataLoader pattern for N+1 prevention

GraphQL domains:

* Authentication
* Users
* Organizations
* Projects
* Teams
* Tasks
* Sprints
* Epics
* Comments
* Notifications
* Analytics
* AI Recommendations

---

# Database Requirements

Database:

* PostgreSQL

Key entities:

* Users
* Organizations
* Projects
* Teams
* TeamMembers
* Tasks
* Epics
* Sprints
* Comments
* Attachments
* Notifications
* ActivityLogs
* AIRecommendations
* UserExpertise
* UserStatistics

Important relationships:

* Organizations own Projects
* Projects contain Teams
* Teams contain Members
* Sprints contain Tasks
* Tasks belong to Epics
* Tasks can depend on other Tasks
* Users can follow and watch Tasks

---

# Main Backend Modules

## Authentication Module

Responsibilities:

* Registration
* Login
* Authorization
* Token management

---

## Organization Module

Responsibilities:

* Organizations
* Memberships
* Invitations

---

## User Module

Responsibilities:

* Profiles
* Expertise
* Statistics
* Performance metrics

---

## Project Module

Responsibilities:

* Projects
* Settings
* Permissions

---

## Team Module

Responsibilities:

* Teams
* Roles
* Capacity planning

---

## Task Module

Responsibilities:

* Task lifecycle
* Assignments
* Dependencies
* Tracking

---

## Sprint Module

Responsibilities:

* Sprint planning
* Velocity
* Burndown calculations

---

## Epic Module

Responsibilities:

* Work aggregation
* Progress monitoring

---

## Comment Module

Responsibilities:

* Discussions
* Mentions
* Activity history

---

## Notification Module

Responsibilities:

* Event delivery
* User alerts

---

## Analytics Module

Responsibilities:

* Reports
* Metrics
* Historical analysis

---

## AI Integration Module

Responsibilities:

* External AI communication
* Recommendation persistence
* User approvals
* AI metadata storage

---

# Goal

OptiTask aims to provide a robust backend foundation for an AI-powered Agile project management platform where intelligent recommendations enhance human decision making while preserving user control, transparency, and accountability.
