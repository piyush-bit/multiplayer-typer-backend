const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Your React app URL
    methods: ["GET", "POST"],
  },
});

app.use(express.static("public")); // Serve static files from public folder

// Data structures to keep track of rooms and users
const rooms = {}; // { roomName: [userId1, userId2, ...] }
const roomCreators = {}; // { roomName: creatorId }
const roomProgress = {}; // { roomName: { userId1: progress1, userId2: progress2, ... } }
const roomInfo = {}; // { roomName: {text : text , status : status , startTime:time} }

// Generate a random text for typing challenge
const generateRandomText = () => { 
  const texts = [
    "The quick brown fox jumps over the lazy dog.",
    "Typing speed is a skill that can be improved with practice.",
    "JavaScript is versatile and widely used for web development.",
    "A journey of a thousand miles begins with a single step.",
    "The pen is mightier than the sword.",
  ];
  return texts[Math.floor(Math.random() * texts.length)];
};

// Handle Socket.IO connections
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle room creation
  socket.on("createRoom", (room) => {
    if (rooms[room]) {
      socket.emit("error", `Room ${room} already exists.`);
      return;
    }

    socket.join(room);
    rooms[room] = [socket.id];
    roomCreators[room] = socket.id;
    roomProgress[room] = {}; // Initialize progress tracking for the room

    console.log(`Room created: ${room} by ${socket.id}`);
    socket.emit("roomCreated", { room, users: rooms[room] });
  });

  // Handle joining a room
  socket.on("joinRoom", (room) => {
    if (rooms[room]) {
      socket.join(room);
      rooms[room].push(socket.id);
      roomProgress[room][socket.id] = 0; // Initialize progress for the user

      console.log(`User ${socket.id} joined room: ${room}`);
      socket.emit("roomJoined", { room, users: rooms[room] });
      io.to(room).emit("userJoined", { user: socket.id, users: rooms[room] });
    } else {
      socket.emit("error", `Room ${room} does not exist.`);
    }
  });

  // Handle the start command
  socket.on("startRace", (room) => {
    if (roomCreators[room] !== socket.id) {
      socket.emit("error", "Only the room creator can start the race.");
      return;
    }
    
    const text = generateRandomText();
    roomInfo[room]={text:text,status:"waiting"}
    io.to(room).emit("raceText", text);

    // Send countdown commands
    setTimeout(() => {
        io.to(room).emit("startCommand", `start-1`);
    }, 2000);
    setTimeout(() => {
        io.to(room).emit("startCommand", `start-2`);
    }, 3000);
    setTimeout(() => {
        io.to(room).emit("startCommand", `start-3`);
        roomInfo[room].status="race";
    }, 4000);

    console.log(`Race started in room: ${room}`);
  });

  // Handle user progress updates
  socket.on("updateProgress", ({ room, progress }) => {
    if (!rooms[room] || !rooms[room].includes(socket.id)) {
      socket.emit("error", "You are not in this room.");
      return;
    }

    roomProgress[room][socket.id] +=1; // Update user progress

    console.log(`User ${socket.id} updated progress in room ${room}: ${progress}`);
  });

  // Handle leaving a room or disconnecting
  const removeUserFromRoom = (socketId) => {
    for (const room in rooms) {
      const index = rooms[room].indexOf(socketId);
      if (index !== -1) {
        rooms[room].splice(index, 1);
        delete roomProgress[room][socketId];
        io.to(room).emit("userLeft", { user: socketId, users: rooms[room] });

        if (rooms[room].length === 0) {
          delete rooms[room];
          delete roomCreators[room];
          delete roomProgress[room];
          console.log(`Room ${room} deleted as it is empty.`);
        }
        break;
      }
    }
  };

  socket.on("leaveRoom", (room) => {
    if (rooms[room]) {
      const index = rooms[room].indexOf(socket.id);
      if (index !== -1) {
        rooms[room].splice(index, 1);
        delete roomProgress[room][socket.id];
        socket.leave(room);

        console.log(`User ${socket.id} left room: ${room}`);
        io.to(room).emit("userLeft", { user: socket.id, users: rooms[room] });

        if (rooms[room].length === 0) {
          delete rooms[room];
          delete roomCreators[room];
          delete roomProgress[room];
          console.log(`Room ${room} deleted as it is empty.`);
        }
      }
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    removeUserFromRoom(socket.id);
  });
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});