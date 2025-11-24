import * as activities from './activities.js';
import { NativeConnection, Worker } from "@temporalio/worker";

/**
 * Run Temporal workers for both queues
 */
async function runWorker() {
  try {
    console.log('Initializing Temporal Worker...');

    // ✅ Establish a single NativeConnection instance
    const connection = await NativeConnection.connect({
      address: 'localhost:7233', // Temporal server address
    });

    // ✅ Create the priority worker
    const priorityWorker = await Worker.create({
      connection, // must be the NativeConnection instance
      namespace: 'default',
      taskQueue: 'priority-queue',
      workflowsPath: new URL('./workflows.js', import.meta.url).pathname,
      activities: {
        runPriorityActivity: activities.runPriorityActivity,
      },
    });

    console.log('✅ Priority Worker created for task queue: priority-queue');

    // ✅ Create the fairness worker
    const fairnessWorker = await Worker.create({
      connection,
      namespace: 'default',
      taskQueue: 'fairness-queue',
      workflowsPath: new URL('./workflows.js', import.meta.url).pathname,
      activities: {
        runFairnessActivity: activities.runFairnessActivity,
      },
    });

    console.log('✅ Fairness Worker created for task queue: fairness-queue');

    console.log('🚀 Starting both workers...');
    await Promise.all([priorityWorker.run(), fairnessWorker.run()]);
  } catch (err) {
    console.error('❌ Worker failed:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down worker');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down worker');
  process.exit(0);
});

// ✅ Start the worker
runWorker().catch((err) => {
  console.error('Failed to start worker:', err);
  process.exit(1);
});
