// import { ActivityFailure } from '@temporalio/activity';
// import { PriorityActivityData, FairnessActivityData } from './models.js';

// Activity implementations for Priority and Fairness modes

export async function runPriorityActivity(activityData) {
  // Simulate activity work with 300ms delay
  await sleep(300);
  
  // Add result entry
  const timestamp = new Date().toISOString();
  const resultMessage = `${timestamp} - Activity step [${activityData.stepNumber}] completed`;
  
  // Return updated activity data with new result
  return {
    ...activityData,
    results: [...(activityData.results || []), resultMessage],
  };
}

export async function runFairnessActivity(activityData) {
  // Simulate activity work with 300ms delay
  await sleep(300);
  
  // Add result entry
  const timestamp = new Date().toISOString();
  const resultMessage = `${timestamp} - Activity step [${activityData.stepNumber}] completed`;
  
  // Return updated activity data with new result
  return {
    ...activityData,
    results: [...(activityData.results || []), resultMessage],
  };
}

// Helper function to pause execution
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
