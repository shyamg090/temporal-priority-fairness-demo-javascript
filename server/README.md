# Temporal Priority/Fairness Demo - JavaScript Server

A Node.js Express backend for the Temporal Priority/Fairness demonstration using the Temporal TypeScript SDK with JavaScript.

## Overview

This server demonstrates how Temporal's priority and fairness features work by:
- **Priority Mode**: Distributing workflows across 5 priority levels and measuring task completion rates
- **Fairness Mode**: Using fairness keys and weights to ensure fair resource distribution across different service classes

## Prerequisites

- **Node.js** 16+ and npm
- **Temporal Server** running locally on `localhost:7233` (default)
  - Docker: `docker run -d -p 7233:7233 -p 8233:8233 temporalio/auto-setup:latest`
  - Or follow [Temporal documentation](https://docs.temporal.io/self-hosted-guide/self-hosted-guide-setup)

## Setup

### 1. Install Dependencies

```bash
cd temporal-priority-javascript/server
npm install
npm run dev
```

### 2. Start Temporal Server (if not already running)

```bash
docker run -d -p 7233:7233 -p 8233:8233 temporalio/auto-setup:latest
```

### 3. Register Search Attributes

Before running workflows, register the custom search attributes:

```bash
# Using tctl (temporal CLI) - temporal-admin-tools cli exec
# Create Priority search attribute
temporal operator search-attribute create \
  --namespace default \
  --name Priority \
  --type Int

# Create FairnessKey search attribute
temporal operator search-attribute create \
  --namespace default \
  --name FairnessKey \
  --type Keyword

# Create FairnessWeight search attribute
temporal operator search-attribute create \
  --namespace default \
  --name FairnessWeight \
  --type Int

# Create ActivitiesCompleted search attribute
temporal operator search-attribute create \
  --namespace default \
  --name ActivitiesCompleted \
  --type Double
```

Or use the provided setup script:
```bash
./setup-search-attributes.sh
```

### 4. Start the Worker

In one terminal, start the Temporal worker:

```bash
npm run worker
```

You should see: `Worker started on task queue: priority-queue`

### 5. Start the Express Server

In another terminal, start the API server:

```bash
npm run dev
```

You should see:
```
Server running on port 8080
API endpoints:
  POST /start-workflows - Start workflows
  GET /run-status?runPrefix=<prefix> - Get priority mode results
  GET /run-status-fairness?runPrefix=<prefix> - Get fairness mode results
  GET /health - Health check
```

## API Endpoints

### POST /start-workflows

Starts a batch of workflows with the specified configuration.

**Request Body:**
```json
{
  "workflowIdPrefix": "MyTest",
  "numberOfWorkflows": 100,
  "mode": "priority",
  "disableFairness": false,
  "bands": null
}
```

**Parameters:**
- `workflowIdPrefix` (string): Prefix for workflow IDs (used to track test runs)
- `numberOfWorkflows` (number): Number of workflows to start (default: 100)
- `mode` (string): Either `"priority"` (default) or `"fairness"`
- `disableFairness` (boolean): For fairness mode, disable fairness priority (default: false)
- `bands` (array, optional): For fairness mode, define service classes:
  ```json
  {
    "bands": [
      {"key": "first-class", "weight": 15, "count": 30},
      {"key": "business-class", "weight": 5, "count": 50},
      {"key": "economy-class", "weight": 1, "count": 20}
    ]
  }
  ```

**Response:**
```json
{
  "status": "Done"
}
```

### GET /run-status

Get results for a priority mode test run.

**Query Parameters:**
- `runPrefix` (string, required): The workflow ID prefix used when starting workflows

**Response:**
```json
{
  "totalWorkflowsInTest": 100,
  "workflowsByPriority": [
    {
      "workflowPriority": 1,
      "numberOfWorkflows": 20,
      "activities": [
        {"activityNumber": 1, "numberCompleted": 19},
        {"activityNumber": 2, "numberCompleted": 18},
        ...
      ]
    },
    ...
  ]
}
```

### GET /run-status-fairness

Get results for a fairness mode test run.

**Query Parameters:**
- `runPrefix` (string, required): The workflow ID prefix used when starting workflows

**Response:**
```json
{
  "totalWorkflowsInTest": 100,
  "workflowsByFairness": [
    {
      "fairnessKey": "first-class",
      "fairnessWeight": 15,
      "numberOfWorkflows": 30,
      "activities": [
        {"activityNumber": 1, "numberCompleted": 30},
        {"activityNumber": 2, "numberCompleted": 30},
        ...
      ]
    },
    ...
  ]
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

## Example Usage with curl

### Start Priority Mode Test

```bash
curl -X POST http://localhost:8080/start-workflows \
  -H "Content-Type: application/json" \
  -d '{
    "workflowIdPrefix": "priority-test-1",
    "numberOfWorkflows": 50,
    "mode": "priority"
  }'
