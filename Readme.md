# 🚀 Temporal Priority & Fairness Demonstration

A comprehensive demonstration of Temporal's **Priority Scheduling** and **Fairness** features using Node.js, Express, and React. This project showcases how Temporal manages workflow execution priorities and ensures fair resource distribution across different workload classes.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [How Temporal Works](#-how-temporal-works)
- [gRPC Communication Flow](#-grpc-communication-flow)
- [Project Structure](#-project-structure)
- [Setup Instructions](#-setup-instructions)
- [Features](#-features)
- [API Documentation](#-api-documentation)
- [Usage Examples](#-usage-examples)

---

## 🎯 Overview

This project demonstrates two key Temporal scheduling capabilities:

### 🔢 **Priority Mode**
Workflows are distributed across 5 priority levels (1-5, where 1 is highest priority). Temporal schedules higher-priority workflows first, ensuring critical tasks complete before lower-priority ones.

**Use Case**: Emergency orders (P1) should be processed before standard orders (P3-P5).

### ⚖️ **Fairness Mode**
Multiple tenant classes share worker capacity fairly based on weight ratios. Prevents resource starvation where one tenant monopolizes all workers.

**Use Case**: VIP customers (weight 20) receive more capacity than economy customers (weight 1), but economy still gets guaranteed processing.

---

## 🏗 Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌──────────────┐         ┌──────────────────────────────┐     │
│  │  React UI    │◄────────┤  Express API Server          │     │
│  │  (Port 5173) │         │  (Port 3001)                 │     │
│  └──────────────┘         │  - REST endpoints            │     │
│                           │  - Temporal client           │     │
│                           └────────────┬─────────────────┘     │
└────────────────────────────────────────┼───────────────────────┘
                                         │
                                         │ gRPC
                                         │
┌────────────────────────────────────────▼───────────────────────┐
│                    TEMPORAL SERVER                              │
│  ┌──────────────────────────────────────────────────────┐      │
│  │              Temporal Core Engine                     │      │
│  │  - Workflow Scheduler                                │      │
│  │  - Priority/Fairness Queue Manager                   │      │
│  │  - State Machine Manager                             │      │
│  │  - History Service                                   │      │
│  └─────────────────────┬────────────────────────────────┘      │
│                        │                                        │
│  ┌─────────────────────▼────────────────────────────────┐      │
│  │         PostgreSQL Database                          │      │
│  │  - Workflow execution history                        │      │
│  │  - Search attributes                                 │      │
│  │  - Task queue state                                  │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                 │
│  Temporal UI (Port 8080) - Monitoring & Debugging              │
└────────────────────────────────────┬───────────────────────────┘
                                     │
                                     │ gRPC Long Poll
                                     │
┌────────────────────────────────────▼───────────────────────────┐
│                      WORKER LAYER                               │
│  ┌──────────────────────────────────────────────────────┐      │
│  │           Temporal Worker Process                     │      │
│  │                                                       │      │
│  │  ┌──────────────────┐    ┌──────────────────┐       │      │
│  │  │ Priority Worker  │    │ Fairness Worker  │       │      │
│  │  │ Queue: priority- │    │ Queue: fairness- │       │      │
│  │  │       queue      │    │       queue      │       │      │
│  │  └────────┬─────────┘    └────────┬─────────┘       │      │
│  │           │                       │                  │      │
│  │           ├───────────────────────┤                  │      │
│  │           │                                          │      │
│  │  ┌────────▼──────────────────────────────────┐      │      │
│  │  │      Workflow Implementations             │      │      │
│  │  │  - priorityWorkflow()                     │      │      │
│  │  │  - fairnessWorkflow()                     │      │      │
│  │  └────────┬──────────────────────────────────┘      │      │
│  │           │                                          │      │
│  │  ┌────────▼──────────────────────────────────┐      │      │
│  │  │      Activity Implementations             │      │      │
│  │  │  - runPriorityActivity()                  │      │      │
│  │  │  - runFairnessActivity()                  │      │      │
│  │  └───────────────────────────────────────────┘      │      │
│  └──────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 How Temporal Works

### Workflow Execution Lifecycle

```
1. CLIENT STARTS WORKFLOW
   ├─ API sends gRPC request to Temporal Server
   ├─ Server creates workflow execution record in DB
   ├─ Server adds workflow task to task queue
   └─ Returns workflow ID to client

2. WORKER POLLS FOR TASKS
   ├─ Worker sends gRPC long poll request
   ├─ Server matches task to worker based on priority/fairness
   └─ Server returns workflow task to worker

3. WORKER EXECUTES WORKFLOW
   ├─ Worker runs workflow code (deterministic)
   ├─ Workflow schedules activities
   ├─ Worker reports events back to server via gRPC
   └─ Server persists events to history

4. ACTIVITY EXECUTION
   ├─ Server adds activity task to queue
   ├─ Worker polls and receives activity task
   ├─ Worker executes activity code (can be non-deterministic)
   ├─ Worker reports activity result via gRPC
   └─ Server updates workflow state

5. WORKFLOW COMPLETION
   ├─ Workflow completes after all activities
   ├─ Worker reports completion to server
   ├─ Server marks workflow as completed
   └─ Client can query final state
```

#### ⚙️ Terminal 2 – Backend Setup

```bash
cd server

# Install dependencies
npm install

# Register search attributes (one-time setup)
chmod +x setup-search-attributes.sh
./setup-search-attributes.sh

# Start API server
npm run dev
# API Server: http://localhost:3001
```

#### 🧵 Terminal 3 – Start Worker

```bash
cd server

# Start Temporal worker
npm run worker
# Worker polls from priority-queue and fairness-queue
```

#### 🎨 Optional: Start React UI

```bash
cd ui
npm install
npm run dev
# UI: http://localhost:5173
```

---

## ✨ Features

### Priority Mode
- ✅ Distributes workflows across 5 priority levels (1=highest, 5=lowest)
- ✅ Higher priority workflows complete first
- ✅ Visualize completion rates by priority level
- ✅ Real-time progress tracking via search attributes

### Fairness Mode
- ✅ Multiple tenant classes with configurable weights
- ✅ Fair capacity distribution (prevents starvation)
- ✅ Pre-configured scenarios (airline classes, service tiers)
- ✅ Compare fairness ON vs OFF

### General Features
- ✅ React UI with Material-UI components
- ✅ Real-time workflow monitoring
- ✅ Historical results visualization
- ✅ RESTful API for workflow management
- ✅ Docker Compose for easy setup

---

## 📡 API Documentation

### POST /start-workflows
Start a batch of workflows in priority or fairness mode.

**Request Body (Priority Mode):**
```json
{
  "workflowIdPrefix": "priority-test-1",
  "numberOfWorkflows": 100,
  "mode": "priority"
}
```

**Request Body (Fairness Mode):**
```json
{
  "workflowIdPrefix": "fairness-test-1",
  "numberOfWorkflows": 220,
  "mode": "fairness",
  "disableFairness": false,
  "bands": [
    { "key": "vip", "weight": 20, "count": 10 },
    { "key": "first-class", "weight": 10, "count": 20 },
    { "key": "business-class", "weight": 5, "count": 40 },
    { "key": "economy-class", "weight": 2, "count": 75 },
    { "key": "standby-list", "weight": 1, "count": 75 }
  ]
}
```

### GET /run-status?runPrefix=<prefix>
Get priority mode test results.

**Response:**
```json
{
  "totalWorkflows": 100,
  "completedWorkflows": 85,
  "priorityDistribution": {
    "1": { "total": 20, "completed": 20, "rate": 1.0 },
    "2": { "total": 20, "completed": 19, "rate": 0.95 },
    "3": { "total": 20, "completed": 18, "rate": 0.90 },
    "4": { "total": 20, "completed": 16, "rate": 0.80 },
    "5": { "total": 20, "completed": 12, "rate": 0.60 }
  }
}
```

### GET /run-status-fairness?runPrefix=<prefix>
Get fairness mode test results.

**Response:**
```json
{
  "totalWorkflows": 220,
  "fairnessBands": {
    "vip": { "count": 10, "completed": 9, "avgActivities": 4.5 },
    "first-class": { "count": 20, "completed": 18, "avgActivities": 4.2 },
    "business-class": { "count": 40, "completed": 35, "avgActivities": 3.8 }
  }
}
```

---

## 🎮 Usage Examples

### Example 1: Priority Test via API

```bash
# Start 100 workflows with priority scheduling
curl -X POST http://localhost:3001/start-workflows \
  -H "Content-Type: application/json" \
  -d '{
    "workflowIdPrefix": "test-241124",
    "numberOfWorkflows": 100,
    "mode": "priority"
  }'

# Wait 30 seconds, then check results
curl "http://localhost:3001/run-status?runPrefix=test-241124"
```

### Example 2: Fairness Test via UI

1. Open http://localhost:5173
2. Select "Fairness Mode"
3. Choose "Airline Classes" preset
4. Click "Start Workflow Test"
5. View results in real-time

### Example 3: Monitor via Temporal UI

1. Open http://localhost:8080
2. Navigate to Workflows
3. Filter by workflow ID prefix
4. View execution history and search attributes

---

## 📚 Additional Resources

- 📖 [Priority & Fairness Explained](server/PRIORITY_FAIRNESS_EXPLAINED.md)
- 🚀 [Quick Start Guide](server/QUICKSTART.md)
- 🔧 [Server Documentation](server/README.md)
- 📘 [Temporal Documentation](https://docs.temporal.io)

---

## 🤝 Contributing

This is a demonstration project. Feel free to fork and experiment!

---

## 📄 License

ISC
