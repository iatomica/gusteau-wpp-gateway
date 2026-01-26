# Gusteau - WhatsApp Gateway

This repository contains the **WhatsApp Gateway** service for the **Gusteau** restaurant management system (RMS). It is a simplified and specialized version of the whatsapp-bot repository, designed specifically to act as a bridge between WhatsApp and the Gusteau Backend.

## 🎯 Purpose

The main goal of this service is to abstract the complexity of the WhatsApp protocol (using `whatsapp-web.js`) and provide a clean REST API for the Gusteau Backend to send and receive messages.

**Key Features:**
*   **Message Relay:** Receives WhatsApp messages and forwards them to the Gusteau Backend via Webhook.
*   **Sending API:** Exposes an endpoint (`/send`) that Gusteau uses to send responses back to customers.
*   **Session Management:** Handles QR code authentication and session persistence (using LocalAuth).
*   **Media Handling:** (Optional/Planned) Support for receiving images/audio.

## 🏗 Architecture

This service runs as a standalone Node.js application.

*   **Technology:** Node.js, Express, `whatsapp-web.js`.
*   **Communication:**
    *   **Inbound (Wpp -> Gusteau):** When a message arrives on WhatsApp, this gateway POSTs the data to `GUSTEAU_API_URL`.
    *   **Outbound (Gusteau -> WA):** Gusteau POSTs to this gateway's `/send` endpoint to reply to a user.

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18 or higher recommended)
*   A WhatsApp account (phone number and a phone) to scan the QR code.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/iatomica/gusteau-wpp-gateway.git
    cd gusteau-wpp-gateway
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # Note: This project relies on whatsapp_web.js, which updates frequently. If you encounter issues, try by updating the package.
    ```

3.  **Configuration:**
    Create a `.env` file in the root directory (copy from `.env.sample`):
    ```bash
    cp .env.sample .env
    ```

    **Environment Variables:**
    *   `PORT`: Port to run the gateway (default: `3002`).
    *   `GUSTEAU_API_URL`: The full URL to the Gusteau Backend API (e.g., `http://localhost:3001/api`).
    *   `RESTAURANT_ID`: The ID of the restaurant this gateway is serving (used in webhook payloads).
    *   `GATEWAY_TOKEN`: A secret token to secure the `/send` endpoint (must match the backend config).

4.  **Run the service:**
    ```bash
    node index.js
    ```

5.  **Authenticate:**
    *   Look at the terminal output. You will see a QR Code.
    *   Open WhatsApp on your mobile device -> Linked Devices -> Link a Device.
    *   Scan the QR Code.
    *   Once connected, the console will show `Client is ready!`.

## 📡 API Endpoints

### `POST /send`
Sends a text message to a specific phone number.

**Headers:**
*   `Authorization: Bearer <GATEWAY_TOKEN>`

**Body:**
```json
{
  "to": "5491112345678",
  "message": "Hello from Gusteau!"
}
```

*Note: The `to` field must be the phone number in international format without `+` or dashes (e.g., `549...`).*

## 🐳 Docker

A `Dockerfile` is included for containerized deployment.

```bash
docker build -t gusteau-wpp-gateway .
docker run -d -p 3002:3002 --env-file .env gusteau-wpp-gateway
```

## ⚠️ Important Notes

*   **Puppeteer & Linux:** If deploying on Linux (e.g., Coolify, Railway), ensure the environment has the necessary libraries for Puppeteer/Chromium to run. The Dockerfile usually handles this by installing chrome dependencies.
*   **Session Storage:** The session is stored locally in the `.wwebjs_auth` folder. If you destroy the container without a volume, you will need to scan the QR code again.

## 📄 License
Private - IAtomica
