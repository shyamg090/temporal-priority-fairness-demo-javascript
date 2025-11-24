# Quick Start Guide - Temporal Priority/Fairness JavaScript Demo

## 📋 Prerequisites

- **Node.js** 16+ 
- **Temporal Server** (Docker recommended)
- **tctl** CLI (for search attribute setup)

## 🚀 Quick Start (5 minutes)

### Step 1: Start Temporal Server
```bash
docker run -d -p 7233:7233 -p 8233:8233 \
  --name temporal-server \
  temporalio/auto-setup:latest
```

### Step 2: Register Search Attributes
```bash
cd temporal-priority-javascript/server
chmod +x setup-search-attributes.sh
./setup-search-attributes.sh
```

### Step 3: Install Dependencies & Start Worker
```bash
npm install
npm run worker
# Keep this terminal open
```

### Step 4: Start the Express Server (New Terminal)
```bash
cd temporal-priority-javascript/server
npm run dev
```

You should see:
```
Server running on port 8080
API endpoints:
  POST /start-workflows - Start workflows
  GET /run-status?runPrefix=<prefix> - Get priority mode results
  GET /run-status-fairness?runPrefix=<prefix> - Get fairness mode results
```

### Step 5: Start the React UI (New Terminal - Optional)
```bash
cd temporal-priority-javascript/ui
npm install
npm run dev
```

Open http://localhost:5173 in your browser

## 📡 Test the API

### Test Priority Mode
```bash
# Start workflows
curl -X POST http://localhost:8080/start-workflows \
  -H "Content-Type: application/json" \
  -d '{
    "workflowIdPrefix": "priority-test-1",
    "numberOfWorkflows": 50,
    "mode": "priority"
  }'

# Wait 30 seconds, then check results
curl "http://localhost:8080/run-status?runPrefix=priority-test-1" | jq .
```

### Test Fairness Mode
```bash
# Start workflows with fairness bands
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

# Wait 30 seconds, then check results
curl "http://localhost:8080/run-status-fairness?runPrefix=fairness-test-1" | jq .
```

## 📁 Project Structure

```
temporal-priority-javascript/
├── server/                    # Node.js Express backend
│   ├── src/
│   │   ├── index.js          # Express server + API
│   │   ├── models.js         # Data models
│   │   ├── workflows.js      # Workflow definitions
│   │   ├── activities.js     # Activity implementations
│   │   ├── worker.js         # Worker setup
│   │   └── temporalClient.js # Temporal client
│   ├── package.json
│   ├── README.md
│   └── setup-search-attributes.sh
│
└── ui/                       # React TypeScript frontend
    ├── src/
    ├── package.json
    └── vite.config.js
```

## 🔧 Configuration

### Change Temporal Server Address
Edit `src/temporalClient.js` and `src/worker.js`:
```javascript
address: 'your-server:7233'
```

### Change API Port
```bash
PORT=3000 npm run dev
```

## 🐛 Troubleshooting

| Error | Solution |
|-------|----------|
| Connection refused | Start Temporal Server: `docker run -d -p 7233:7233 -p 8233:8233 temporalio/auto-setup:latest` |
| Search attribute not found | Run `./setup-search-attributes.sh` |
| Workflows not executing | Check worker is running in another terminal: `npm run worker` |
| CORS errors | Server has CORS enabled, ensure UI uses `http://localhost:8080` |

## 📊 Understanding Results

### Priority Mode Results
Shows activity completion rates by priority level (1-5):
- Priority 1 = Highest priority (completes more activities)
- Priority 5 = Lowest priority (completes fewer activities)

### Fairness Mode Results
Shows activity completion rates by fairness band:
- Higher weight bands get fair share of resources
- Demonstrates even distribution regardless of submission order

## 🎯 What's Happening

1. **Workflows start** with initial search attributes (Priority or FairnessKey + FairnessWeight)
2. **Activities execute** in 5 steps with 300ms delay each
3. **Search attributes update** as activities complete (ActivitiesCompleted)
4. **Results aggregate** workflow execution metrics by priority/fairness

## 📚 Next Steps

- Modify `numberOfWorkflows` to test scalability
- Adjust `bands` weights in fairness mode
- Set `disableFairness: true` to see the difference
- Check Temporal UI: http://localhost:8233

---

For detailed documentation, see [README.md](./README.md)
