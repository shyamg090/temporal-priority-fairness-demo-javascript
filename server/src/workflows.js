import { proxyActivities, upsertSearchAttributes } from '@temporalio/workflow';
import { PriorityActivityData, FairnessActivityData } from './models.js';

// Activity stubs - these will be resolved at runtime
const { runPriorityActivity } = proxyActivities({
  startToCloseTimeout: '5s',
  retryPolicy: {
    initialInterval: '1s',
    backoffCoefficient: 2.0,
    maximumAttempts: 3,
  },
});

const { runFairnessActivity } = proxyActivities({
  startToCloseTimeout: '5s',
  retryPolicy: {
    initialInterval: '1s',
    backoffCoefficient: 2.0,
    maximumAttempts: 3,
  },
});

/**
 * Priority Workflow - executes 5 activities sequentially with priority handling
 * Activities are scheduled by Temporal based on priority level
 */
export async function priorityWorkflow(pData) {
  // Initialize activity data with priority
  let activityData = new PriorityActivityData(pData.priority);

  // Execute 5 activity steps sequentially
  for (let counter = 1; counter <= 5; counter++) {
    activityData.stepNumber = counter;
    
    // Call activity and get updated data with results
    activityData = await runPriorityActivity(activityData);

    // Update workflow search attributes to track progress
    // This allows monitoring activity completion status
    await upsertSearchAttributes({
      ActivitiesCompleted: [counter],
    });
  }

  return 'Complete';
}

/**
 * Fairness Workflow - executes 5 activities sequentially with fairness key/weight
 * Activities are scheduled fairly across different fairness bands
 */
export async function fairnessWorkflow(data) {
  // Initialize activity data with fairness key and weight
  let activityData = new FairnessActivityData(data.fairnessKey, data.fairnessWeight);

  // Execute 5 activity steps sequentially
  for (let counter = 1; counter <= 5; counter++) {
    activityData.stepNumber = counter;
    
    // Call activity and get updated data with results
    activityData = await runFairnessActivity(activityData);

    // Update workflow search attributes to track progress
    // This allows monitoring activity completion status
    await upsertSearchAttributes({
      ActivitiesCompleted: [counter],
    });
  }

  return 'Complete';
}
