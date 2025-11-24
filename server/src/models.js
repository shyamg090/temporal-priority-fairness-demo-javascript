// Workflow Configuration Models
export class WorkflowConfig {
  constructor() {
    this.workflowIdPrefix = '';
    this.numberOfWorkflows = 100;
    this.mode = 'priority'; // 'priority' or 'fairness'
    this.bands = []; // Optional fairness bands
    this.disableFairness = false;
  }
}

export class Band {
  constructor(key, weight, count = null) {
    this.key = key;
    this.weight = weight;
    this.count = count;
  }
}

// Priority Mode Models
export class PriorityWorkflowData {
  constructor(priority = 1) {
    this.priority = priority;
  }
}

export class PriorityActivityData {
  constructor(priority = 1) {
    this.stepNumber = 0;
    this.priority = priority;
    this.results = [];
  }
}

// Fairness Mode Models
export class FairnessWorkflowData {
  constructor(fairnessKey, fairnessWeight, disableFairness = false) {
    this.fairnessKey = fairnessKey;
    this.fairnessWeight = fairnessWeight;
    this.disableFairness = disableFairness;
  }
}

export class FairnessActivityData {
  constructor(fairnessKey, fairnessWeight) {
    this.stepNumber = 0;
    this.fairnessKey = fairnessKey;
    this.fairnessWeight = fairnessWeight;
    this.results = [];
  }
}

// Test Results Models
export class ActivitySummary {
  constructor(activityNumber) {
    this.activityNumber = activityNumber;
    this.numberCompleted = 0;
  }
}

export class WorkflowSummary {
  constructor(workflowPriority) {
    this.workflowPriority = workflowPriority;
    this.numberOfWorkflows = 0;
    this.activities = [];
  }
}

export class FairnessSummary {
  constructor(fairnessKey, fairnessWeight) {
    this.fairnessKey = fairnessKey;
    this.fairnessWeight = fairnessWeight;
    this.numberOfWorkflows = 0;
    this.activities = [];
  }
}

export class PriorityTestRunResults {
  constructor(wfExecutionMetadata = []) {
    this.workflowsByPriority = [];
    this.totalWorkflowsInTest = wfExecutionMetadata.length;

    // Initialize counters for priorities 1-5 (matching Java implementation)
    for (let priority = 1; priority <= 5; priority++) {
      this.workflowsByPriority.push(new WorkflowSummary(priority));
    }

    // Process workflow metadata (matching Java iterator pattern)
    for (const metadata of wfExecutionMetadata) {
      try {
        // Extract search attributes - handle both raw and typed formats
        const searchAttribs = this.extractSearchAttributes(metadata);
        const wfPriority = searchAttribs.Priority || 0;
        const activitiesCompleted = searchAttribs.ActivitiesCompleted || 0;

        // console.log(`Processing workflow - Priority: ${wfPriority}, ActivitiesCompleted: ${activitiesCompleted}`);

        // Only process if priority is in valid range (1-5)
        if (wfPriority >= 1 && wfPriority <= 5) {
          const wfSummary = this.workflowsByPriority[wfPriority - 1];
          wfSummary.numberOfWorkflows += 1;

          // Add activity progress counts (matching Java incrementActivityCompleted logic)
          for (let actComplete = 1; actComplete <= activitiesCompleted; actComplete++) {
            this.incrementActivityCompleted(actComplete, wfSummary);
          }
        }
      } catch (ex) {
        // Swallow exceptions - workflows may not have all attributes yet
        console.log('Error processing workflow metadata:', ex.message);
      }
    }
  }

  extractSearchAttributes(metadata) {
    const attributes = {};
    
    // Handle the execution object structure from Temporal client
    let attrs = null;
    
    if (metadata.searchAttributes) {
      attrs = metadata.searchAttributes;
    } else if (metadata.typedSearchAttributes) {
      attrs = metadata.typedSearchAttributes;
    } else if (typeof metadata.getSearchAttributes === 'function') {
      attrs = metadata.getSearchAttributes() || {};
    }
    
    if (!attrs) {
      return attributes;
    }

    // Temporal returns search attributes as an object where each key maps to an array
    // e.g., { Priority: [1], ActivitiesCompleted: [0] }
    // Extract the first element from each array
    for (const [key, value] of Object.entries(attrs)) {
      if (Array.isArray(value) && value.length > 0) {
        // Extract first element from array
        attributes[key] = value[0];
      } else if (!Array.isArray(value)) {
        // If not an array, use as-is
        attributes[key] = value;
      }
    }
    
    return attributes;
  }

