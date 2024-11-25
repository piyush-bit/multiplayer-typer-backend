import express from "express";
import http from "http";
import cors from "cors";
import { Server, Socket } from "socket.io";
import RoomManager from "./RoomManeger";


const app = express();
// Configure CORS to allow all clients
app.use(cors({
  origin: "*", // Allow all origins
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: "*", // Allow all headers
  credentials: false // No need for credentials
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  allowEIO3: true // Allow Engine.IO version 3 clients
});

app.use(express.static("public")); // Serve static files from public folder
const roomManager = new RoomManager();

// Handle Socket.IO connections
io.on("connection", (socket : Socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create Room
  socket.on("room:create", (roomId: string) => {
    const room = roomManager.createRoom(roomId, socket.id);
    
    if (room) {
      socket.join(roomId); // Important: Join the socket to the room
      socket.emit("room:create:success", {
        roomId,
        message: "Room created successfully"
      });
      socket.emit("room:user:joined", {
        roomId,
        users : room.users,
        creator : room.creator
      });
    } else {
      socket.emit("room:create:error", {
        roomId,
        message: "Room already exists or invalid room ID"
      });
    }
  });

  // Join Room
  socket.on("room:join", (roomId: string) => {
    const room = roomManager.joinRoom(roomId, socket.id);
    if (room) {
      socket.join(roomId); // Important: Join the socket to the room
      // Notify everyone in the room that someone joined
      io.in(roomId).emit("room:user:joined", {
        roomId,
        users : room.users,
        creator : room.creator
      });
      socket.emit("room:join:success", {
        roomId,
        message: "Successfully joined the room"
      });
    } else {
      socket.emit("room:join:error", {
        roomId,
        message: "Room doesn't exist or is full"
      });
    }
  });

  // Start Game
  socket.on("game:start", (roomId:string) => {
    const room = roomManager.startGame(roomId, socket.id, socket);
  });

  // Set Progress
  socket.on("game:progress", (roomId:string) => {
    const room = roomManager.setProgress(socket.id);
    if(room) io.in(roomId).emit("game:progress",room.progress);
  })

  // Leave Room
  socket.on("room:leave", (roomId:string) => {
    const room = roomManager.leaveRoom(socket.id);
    if(room) socket.to(roomId).emit("room:user:left",room.users);
  })


  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    roomManager.leaveRoom(socket.id);
  });
});

// Add health check endpoint (add this before other routes)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() , rooms : roomManager.getRooms() , users : roomManager.getUsers() });
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
