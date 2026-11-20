const http = require("http");
const socketIo = require("socket.io");

const server = http.createServer();
const io = socketIo(server);

// Map ini merupakan tempat penyimpanan sementara pasangan username dan publicKey di server
const users = new Map();

io.on("connection", (socket) => {
  console.log(`Client ${socket.id} connected`);

  // Mengirim daftar seluruh user dan publicKey yang sudah terdaftar ke client yang baru bergabung
  socket.emit("init", Array.from(users.entries()));

  // Menerima pendaftaran publicKey dari client lalu menyebarkannya ke semua client lain
  socket.on("registerPublicKey", (data) => {
    const { username, publicKey } = data;
    users.set(username, publicKey);
    console.log(`${username} registered with public key.`);

    io.emit("newUser", { username, publicKey });
  });

  socket.on("message", (data) => {
    const { username, message } = data;
    io.emit("message", { username, message });
  });

  socket.on("disconnect", () => {
    console.log(`Client ${socket.id} disconnected`);
  });
});

const port = 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});