```

### Get Priority Mode Results

```bash
curl http://localhost:8080/run-status?runPrefix=priority-test-1
```

### Start Fairness Mode Test

```bash
curl -X POST http://localhost:8080/start-workflows \
  -H "Content-Type: application/json" \
  -d '{
    "workflowIdPrefix": "fairness-test-1",
    "numberOfWorkflows": 100,
    "mode": "fairness",
    "bands": [
      {"key": "first-class", "weight": 15, "count": 30},
      {"key": "business-class", "weight": 5, "count": 50},
      {"key": "economy-class", "weight": 1, "count": 20}
    ]
  }'
```

### Get Fairness Mode Results

```bash
curl http://localhost:8080/run-status-fairness?runPrefix=fairness-test-1
```

## Project Structure

```
server/
├── src/
│   ├── index.js              # Express server and API endpoints
│   ├── models.js             # Data models and result classes
│   ├── workflows.js          # Workflow definitions
│   ├── activities.js         # Activity implementations
│   ├── worker.js             # Temporal worker setup
│   └── temporalClient.js     # Temporal client initialization
├── package.json
└── README.md
```

## How It Works

### Priority Mode

1. Workflows are created with priorities 1-5 (cycling through workflows)
2. Each workflow executes 5 activities sequentially
3. The Temporal Server schedules activities based on priority
4. Results show activity completion rates by priority level

### Fairness Mode

1. Workflows are grouped into fairness bands (e.g., first-class, business-class, economy-class)
2. Each band has a fairness weight determining its share of resources
3. Activities are scheduled fairly across bands regardless of submission order
4. Results show activity completion rates by fairness band

## Troubleshooting

### "Connection refused" error
- Ensure Temporal Server is running on `localhost:7233`
- Check Docker: `docker ps | grep temporal`

### "Search attribute not found" error
- Register search attributes using tctl commands above
- Or wait a moment for them to sync

### Workflows not executing
- Ensure worker is running in another terminal
- Check worker logs for activity execution details

### CORS errors from UI
- Server already includes CORS middleware
- Ensure UI is making requests to `http://localhost:8080`

## Configuration

### Change Temporal Server Address

Edit `src/temporalClient.js` and `src/worker.js`:

```javascript
address: 'your-server.com:7233'
```

### Change Server Port

```bash
PORT=3000 npm run dev
```

### Change Task Queues

Edit `src/worker.js` and `src/index.js` to modify task queue names.

## Integration with UI

The server is designed to work with the React UI in `../ui/`:

1. Start the server: `npm run dev`
2. In another terminal, start the UI:
   ```bash
   cd ../ui
   npm install
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser

The UI will communicate with the API at `http://localhost:8080`.

## Development

### Enable Debug Logging

```bash
DEBUG=temporal npm run dev
```

### Run Individual Workflows

```bash
# Start a single priority workflow
curl -X POST http://localhost:8080/start-workflows \
  -H "Content-Type: application/json" \
  -d '{
    "workflowIdPrefix": "debug-test",
    "numberOfWorkflows": 1,
    "mode": "priority"
  }'
```

## License

ISC
