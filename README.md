# Drone Delivery Service

Developed for the [AWS Lambda Hackathon 2025](https://awslambdahackathon.devpost.com), this project is a full-stack drone delivery service application that integrates population density data and real-time weather information to optimize drone delivery routes.

AWS Lambda is at the core of this application, providing the compute services needed for real-time data processing and API management.

![Application Screenshot](resources/images/application.png)

A live demo of the deployed application is available at [Drone Delivery Service Demo](https://droneplanner.crockwell.com).

[![License: GPL 3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://opensource.org/licenses/GPL-3.0)

## 📋 Table of Contents

- [Drone Delivery Service](#drone-delivery-service)
  - [📋 Table of Contents](#-table-of-contents)
  - [🎯 Overview](#-overview)
  - [🏗 Architecture](#-architecture)
  - [ƛ Use of AWS Lambda](#ƛ-use-of-aws-lambda)
  - [🔧 System Prerequisites](#-system-prerequisites)
  - [🚀 The TLDR Getting Started](#-the-tldr-getting-started)
  - [📁 Project Structure](#-project-structure)
  - [💻 Frontend Application](#-frontend-application)
  - [🛠 Development](#-development)
    - [Local Development](#local-development)
    - [Testing](#testing)
  - [🚢 Deployment](#-deployment)
  - [🌐 API Documentation](#-api-documentation)
  - [📊 Data Sources](#-data-sources)
  - [📄 License](#-license)

## 🎯 Overview

The Drone Delivery Service is a full-stack application that helps plan and optimize drone delivery routes by providing critical data visualization and analysis tools. It combines population density data with real-time weather information to assist in drone delivery planning.

## 🏗 Architecture

The platform consists of three main components:

- **Frontend**: React-based web application served via CloudFront
- **Backend**: Serverless API built with AWS Lambda and API Gateway
- **Infrastructure**: AWS CDK-based deployment with separate stateful and stateless stacks

The overall architecture is shown below:
![Architecture Diagram](resources/images/architecture.png)

AWS services consist of:
- AWS Lambda for serverless compute
- Amazon DynamoDB for data storage
- Amazon S3 for static hosting
- Amazon CloudFront for content delivery
- AWS CodePipeline for CI/CD
- AWS API Gateway for REST API management
- AWS AppSync Events for real-time websocket communication

## ƛ Use of AWS Lambda

AWS Lambda sits at the heart of the application. Lambda functions are used for three main purposes with three different trigger types:

1. **Scheduled Data Loading**: A Lambda function processes data from weather stations and stores it in DynamoDB. This is triggered by an Eventbridge Scheduled Event, running every hour to bring in the latest weather data.
2. **API Management**: Lambda functions handle API requests, providing endpoints for the frontend to fetch data and perform operations.
3. **Event Driven**: A Lambda function is triggered by INSERTS into a DynamoDB table, allowing for real-time updates to the frontend when new data is added, making use of AWS AppSync Events for websocket communication.

## 🔧 System Prerequisites

Before you begin, ensure you have the following prerequisites installed and configured on your local machine:
- Node.js
- npm (latest stable version)
- AWS CLI configured with appropriate credentials, connected to a valid AWS account
- AWS CDK CLI (`npm install -g aws-cdk`)
- A bootstrapped AWS environment in the desired region (e.g., `eu-west-1`): `cdk bootstrap --region eu-west-1`
- AWS SAM CLI (for local development)

## 🚀 The TLDR Getting Started

1. **Clone the repository**
   ```bash
   git clone [repository-url]
   cd drone-delivery-service
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Deploy the application (Frontend and Backend)**
   ```bash
   npm run deploy
   ```

   > Note: Initial deployment includes data seeding and may take several minutes. This is a one-time setup step.
   > Note: running npm run deploy will deploy the backend and the frontend of the application. These are technically two different CDK applications. More details of the deployment process can be found in the [Deployment](#-deployment) section.

## 📁 Project Structure

```bash
.
├── bin/                   # CDK app entry points (backend and frontend)
├── config/                # Environment configurations
├── frontend/              # React frontend application
├── lib/                   # CDK infrastructure code
│   ├── constructs/        # Reusable CDK constructs
│   ├── stateful/          # Stateful resource stacks (DynamoDB)
│   └── stateless/         # Stateless resource stacks (Lambda, API Gateway) - Uses nested stacks
│   └── frontend/          # Frontend resource stacks (S3 and CloudFront)
├── src/                   # Lambda function source code
└── test/                  # Test files
```

## 💻 Frontend Application

The frontend application is built using React and Tailwind CSS, providing a responsive and interactive user interface for visualizing population density and weather data. This has been built for the purposes of exercising the system backend and is not intended for production use. It has the following features:

- Population density visualization
- Weather station data display
- Interactive map controls
- Responsive design using Tailwind CSS

To run locally:
```bash
cd frontend
npm install
npm start
```

The frontend running locally will connect to the deployed backend API, which is configured with an output of the backend CDK deployment and written to the `frontend/src/cdk-output.json` file.

## 🛠 Development

### Local Development
1. Install AWS SAM CLI
2. Use VSCode debugging configurations in `.vscode/launch.json`
3. Run Lambda functions locally for testing

### Testing
```bash
npm run test    # Run unit tests
npm run lint    # Run linting
```

## 🚢 Deployment

The project uses the awesome CDK project (in Typescript) for infrastructure definition and deployment.

## 🌐 API Documentation

The backend API is available at:
```bash
https://[api-id].execute-api.[region].amazonaws.com/prod/
```

Key endpoints:
- `/spatial/bounding-box` - Get population data within map bounds
- Parameters:
  - `latMin`: Minimum latitude
  - `lonMin`: Minimum longitude
  - `latMax`: Maximum latitude
  - `lonMax`: Maximum longitude

## 📊 Data Sources

- Population data: UK Centre for Ecology & Hydrology
- Coverage: ~800,000 data points across the UK
- License: Commercial and non-commercial use permitted

## 📄 License

This project is licensed under the GNU General Public License v3.0 [![License: GPL 3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://opensource.org/licenses/GPL-3.0) - see the LICENSE file for details.