  incrementActivityCompleted(actComplete, wfSummary) {
    console.log(`Summary priority we are looking at [${wfSummary.workflowPriority}]`);
    
    let actSummary = null;
    
    // Try to find existing activity summary (matching Java ArrayList access)
    try {
      actSummary = wfSummary.activities[actComplete - 1];
    } catch (ex) {
      // Swallow exception - activity not found, will create new
    }

    if (actSummary == null) {
      // Create new activity summary if not found
      const activitySummary = new ActivitySummary(actComplete);
      activitySummary.numberCompleted = 1;
      wfSummary.activities.push(activitySummary);
    } else {
      // Increment existing activity count
      actSummary.numberCompleted += 1;
    }
  }
}

export class FairnessTestRunResults {
  constructor(wfExecutionMetadata = []) {
    this.workflowsByFairness = [];
    this.totalWorkflowsInTest = wfExecutionMetadata.length;

    // Use LinkedHashMap equivalent (JavaScript Map maintains insertion order)
    const groups = new Map();

    // Process each workflow metadata
    for (const metadata of wfExecutionMetadata) {
      try {
        const searchAttribs = this.extractSearchAttributes(metadata);
        
        let fairnessKey = searchAttribs.FairnessKey || '';
        let fairnessWeight = searchAttribs.FairnessWeight || 0;
        const activitiesCompleted = searchAttribs.ActivitiesCompleted || 0;

        // console.log(`Processing workflow - FairnessKey: ${fairnessKey}, FairnessWeight: ${fairnessWeight}, ActivitiesCompleted: ${activitiesCompleted}`);

        // Create group key combining fairnessKey and weight (matching Java pattern)
        const groupKey = `${fairnessKey}|${fairnessWeight}`;
        let summary = groups.get(groupKey);

        if (summary == null) {
          // Create new fairness summary if group doesn't exist
          summary = new FairnessSummary(fairnessKey, fairnessWeight);
          summary.numberOfWorkflows = 0;
          groups.set(groupKey, summary);
        }

        summary.numberOfWorkflows += 1;

        // Add activity progress counts (matching Java incrementActivityCompleted logic)
        for (let actComplete = 1; actComplete <= activitiesCompleted; actComplete++) {
          this.incrementActivityCompleted(actComplete, summary);
        }
      } catch (ex) {
        // Swallow exceptions
        console.log('Error processing fairness metadata:', ex.message);
      }
    }

    // Sort by fairness weight (descending) then by key (matching Java comparator)
    const sorted = Array.from(groups.values()).sort((a, b) => {
      // Compare by weight first (descending)
      if (b.fairnessWeight !== a.fairnessWeight) {
        return b.fairnessWeight - a.fairnessWeight;
      }
      // Then compare by key alphabetically
      return a.fairnessKey.localeCompare(b.fairnessKey);
    });

    this.workflowsByFairness = sorted;
  }

  extractSearchAttributes(metadata) {
    const attributes = {};
    
    // Handle the execution object structure from Temporal client
    let attrs = null;
    
    if (metadata.searchAttributes) {
      attrs = metadata.searchAttributes;
    } else if (metadata.typedSearchAttributes) {
      attrs = metadata.typedSearchAttributes;
    } else if (typeof metadata.getSearchAttributes === 'function') {
      attrs = metadata.getSearchAttributes() || {};
    }
    
    if (!attrs) {
      return attributes;
    }

    // Temporal returns search attributes as an object where each key maps to an array
    // e.g., { FairnessKey: ['first-class'], FairnessWeight: [15], ActivitiesCompleted: [0] }
    // Extract the first element from each array
    for (const [key, value] of Object.entries(attrs)) {
      if (Array.isArray(value) && value.length > 0) {
        // Extract first element from array
        attributes[key] = value[0];
      } else if (!Array.isArray(value)) {
        // If not an array, use as-is
        attributes[key] = value;
      }
    }
    
    return attributes;
  }

  incrementActivityCompleted(actComplete, summary) {
    let actSummary = null;
    
    // Try to find existing activity summary
    try {
      actSummary = summary.activities[actComplete - 1];
    } catch (ex) {
      // Swallow exception - activity not found
    }

    if (actSummary == null) {
      // Create new activity summary if not found
      const activitySummary = new ActivitySummary(actComplete);
      activitySummary.numberCompleted = 1;
      summary.activities.push(activitySummary);
    } else {
      // Increment existing activity count
      actSummary.numberCompleted += 1;
    }
  }
}
