const io = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto"); // Mengimpor modul crypto bawaan Node.js untuk membuat hash

const socket = io("http://127.0.0.1:3000");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

let username = "";

// Fungsi dari materi hash algorithm untuk mengubah teks pesan menjadi hash SHA-256
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
        const hash = generateHash(message); // Membuat hash dari pesan asli sebelum dikirim ke server
        const payload = `${message}::${hash}`; // Menggabungkan pesan asli dan hash dengan pemisah "::" karena server hanya meneruskan string message

        socket.emit("message", { username, message: payload }); // Mengirim pesan beserta hashnya ke server
      }
      rl.prompt();
    });
  });
});

socket.on("message", (data) => {
  const { username: senderUsername, message: senderMessage } = data;
  if (senderUsername !== username) {
    const separatorIndex = senderMessage.lastIndexOf("::"); // Mencari posisi pemisah "::" untuk memisahkan isi pesan dan hash dari pengirim

    if (separatorIndex === -1) {
      // Jika pemisah "::" hilang atau rusak, tampilkan peringatan bahwa pesan telah diubah
      console.log(`\n⚠️ WARNING: Message from ${senderUsername} has been modified by the server!`);
      console.log(`${senderUsername}: ${senderMessage}`);
    } else {
      const actualMessage = senderMessage.substring(0, separatorIndex); // Mengambil teks pesan yang diterima
      const receivedHash = senderMessage.substring(separatorIndex + 2); // Mengambil nilai hash yang dikirim oleh pengirim
      const expectedHash = generateHash(actualMessage); // Menghitung ulang hash dari teks pesan yang diterima untuk proses verifikasi

      // Membandingkan hash asli pengirim dengan hasil hash ulang; jika berbeda (misal ditambah "(sus?)" oleh malicious-server), munculkan warning
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

// const io = require("socket.io-client");
// const readline = require("readline");

// const socket = io("http://localhost:3000");

// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout,
//   prompt: "> ",
// });

// let username = "";

// socket.on("connect", () => {
//   console.log("Connected to the server");

//   rl.question("Enter your username: ", (input) => {
//     username = input;
//     console.log(`Welcome, ${username} to the chat`);
//     rl.prompt();

//     rl.on("line", (message) => {
//       if (message.trim()) {
//         socket.emit("message", { username, message });
//       }
//       rl.prompt();
//     });
//   });
// });

// socket.on("message", (data) => {
//   const { username: senderUsername, message: senderMessage } = data;
//   if (senderUsername !== username) {
//     console.log(`${senderUsername}: ${senderMessage}`);
//     rl.prompt();
//   }
// });

// socket.on("disconnect", () => {
//   console.log("Server disconnected, Exiting...");
//   rl.close();
//   process.exit(0);
// });

// rl.on("SIGINT", () => {
//   console.log("\nExiting...");
//   socket.disconnect();
//   rl.close();
//   process.exit(0);
// });