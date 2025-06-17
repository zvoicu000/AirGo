# Drone Delivery Service

This

## Architecture Overview

The platform consists of several key components:

- **Pipelines**: CI/CD pipeline for deploying the infrastructure and application code
- **Stateful Resources**: DynamoDB, S3, and other stateful resources
- **Stateless Resources**: Lambda functions, API Gateway, and other stateless resources

## Project Structure

```bash
.
├── bin/                    # Entry point for CDK app
├── config/                 # Environment and pipeline configurations
├── lib/                    # Core CDK stack definitions
│   ├── constructs/         # Reusable CDK constructs such as custom Lambda function
├── src/                    # Source code for the application (e.g. Lambda function Code)
├── stateful/             
│   ├── nested/             # Nested stacks of stateful resources
│   └── stateful-stack.ts   # Stateful stack definition
├── stateless/
│   ├── nested/             # Nested stacks of stateless resources
│   └── stateless-stack.ts  # Stateless stack definition
└── test/                   # Test files
```

## Prerequisites

- Node.js and npm installed
- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed (`npm install -g aws-cdk`)

## Environment Configuration

The platform supports three environments:

- **Dev**: Development environment - Deployed to ephemeral developer accounts
- **Production**: Production environment - Deployed through CDK Pipelines in a central services account

## Pipelines

This project is setup in line with AWS best practice where a cental account (the services account) contains the CodePipelines that are used to deploy the infrastructure and application code to the target environments (Production only).

Pipelines for the target environments have been deployed and due to the self-mutating nature of the CDK, the pipelines will automatically update themselves when changes are made to the codebase. In general, there should be no need to manually deploy the pipelines.

If there is a need to deploy the pipelines manually, the following commands can be used:

Deploy all pipelines:
`cdk deploy --all`

Deploy a single pipeline:
`cdk deploy Pipeline-<name>`
e.g. `cdk deploy PipelineStack-Prod`

You can use:
`cdk list`
to get the names of all the stacks that can be deployed.

## Infrastructure and Application Deployment

In line with best practice, the infrastructure and application is partitioned into two stacks:
- **Stateful Stack**: Contains resources that maintain state, such as databases and file storage.
- **Stateless Stack**: Contains resources that do not maintain state, such as Lambda functions and API Gateway.

This allows for better separation of concerns and easier management of resources.

The infrastructure and application deployment is managed through CodePipeline. The deployment is linked to the GitHub repository, and the pipeline will automatically trigger a deployment when changes are pushed to the following branches.
- `prod` - Deploys to the production environment
- `stg` - Deploys to the staging environment
- `dev` - Deploys to the development environment




## Getting Started

npm install

Set the region in `config/types.ts`

cdk bootstrap --region eu-west-1

cdk deploy --all

Initial deployment will take some time as it seeds the DynamoDB table with initial data.
There is limited cost as this is seeded directly from S3 rather than using Put operations.


Nearly 800k data points in the UK


Contains data supplied by UK Centre for Ecology & Hydrology.

exploit the Information commercially and non-commercially for example, by combining it with other Information, or by including it in your own product or application.