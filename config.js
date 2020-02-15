const dotenv = require('dotenv');
dotenv.config({ silent: true });

module.exports = process.env.CONFIG || {
  "interval": 2,
  "agent_id": "",
  "infura_api": "",
  "eth_block_threshold": 1440,
  "smtp": {
    "host": "smtp.gmail.com",
    "auth": {
      "user": "dwasyluk@blockchainfoundry.co",
      "pass": ""
    },
    "port": 465,
    "secure": true
  },
  "syscoin": {
    "host": "localhost",
    "user": "u",
    "pass": "p",
    "port": "8370"
  },
  "explorer_url": "https://explorer-testnet.blockchainfoundry.co",
  "notify_email": "sysethagent@blockchainfoundry.co;dwasyluk@blockchainfoundry.co",
  "sender_email": "dwasyluk@blockchainfoundry.co",
  "port": 9999,
  "enable_mail": false
};
