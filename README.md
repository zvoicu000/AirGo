# Drone Delivery Service

A comprehensive platform for planning and managing drone deliveries, featuring an interactive map interface with population density data and real-time weather information.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📋 Table of Contents

- [Drone Delivery Service](#drone-delivery-service)
  - [📋 Table of Contents](#-table-of-contents)
  - [🎯 Overview](#-overview)
  - [✨ Features](#-features)
  - [🏗 Architecture](#-architecture)
    - [Key AWS Services Used](#key-aws-services-used)
  - [🔧 Prerequisites](#-prerequisites)
  - [🚀 Getting Started](#-getting-started)
  - [📁 Project Structure](#-project-structure)
  - [💻 Frontend Application](#-frontend-application)
  - [🛠 Development](#-development)
    - [Local Development](#local-development)
    - [Testing](#testing)
  - [🚢 Deployment](#-deployment)
  - [🌐 API Documentation](#-api-documentation)
  - [📊 Data Sources](#-data-sources)
  - [🤝 Contributing](#-contributing)
  - [📄 License](#-license)

## 🎯 Overview

The Drone Delivery Service is a full-stack application that helps plan and optimize drone delivery routes by providing critical data visualization and analysis tools. It combines population density data with real-time weather information to assist in drone delivery planning.

## ✨ Features

- **Interactive Map Interface**
  - OpenStreetMap integration with pan and zoom capabilities
  - Population density visualization (500m x 500m grid)
  - Real-time weather station data
  - Dynamic data loading based on viewport

- **Backend Services**
  - Serverless architecture using AWS Lambda
  - Efficient spatial data querying
  - Real-time weather data integration
  - Scalable data storage using DynamoDB

- **Infrastructure**
  - Fully automated CI/CD pipelines
  - Separate stateful and stateless resource management
  - Multi-environment support (Dev, Staging, Production)

## 🏗 Architecture

The platform consists of three main components:

- **Frontend**: React-based web application served via CloudFront
- **Backend**: Serverless API built with AWS Lambda and API Gateway
- **Infrastructure**: AWS CDK-based deployment with separate stateful and stateless stacks

### Key AWS Services Used
- AWS Lambda for serverless compute
- Amazon DynamoDB for data storage
- Amazon S3 for static hosting
- Amazon CloudFront for content delivery
- AWS CodePipeline for CI/CD
- AWS API Gateway for REST API management

## 🔧 Prerequisites

- Node.js (v16 or higher)
- npm (latest stable version)
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)
- AWS SAM CLI (for local development)

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone [repository-url]
   cd drone-delivery-service
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure AWS environment**
   ```bash
   # Bootstrap AWS CDK (if not already done)
   cdk bootstrap --region eu-west-1
   ```

4. **Deploy the application**
   ```bash
   npm run deploy
   ```

   > Note: Initial deployment includes data seeding and may take several minutes.

## 📁 Project Structure

```bash
.
├── bin/                    # CDK app entry points
├── config/                 # Environment configurations
├── frontend/              # React frontend application
├── lib/                   # CDK infrastructure code
│   ├── constructs/        # Reusable CDK constructs
│   ├── stateful/         # Stateful resource stacks
│   └── stateless/        # Stateless resource stacks
├── src/                   # Lambda function source code
└── test/                  # Test files
```

## 💻 Frontend Application

The frontend is a React application with the following features:

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

Configure the API endpoint in `frontend/public/config.js` (see `config.example.js` for reference).

## 🛠 Development

### Local Development
1. Install AWS SAM CLI
2. Use VSCode debugging configurations in `.vscode/launch.json`
3. Run Lambda functions locally for testing

### Testing
```bash
npm test        # Run unit tests
npm run lint    # Run linting
```

## 🚢 Deployment

The project uses AWS CodePipeline for automated deployments:

- `prod` branch → Production environment
- `stg` branch → Staging environment
- `dev` branch → Development environment

Manual deployment commands:
```bash
cdk deploy --all               # Deploy all stacks
cdk deploy PipelineStack-Prod  # Deploy specific stack
```

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

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.