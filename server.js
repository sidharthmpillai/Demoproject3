const WebSocket = require("ws");
const express = require("express");
const http = require("http");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let users = []; // Store users' motion and location data

wss.on("connection", (ws) => {
    ws.on("message", (message) => {
        const data = JSON.parse(message);
        const { id, lat, lon, motion } = data;

        // Save user data
        users = users.filter((u) => u.id !== id); // Remove old entry
        users.push({ id, lat, lon, motion, timestamp: Date.now() });

        // Send updated nearby users
        const nearbyUsers = users.filter((u) => getDistance(lat, lon, u.lat, u.lon) < 1); // 1km range
        ws.send(JSON.stringify({ nearbyUsers }));
    });

    ws.on("close", () => {
        users = users.filter((u) => u.ws !== ws);
    });
});

// Haversine Formula to calculate distance
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

server.listen(3000, () => console.log("Server running on port 3000"));
