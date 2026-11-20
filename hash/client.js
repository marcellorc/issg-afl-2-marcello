const io = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto");

const socket = io("http://127.0.0.1:3000");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

let username = "";

function generateHash(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

socket.on("connect", () => {
  console.log("Connected to the server");

  rl.question("Enter your username: ", (input) => {
    username = input;
    console.log(`Welcome, ${username} to the chat`);
    rl.prompt();

    rl.on("line", (message) => {
      if (message.trim()) {
        const hash = generateHash(message);
        const payload = `${message}::${hash}`;
        socket.emit("message", { username, message: payload });
      }
      rl.prompt();
    });
  });
});

socket.on("message", (data) => {
  const { username: senderUsername, message: senderMessage } = data;
  if (senderUsername !== username) {
    const separatorIndex = senderMessage.lastIndexOf("::");

    if (separatorIndex === -1) {
      console.log(`\n⚠️ WARNING: Message from ${senderUsername} has been modified by the server!`);
      console.log(`${senderUsername}: ${senderMessage}`);
    } else {
      const actualMessage = senderMessage.substring(0, separatorIndex);
      const receivedHash = senderMessage.substring(separatorIndex + 2);
      const expectedHash = generateHash(actualMessage);

      if (receivedHash !== expectedHash) {
        console.log(`\n⚠️ WARNING: Message from ${senderUsername} has been modified by the server!`);
      }
      console.log(`${senderUsername}: ${actualMessage}`);
    }
    rl.prompt();
  }
});

socket.on("disconnect", () => {
  console.log("Server disconnected, Exiting...");
  rl.close();
  process.exit(0);
});

rl.on("SIGINT", () => {
  console.log("\nExiting...");
  socket.disconnect();
  rl.close();
  process.exit(0);
});
