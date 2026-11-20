const io = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto");

const socket = io("http://127.0.0.1:3000");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

let targetUsername = "";
let username = "";
const users = new Map();

function findUser(target) {
  for (const [user, key] of users.entries()) {
    if (user.toLowerCase() === target.toLowerCase()) {
      return { exactName: user, key };
    }
  }
  return null;
}

socket.on("connect", () => {
  console.log("Connected to the server");

  rl.question("Enter your username: ", (input) => {
    username = input.trim();
    console.log(`Welcome, ${username} to the chat`);

    socket.emit("registerPublicKey", {
      username,
      publicKey,
    });
    rl.prompt();

    rl.on("line", (message) => {
      if (message.trim()) {
        const match = message.match(/^!secret (\w+)$/);
        if (match) {
          const found = findUser(match[1]);
          if (!found) {
            console.log(`User "${match[1]}" not found!`);
          } else {
            targetUsername = found.exactName;
            console.log(`Now secretly chatting with ${targetUsername}`);
          }
        } else if (message.match(/^!exit$/)) {
          console.log(`No more secretly chatting with ${targetUsername}`);
          targetUsername = "";
        } else if (targetUsername) {
          const targetPublicKey = users.get(targetUsername);
          const encrypted = crypto.publicEncrypt(
            targetPublicKey,
            Buffer.from(message, "utf8")
          );
          socket.emit("message", {
            username,
            message: encrypted.toString("hex"),
          });
        } else {
          socket.emit("message", { username, message });
        }
      }
      rl.prompt();
    });
  });
});

socket.on("init", (keys) => {
  keys.forEach(([user, key]) => users.set(user, key));
  console.log(`\nThere are currently ${users.size} users in the chat`);
  rl.prompt();
});

socket.on("newUser", (data) => {
  const { username, publicKey } = data;
  users.set(username, publicKey);
  console.log(`${username} join the chat`);
  rl.prompt();
});

socket.on("message", (data) => {
  const { username: senderUsername, message: senderMessage } = data;
  if (senderUsername !== username) {
    try {
      const decrypted = crypto.privateDecrypt(
        privateKey,
        Buffer.from(senderMessage, "hex")
      );
      console.log(`${senderUsername} (secret): ${decrypted.toString("utf8")}`);
    } catch (err) {
      console.log(`${senderUsername}: ${senderMessage}`);
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
