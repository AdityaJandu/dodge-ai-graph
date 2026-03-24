
# Enterprise Order-to-Cash (O2C) Graph Intelligence

A full-stack enterprise data visualization and querying platform. This application ingests raw supply chain data, constructs a strictly typed Neo4j graph ontology, and provides an interactive, highly optimized 2D physics visualization. 

It is powered by a custom **Text-to-Cypher AI Agent** that allows users to query complex Order-to-Cash (O2C) relationships using natural language, protected by strict domain guardrails.

## ✨ Core Features

* **Text-to-Cypher AI Agent:** Translates natural language into precise Neo4j Cypher queries. Implements strict domain guardrails to reject out-of-scope queries and enforces structured JSON outputs to seamlessly synchronize LLM responses with the React UI.
* **Optimized Physics Engine:** D3-based force-directed graph tailored for enterprise "super nodes." Custom `charge` and `link.distance` parameters prevent clustering, while dynamic link transparency ensures readability during massive sub-graph queries.
* **Production-Grade UX:** Features a modern, translucent glassmorphic legend, pin-able node metadata cards, and layout-stable loading states.
* **Enterprise Data Pipeline:** Includes a batched, transactional ingestion script (`seed.ts`) that reads JSONL files, cleanses dirty enterprise data (e.g., stripping leading zeros from IDs), and persists rich row-level metadata directly to graph nodes.

## 🛠️ Tech Stack

**Frontend**
* **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
* **Language:** TypeScript
* **Visualization:** `react-force-graph-2d`, D3.js
* **Styling:** Tailwind CSS
* **Components:** [Shadcn UI](https://ui.shadcn.com/), Lucide React

**Backend & Data**
* **Database:** [Neo4j](https://neo4j.com/) (`neo4j-driver`)
* **AI Engine:** Google Gemini 1.5 Flash (`@google/generative-ai`)
* **Data Processing:** Node.js file streams (JSONL batching)

## 🚀 Getting Started

### Prerequisites
* **Node.js** (v18+ recommended)
* A running **Neo4j** instance (AuraDB cloud or Local Desktop)
* A **Google Gemini API Key**

### 1. Environment Variables
Create a `.env.local` file in the root directory and add your credentials:
```env
NEO4J_URI=neo4j+s://<your-host>:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=<your_password>
GEMINI_API_KEY=<your_gemini_api_key>
````

### 2\. Installation

Install the required dependencies:

```bash
npm install
```

### 3\. Seed the Database

Before running the application, you need to populate your Neo4j instance with the O2C dataset. The seed script reads from the `./data/**` directory (JSONL files) and builds the graph with proper indexes and relationships.

```bash
npm run seed
```

### 4\. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000) to view the graph intelligence dashboard.

## 🧠 System Architecture & API

### Graph Hydration Boundary

Because `react-force-graph-2d` relies heavily on the HTML5 `<canvas>` and the browser's `window` object, the graph module is isolated behind a `next/dynamic` import with `ssr: false`. This enforces a strict client-side rendering boundary, preventing Next.js hydration mismatch errors.

### Key API Routes

  * **`GET /api/graph`**
      * Returns a capped set of relationships for the initial graph render.
      * Supports query parameters (e.g., `?customerId=320000083`) to return a specific node and its immediate neighborhood.
  * **`POST /api/chat`**
      * **Input:** `{ "message": "Find the customer with id: 320000083" }`
      * **Processing:** The Gemini agent maps the intent to the Neo4j schema, generates a Cypher query, and executes it securely.
      * **Output:** Returns the natural language response, the Cypher used, and an array of `highlightIds` that the React frontend uses to instantly illuminate the relevant nodes on the canvas.

## 🗂️ Project Structure

This application utilizes a modular, feature-sliced architecture to separate concerns between the UI primitives, global routing, and domain-specific logic.

```text
├── scripts/
│   ├── inspect.ts         # Utility to dynamically inspect JSONL schemas
│   └── seed.ts            # Batched Neo4j data ingestion & cleansing pipeline
├── src/
│   ├── app/               # Next.js App Router (Global Routing & API)
│   │   ├── api/
│   │   │   ├── chat/      # Gemini Text-to-Cypher agent endpoint
│   │   │   ├── graph/     # Neo4j graph data retrieval endpoint
│   │   │   └── test-db/   # Database connection health check
│   │   ├── globals.css    # Global Tailwind and CSS variable definitions
│   │   ├── layout.tsx     # Root layout and font configuration
│   │   └── page.tsx       # Main dashboard entry point (Hydration boundary)
│   ├── components/        # Shared UI Layer
│   │   ├── self/          # Custom composite components (e.g., LoadingState)
│   │   └── ui/            # Shadcn UI primitives (cards, buttons, spinners)
│   ├── lib/               # Shared utilities (e.g., auth, utils, db drivers)
│   └── modules/           # Feature-Sliced Domain Modules
│       ├── chat/          
│       │   └── ui/views/  # Chat interface and message state management
│       └── graph/         
│           ├── ui/        # NodeDetailsCard component
│           └── views/     # Main ForceGraph2D canvas and physics engine
├── .env.local             # Environment variables (Neo4j & Gemini)
├── tailwind.config.ts     # Tailwind theme and Shadcn configuration
└── package.json           # Dependencies and custom NPM scripts
```

## 📝 Available Scripts

  * `npm run dev`: Starts the Next.js development server.
  * `npm run build`: Builds the application for production.
  * `npm run start`: Starts the production server.
  * `npm run seed`: Executes the Neo4j data ingestion pipeline from the `./data` directory.
