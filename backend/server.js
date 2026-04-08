if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "production";
}
const { default: app } = await import("../api/server.js");

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, () => {
  console.log(`[backend] listening on ${PORT}`);
});
