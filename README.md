# AI Product Intel Engine

The **AI Product Intel Engine** is an advanced intelligence platform for evaluating software ideas, exploring AI capabilities, and generating actionable product execution plans.

## Features

- **Product Analysis**: Heuristic scoring engine (Demand, Profit, Competition, AI Feasibility) using Google Vertex AI.
- **AI Registry**: Searchable database of current AI models by provider and category. Includes internet research capability to discover new models dynamically.
- **Freelancing Hub**: Discover simple beginner-friendly remote jobs.
- **MCP Server**: Acts as a Model Context Protocol (MCP) server, allowing you to expose Intel Engine capabilities directly to AI assistants like Claude Desktop, Cursor, ChatGPT, and Windsurf via an SSE connection.
- **Premium UI**: Glassmorphism design, dark mode, micro-animations.

## Prerequisites

- **Node.js** (v16+)
- **Google Cloud Platform (GCP) Account** with Vertex AI enabled
- **Application Default Credentials (ADC)** configured for GCP

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository_url>
   cd ai-product-intel-engine
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Google Cloud Credentials:**
   Ensure you are authenticated with Google Cloud so the `google-auth-library` can access Vertex AI.
   ```bash
   gcloud auth application-default login
   gcloud config set project YOUR_PROJECT_ID
   ```
   
   *Alternatively, set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to point to your service account JSON key file.*

4. **Configure the Project ID:**
   In `server.js`, replace the `PROJECT_ID` placeholder with your actual GCP Project ID.
   ```javascript
   const PROJECT_ID = 'my-openclaw-project-22196'; // Set to your GCP Project ID
   ```

## Usage

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Open the application:**
   Navigate to `http://localhost:3000` in your web browser.

## MCP Server Integration

The Intel Engine runs an MCP Server over SSE at `http://localhost:3000/mcp/sse`.

You can view the setup instructions and copy configuration snippets for popular MCP clients (like Claude Desktop and Cursor) directly from the **Extensions** tab within the Intel Engine interface.

## Project Structure

- `/css` - Styling (variables, components, animations)
- `/js` - Frontend logic (app, router, ai-registry, scoring-engine, mcp-extension, etc.)
- `server.js` - Main Express server providing the API and serving the static site.
- `mcp-server.js` - Implementation of the Model Context Protocol backend.
- `index.html` - The main Single Page Application (SPA) layout.
