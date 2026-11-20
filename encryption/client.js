const io = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto"); // Modul crypto ini merupakan library bawaan Node.js untuk generate kunci, enkripsi, dan dekripsi RSA

const socket = io("http://127.0.0.1:3000");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

// Kode ini merupakan proses generate sepasang kunci RSA (privateKey dan publicKey) otomatis untuk client ini
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048, // Panjang kunci 2048-bit sebagai standar keamanan RSA
  publicKeyEncoding: { type: "spki", format: "pem" }, // Format standar untuk public key
  privateKeyEncoding: { type: "pkcs8", format: "pem" }, // Format standar untuk private key
});

let targetUsername = ""; // Variabel ini merupakan penyimpan username tujuan saat mode chat rahasia (!secret) aktif
let username = ""; // Variabel ini merupakan username milik client yang sedang aktif
const users = new Map(); // Map ini merupakan daftar lokal berisi username dan publicKey milik semua user di chat

// Fungsi ini merupakan pencari user di Map agar perintah !secret tetap cocok meski huruf besar/kecil berbeda (misal: bob vs Bob)
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

    // Kode ini merupakan pengiriman publicKey asli milik user ke server saat pertama kali bergabung
    socket.emit("registerPublicKey", {
      username,
      publicKey,
    });
    rl.prompt();

    rl.on("line", (message) => {
      if (message.trim()) {
        // Kode ini merupakan pengecekan apakah user mengetik perintah !secret <username>
        const match = message.match(/^!secret (\w+)$/);
        if (match) {
          const found = findUser(match[1]);
          if (!found) {
            console.log(`User "${match[1]}" not found!`);
          } else {
            // Variabel targetUsername diisi dengan nama penerima rahasia yang dituju
            targetUsername = found.exactName;
            console.log(`Now secretly chatting with ${targetUsername}`);
          }
        } else if (message.match(/^!exit$/)) {
          // Kode ini merupakan perintah untuk keluar dari mode rahasia dan kembali ke chat publik normal
          console.log(`No more secretly chatting with ${targetUsername}`);
          targetUsername = "";
        } else if (targetUsername) {
          // Variabel ini merupakan pengambilan publicKey milik targetUsername yang akan dikirimi pesan rahasia
          const targetPublicKey = users.get(targetUsername);

          // Kode ini merupakan proses enkripsi pesan asli menggunakan publicKey milik targetUsername
          const encrypted = crypto.publicEncrypt(
            targetPublicKey,
            Buffer.from(message, "utf8")
          );

          // Kode ini merupakan pengiriman hasil enkripsi (ciphertext) dalam format string heksadesimal ke server
          socket.emit("message", {
            username,
            message: encrypted.toString("hex"),
          });
        } else {
          // Kode ini merupakan pengiriman pesan teks biasa (plaintext) jika mode !secret sedang tidak aktif
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
      // Kode ini merupakan percobaan dekripsi pesan masuk menggunakan privateKey milik penerima sendiri
      const decrypted = crypto.privateDecrypt(
        privateKey,
        Buffer.from(senderMessage, "hex")
      );

      // Jika dekripsi berhasil (berarti pesan memang dienkripsi untuk user ini), tampilkan teks asli (plaintext)
      console.log(`${senderUsername} (secret): ${decrypted.toString("utf8")}`);
    } catch (err) {
      // Jika dekripsi gagal (berarti pesan biasa atau pesan rahasia untuk user lain), tampilkan apa adanya (ciphertext hex)
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