const io = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto"); // Modul crypto ini merupakan library bawaan Node.js untuk membuat kunci RSA, sign, dan verify

const socket = io("http://127.0.0.1:3000");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

// Kode ini merupakan proses generate sepasang kunci RSA (privateKey dan publicKey) otomatis untuk setiap client
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048, // Panjang kunci 2048-bit sebagai standar keamanan RSA
  publicKeyEncoding: { type: "spki", format: "pem" }, // Format standar untuk public key
  privateKeyEncoding: { type: "pkcs8", format: "pem" }, // Format standar untuk private key
});

let registeredUsername = ""; // Variabel ini merupakan penyimpan identitas username asli yang didaftarkan pertama kali
let username = ""; // Variabel ini merupakan nama pengirim aktif (bisa berubah sementara saat memakai !impersonate)
const users = new Map(); // Map ini merupakan daftar lokal berisi username dan publicKey milik semua user di chat

socket.on("connect", () => {
  console.log("Connected to the server");

  rl.question("Enter your username: ", (input) => {
    username = input.trim();
    registeredUsername = username;
    console.log(`Welcome, ${username} to the chat`);

    // Kode ini merupakan pengiriman publicKey asli milik user ke server (menggantikan teks dummy "public key" di modul)
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
          // Kode ini merupakan pembuatan digital signature dari isi pesan menggunakan privateKey milik pengirim
          const signature = crypto
            .sign("sha256", Buffer.from(message), privateKey)
            .toString("hex");

          // Variabel payload ini merupakan pembungkus teks pesan dan signature dalam format JSON agar bisa dikirim lewat server
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

  // Blok try-catch ini merupakan proses memecah kembali data JSON menjadi teks pesan asli dan kode signature
  try {
    const parsed = JSON.parse(senderMessage);
    text = parsed.text;
    signature = parsed.signature;
  } catch (e) {
    // Abaikan jika format pesan bukan JSON
  }

  // Variabel ini merupakan pengambilan publicKey milik nama pengirim yang terdaftar di Map users
  const senderPublicKeyPem = users.get(senderUsername);
  let isValid = false;

  // Blok ini merupakan proses verifikasi apakah signature cocok dengan publicKey milik senderUsername
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

  // Kode ini mencegah pesan sah milik diri sendiri muncul dua kali di layar pengirim
  if (senderUsername === registeredUsername && isValid) {
    return;
  }

  // Jika hasil verifikasi false (karena ditandatangani privateKey milik peniru), tampilkan peringatan user palsu
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