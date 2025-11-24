import express from 'express';
import cors from 'cors';
import { getTemporalClient } from './temporalClient.js';
import {
  WorkflowConfig,
  Band,
  PriorityWorkflowData,
  FairnessWorkflowData,
  PriorityTestRunResults,
  FairnessTestRunResults,
} from './models.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Helper functions (matching Java implementation exactly)
function getStartDelay(targetStart) {
  const now = new Date();
  const delay = targetStart - now;
  // Guard against negative durations if target time has already passed
  return delay > 0 ? Math.floor(delay / 1000) : 0; // Convert ms to seconds
}

function getTargetWFStartTime(numWFInstancesToStart) {
  const currentTime = new Date();
  // Assume ~50ms to start each WF instance + 5s buffer
  // Examples: 100 WFs -> ~10s, 300 WFs -> ~20s, 570 WFs -> ~33.5s
  const secsToStartAll = numWFInstancesToStart * 0.05 + 5;
  return new Date(currentTime.getTime() + secsToStartAll * 1000);
}

function getTargetWFStartTimeFairness(numWFInstancesToStart) {
  const currentTime = new Date();
  // Fairness runs: 7s floor, 30s cap. Scale so 200 -> ~15s and 300 -> ~30s
  // Linear core: ceil(0.15 * N - 15), then clamp to [7, 30]
  // Examples: 100 -> 7s (floor), 200 -> 15s, 300 -> 30s, 440 -> 30s (cap)
  const scaled = Math.ceil(0.15 * numWFInstancesToStart - 15.0);
  const secsToStartAll = Math.min(30, Math.max(7, scaled));
  return new Date(currentTime.getTime() + secsToStartAll * 1000);
}

/**
 * POST /start-workflows - Start workflows with configuration
 * Uses config object to define workflow names and numbers to start.
 * Calculates a delay to the start time so all workflows start at approximately the same time.
 */
