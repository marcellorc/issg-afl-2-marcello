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

let registeredUsername = "";
let username = "";
const users = new Map();

socket.on("connect", () => {
  console.log("Connected to the server");

  rl.question("Enter your username: ", (input) => {
    username = input.trim();
    registeredUsername = username;
    console.log(`Welcome, ${username} to the chat`);

    socket.emit("registerPublicKey", {
      username,
      publicKey,
    });
    rl.prompt();

    rl.on("line", (message) => {
      if (message.trim()) {
        const match = message.match(/^!impersonate (\w+)$/);
        if (match) {
          username = match[1];
          console.log(`Now impersonating as ${username}`);
        } else if (message.match(/^!exit$/)) {
          username = registeredUsername;
          console.log(`Now you are ${username}`);
        } else {
          const signature = crypto
            .sign("sha256", Buffer.from(message), privateKey)
            .toString("hex");

          const payload = JSON.stringify({ text: message, signature });
          socket.emit("message", { username, message: payload });
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

  let text = senderMessage;
  let signature = "";

  try {
    const parsed = JSON.parse(senderMessage);
    text = parsed.text;
    signature = parsed.signature;
  } catch (e) {}

  const senderPublicKeyPem = users.get(senderUsername);
  let isValid = false;

  if (senderPublicKeyPem && signature) {
    try {
      isValid = crypto.verify(
        "sha256",
        Buffer.from(text),
        senderPublicKeyPem,
        Buffer.from(signature, "hex")
      );
    } catch (err) {
      isValid = false;
    }
  }

  if (senderUsername === registeredUsername && isValid) {
    return;
  }

  if (!isValid) {
    console.log(`\n⚠️ WARNING: this user is fake! (Claimed as ${senderUsername})`);
  }
  console.log(`${senderUsername}: ${text}`);
  rl.prompt();
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
