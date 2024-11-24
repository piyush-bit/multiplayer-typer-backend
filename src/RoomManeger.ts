import { Socket } from "socket.io";
import {faker} from "@faker-js/faker"

interface Progress {
  p: number; // progress count
  t: number; // time
}

interface GameState {
  isStarted: boolean;
  text: string;
  startTime: number | null;
}

interface Room {
  users: string[];
  gameState: GameState;
  progress: {
    [userId: string]: Progress;
  };
  creator: string;
}

class RoomManager {
  private rooms: Map<string, Room> = new Map();  // roomId , Room
  private users: Map<string,string> = new Map(); // userid,roomid

  createRoom(roomId:string,userId:string) : Room | undefined {
    if (this.rooms.has(roomId)) return ;
    this.rooms.set(roomId, { users: [], gameState: { isStarted: false, text: "", startTime: null }, progress: {}, creator: userId });
    this.joinRoom(roomId,userId);
    return this.rooms.get(roomId);
  }

  joinRoom(roomId:string, userId:string) : Room | undefined {
    const room = this.rooms.get(roomId);
    if (room && !room.gameState.isStarted) {
      room.users.push(userId);
      this.users.set(userId,roomId);
      room.progress[userId] = { p: 0, t: 0 };
      console.log("joinRoom",room);
      return room;
    }
    return ;
  }

  leaveRoom(userId:string) : Room | undefined {
    const roomId = this.users.get(userId);
    if(!roomId) return ;
    const room = this.rooms.get(roomId);
    if(!room) return ;
    room.users = room.users.filter(id => id !== userId);
    if(room.users.length === 0) this.rooms.delete(roomId);
    if(room.creator === userId) room.creator=room.users[0];
    this.users.delete(userId);
    return room;
  }

  startGame(roomId:string, userId:string , socket : Socket) : Room | undefined {
    const room = this.rooms.get(roomId);
    if (!room || room.creator !== userId) return ;
    room.gameState.isStarted = true;
    room.gameState.text=faker.lorem.sentence();
    
    // send text to all users
    socket.to(roomId).emit("game:text", room.gameState.text);
    socket.emit("game:text", room.gameState.text);

    //exicute after 3 second 
    setTimeout(() => {
      // Send initial countdown 3
      socket.to(roomId).emit("game:countdown", 3);
      socket.emit("game:countdown", 3);

      // Wait 1 second, then send 2
      setTimeout(() => {
        socket.to(roomId).emit("game:countdown", 2); 
        socket.emit("game:countdown", 2);
        // Wait 1 second, then send 1
        setTimeout(() => {
          socket.to(roomId).emit("game:countdown", 1);
          socket.emit("game:countdown", 1);
          // Wait 1 second, then start game
          setTimeout(() => {
            room.gameState.startTime = Date.now();
            socket.to(roomId).emit("game:start", room.gameState);
            socket.emit("game:start", room.gameState);

          }, 1000);

        }, 2000);

      }, 3000);

    },300);
    return room;
  }

  setProgress(roomId:string,userId:string,progress:number){
    const room = this.rooms.get(roomId);
    if(!room) return ;
    room.progress[userId] = {p:progress,t:Date.now()};
    return room;
  }

  getRooms(){
    return this.rooms;
  }
  getUsers(){
    return this.users;
  }

}


export default RoomManager;