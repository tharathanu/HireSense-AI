const http = require('http');
const { env, checkEnv } = require('./config/env');

checkEnv();

const app = require('./app');
const { initSocket } = require('./socket');

const server = http.createServer(app);
initSocket(server, env.clientUrls);

server.listen(env.port, () => {
  console.log(`HireSense AI API running on port ${env.port}`);
});