app.post('/start-workflows', async (req, res) => {
  try {
    let wfConfig = req.body;

    // Apply defaults if config is null or missing
    if (!wfConfig) {
      wfConfig = new WorkflowConfig();
      wfConfig.numberOfWorkflows = 100;
      wfConfig.workflowIdPrefix = 'Testing';
    }

    const client = await getTemporalClient();
    const mode = (wfConfig.mode || 'priority').toLowerCase().trim();
    let startTime;

    // console.log(`Starting workflows in ${mode} mode with prefix: ${wfConfig.workflowIdPrefix}`);

    if (mode !== 'fairness') {
      // Priority mode (default)
      startTime = getTargetWFStartTime(wfConfig.numberOfWorkflows);

      // Divide workflows equally across 5 priority levels
      const workflowsPerPriority = Math.ceil(wfConfig.numberOfWorkflows / 5);

      for (let workflowNum = 1; workflowNum <= wfConfig.numberOfWorkflows; workflowNum++) {
        // Assign priority based on which group the workflow falls into
        // Priority 1: workflows 1 to workflowsPerPriority
        // Priority 2: workflows (workflowsPerPriority+1) to (2*workflowsPerPriority)
        // etc.
        const priority = Math.min(5, Math.ceil(workflowNum / workflowsPerPriority));
        const workflowData = new PriorityWorkflowData(priority);
        const workflowId = `${wfConfig.workflowIdPrefix}-${workflowNum}`;
        const delayMs = getStartDelay(startTime) * 1000;

        console.debug(
          `Starting priority workflow ${wfConfig.workflowIdPrefix}-${workflowNum} with priority ${priority}`
        );

        try {
          await client.workflow.start('priorityWorkflow', {
            args: [workflowData],
            taskQueue: 'priority-queue',
            workflowId,
            startDelay: delayMs,
            searchAttributes: {
              Priority: [priority],
              ActivitiesCompleted: [0],
            },
            priority: {
              priorityKey: priority,
            }
          });
        } catch (err) {
          console.error(`Failed to start workflow ${workflowId}:`, err.message);
        }
      }
    } else {
      // Fairness mode
      let bands = wfConfig.bands;

      // Use default bands if not provided
      if (!bands || bands.length === 0) {
        bands = [
          new Band('first-class', 15),
          new Band('business-class', 5),
          new Band('economy-class', 1),
        ];
      }

      // Determine if explicit counts were provided
      const hasCounts = bands.some((b) => b.count != null && b.count > 0);
      let totalWF = wfConfig.numberOfWorkflows;

      if (hasCounts) {
        totalWF = bands.reduce((sum, b) => sum + (b.count || 0), 0);
      }

      // Use fairness-specific start delay calculation
      startTime = getTargetWFStartTimeFairness(totalWF);
      const disableFairness = wfConfig.disableFairness || false;

      if (hasCounts) {
        // Build flat list of band entries according to their counts, then shuffle to randomize submission order
        const submissionOrder = [];
        for (const band of bands) {
          const count = band.count || 0;
          for (let i = 0; i < count; i++) {
            submissionOrder.push(band);
          }
        }


        // Fisher-Yates shuffle
        for (let i = submissionOrder.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [submissionOrder[i], submissionOrder[j]] = [submissionOrder[j], submissionOrder[i]];
        }


        let workflowNum = 1;
        for (const band of submissionOrder) {
          const workflowData = new FairnessWorkflowData(
            band.key,
            band.weight,
            disableFairness
          );
          const workflowId = `${wfConfig.workflowIdPrefix}-${workflowNum}`;
          const delayMs = getStartDelay(startTime) * 1000;

          // console.debug(
          //   `Starting fairness workflow ${wfConfig.workflowIdPrefix}-${workflowNum} [${band.key}:${band.weight}]`
          // );

          try {
            await client.workflow.start('fairnessWorkflow', {
              args: [workflowData],
              taskQueue: 'fairness-queue',
              workflowId,
              startDelay: delayMs,
              priority: {
                FairnessKey: band.key,
                FairnessWeight: disableFairness ? 0 : band.weight,
              },
              searchAttributes: {
                FairnessKey: [band.key],
                FairnessWeight: [disableFairness ? 0 : band.weight],
                ActivitiesCompleted: [0.0],
              },
            });
          } catch (err) {
            console.error(`Failed to start workflow ${workflowId}:`, err.message);
          }

          workflowNum++;
        }
      } else {
        // Distribute workflows across bands without explicit counts
        for (let workflowNum = 1; workflowNum <= wfConfig.numberOfWorkflows; workflowNum++) {
          const band = bands[(workflowNum - 1) % bands.length];

          const workflowData = new FairnessWorkflowData(
            band.key,
            band.weight,
            disableFairness
          );
          const workflowId = `${wfConfig.workflowIdPrefix}-${workflowNum}`;
          const delayMs = getStartDelay(startTime) * 1000;

          console.debug(
            `Starting fairness workflow ${wfConfig.workflowIdPrefix}-${workflowNum} [${band.key}:${band.weight}]`
          );

          try {
            await client.workflow.start('fairnessWorkflow', {
              args: [workflowData],
              taskQueue: 'fairness-queue',
              workflowId,
              startDelay: delayMs,
              priority: {
                FairnessKey: band.key,
                FairnessWeight: disableFairness ? 0 : band.weight,
              },
              searchAttributes: {
                FairnessKey: [band.key],
                FairnessWeight: [disableFairness ? 0 : band.weight],
                ActivitiesCompleted: [0],
              },
            });
          } catch (err) {
            console.error(`Failed to start workflow ${workflowId}:`, err.message);
          }
        }
      }
    }

    res.json({ status: 'Done' });
  } catch (error) {
    console.error('Error starting workflows:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /run-status - Get priority mode test results
 * Lists all workflows with the given prefix and aggregates results by priority
 */
app.get('/run-status', async (req, res) => {
  try {
    const runPrefix = req.query.runPrefix;
    if (!runPrefix) {
      return res.status(400).json({ error: 'runPrefix query parameter required' });
    }

    const client = await getTemporalClient();
    const executions = [];

    // console.log(`Fetching priority mode results for prefix: ${runPrefix}`);

    // List all executions and filter by prefix (matching Java client.listExecutions)
    try {
      for await (const execution of client.workflow.list()) {
        try {
          // Log the structure to understand the actual format
          if (executions.length === 0) {
            // console.log('First execution object keys:', Object.keys(execution));
            // console.log('First execution object:', JSON.stringify(execution, null, 2).substring(0, 500));
          }

          // Handle both possible structures:
          // Structure 1: execution.execution.workflowId (nested)
          // Structure 2: execution.workflowId (direct)
          let workflowId;
          if (execution.execution && execution.execution.workflowId) {
            workflowId = execution.execution.workflowId;
          } else if (execution.workflowId) {
            workflowId = execution.workflowId;
          }

          if (workflowId && workflowId.startsWith(runPrefix)) {
            executions.push({
              execution: execution.execution || execution,
              status: execution.status,
              searchAttributes: execution.searchAttributes,
              typedSearchAttributes: execution.searchAttributes,
            });
          }
        } catch (itemErr) {
          console.warn('Error processing individual execution:', itemErr.message);
          // Continue to next execution
        }
      }
    } catch (listErr) {
      console.error('Error listing executions:', listErr.message);
      console.error('Stack:', listErr.stack);
    }

    // console.log(`Found ${executions.length} workflows for prefix: ${runPrefix}`);

    // Aggregate results using PriorityTestRunResults
    const results = new PriorityTestRunResults(executions);
    res.json(results);
  } catch (error) {
    console.error('Error getting run status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /run-status-fairness - Get fairness mode test results
 * Lists all workflows with the given prefix and aggregates results by fairness key/weight
 */
app.get('/run-status-fairness', async (req, res) => {
  try {
    const runPrefix = req.query.runPrefix;
    if (!runPrefix) {
      return res.status(400).json({ error: 'runPrefix query parameter required' });
    }

    const client = await getTemporalClient();
    const executions = [];

    // console.log(`Fetching fairness mode results for prefix: ${runPrefix}`);

    // List all executions and filter by prefix
    try {
      for await (const execution of client.workflow.list()) {
        try {
          // Log the structure to understand the actual format
          if (executions.length === 0) {
            // console.log('First execution object keys:', Object.keys(execution));
            // console.log('First execution object:', JSON.stringify(execution, null, 2).substring(0, 500));
          }

          // Handle both possible structures:
          // Structure 1: execution.execution.workflowId (nested)
          // Structure 2: execution.workflowId (direct)
          let workflowId;
          if (execution.execution && execution.execution.workflowId) {
            workflowId = execution.execution.workflowId;
          } else if (execution.workflowId) {
            workflowId = execution.workflowId;
          }

          if (workflowId && workflowId.startsWith(runPrefix)) {
            // console.log(`Found workflow: ${workflowId}`);
            // console.log(`Search attributes type: ${typeof execution.searchAttributes}`);
            // console.log(`Search attributes:`, JSON.stringify(execution.searchAttributes, null, 2));

            executions.push({
              execution: execution.execution || execution,
              status: execution.status,
              searchAttributes: execution.searchAttributes,
              typedSearchAttributes: execution.searchAttributes,
            });
          }
        } catch (itemErr) {
          console.warn('Error processing individual execution:', itemErr.message);
          // Continue to next execution
        }
      }
    } catch (listErr) {
      console.error('Error listing executions:', listErr.message);
      console.error('Stack:', listErr.stack);
    }

    // console.log(`Found ${executions.length} workflows for prefix: ${runPrefix}`);

    // Aggregate results using FairnessTestRunResults
    const results = new FairnessTestRunResults(executions);
    res.json(results);
  } catch (error) {
    console.error('Error getting run status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`\nAPI Endpoints:`);
  console.log(`  POST /start-workflows`);
  console.log(`    - Start workflows in priority or fairness mode`);
  console.log(`  GET /run-status?runPrefix=<prefix>`);
  console.log(`    - Get priority mode results`);
  console.log(`  GET /run-status-fairness?runPrefix=<prefix>`);
  console.log(`    - Get fairness mode results`);
  console.log(`  GET /health`);
  console.log(`    - Health check`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});
