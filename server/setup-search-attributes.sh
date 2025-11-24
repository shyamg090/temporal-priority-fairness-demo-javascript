#!/bin/bash

# Setup script for registering Temporal search attributes
# This script registers the custom search attributes needed for the Priority/Fairness demo

echo "Setting up Temporal search attributes..."

# Check if tctl is available
if ! command -v tctl &> /dev/null; then
    echo "Error: tctl (temporal CLI) is not installed or not in PATH"
    echo "Please install it from: https://docs.temporal.io/cli#installation"
    exit 1
fi

echo "Creating search attributes..."

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

echo "Search attributes setup complete!"
echo ""
echo "You can now start the server:"
echo "  npm run dev"
