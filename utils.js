require('arraync');
const Jtr = require('json-token-replace');
const find = require('find-process');
const fs = require('fs');
const syscoin = require('@syscoin/syscoin-js');
const rp = require('request-promise');
const jtr = new Jtr();

const constants = require('./constants');
const config = require('./config');

const syscoinClient = new syscoin.SyscoinRpcClient({host: config.syscoin.host, rpcPort: config.syscoin.port, username: config.syscoin.user, password: config.syscoin.pass});

async function checkProcessDown(mailer) {
  const processes = [constants.SYSETHEREUM_AGENT, constants.SYSCOIND, constants.SYSGETH, constants.SYSRELAYER];
  console.log('Checking process statuses');
  let status = {
    [constants.SYSETHEREUM_AGENT]: false,
    [constants.SYSCOIND]: false,
    [constants.SYSGETH]: false,
    [constants.SYSRELAYER]: false
  };
  await processes.forEachAsync(async processName => {
    let list = await find('name', processName, false);
    if (list.length === 0) {
      let info;
      if (config.enable_mail) {
        info = await sendMail(mailer, require('./messages/agent_process_down'));
        console.log(`${processName.toUpperCase()} DOWN! Sending email. ${info}`);
      }
      status[processName] = false;
    } else {
      console.log(`${list.length} running ${processName}, no action needed.`);
      status[processName] = true;
    }
  });

  return status;
}

async function sendMail(mailer, message, tokenObj = null) {
  console.log('sendmail');
  message.to = config.notify_email;
  message.from = config.sender_email;
  if (tokenObj) {
    message.subject = jtr.replace(tokenObj, message.subject);
    message.text = jtr.replace(tokenObj, message.text);
    message.html = jtr.replace(tokenObj, message.html);
  }
  console.log("message:", JSON.stringify(message));

  try {
    let info = await mailer.sendMail(message);
    console.log('sendmail result', info);
  } catch (e) {
    console.log(e);
  }
}

function writeFile(fileName, content) {
  fs.writeFileSync('uptime.tmp', content, (err) => {
    // throws an error, you could also catch it here
    if (err) throw err;

    // success case, the file was saved
    console.log('Uptime saved!');
  });
}

function readFile(fileName) {
  try {
    return fs.readFileSync(fileName, 'utf8');
  } catch (e) {
    return null;
  }
}

async function getLocalSyscoinChainTips() {
  try {
    return await syscoinClient.callRpc("getchaintips", []).call();
  } catch (e) {
    console.log("ERR getChainTips", JSON.stringify(e.response.data.error));
  }
}

async function getRemoteSyscoinChainTips() {
  const options = {
    uri: `${config.explorer_url}/ext/getchaintips`,
    headers: {
      'User-Agent': 'Request-Promise'
    },
    json: true // Automatically parses the JSON string in the response
  };

  return await rp(options);
}

async function checkSyscoinChainTips(mailer) {
  let full_local = await getLocalSyscoinChainTips();
  let full_remote = await getRemoteSyscoinChainTips();

  // find active chains
  let local = full_local.find(el => el.status === 'active');
  let remote = full_remote.find(el => el.status === 'active');

  if (local.height !== remote.height || local.hash !== remote.hash) {
    console.log('Chain mismatch');
    console.log('Local chain:', local);
    console.log('Remote chain:', remote);
    const tokenObj = {
      local: JSON.stringify(local),
      remote: JSON.stringify(remote)
    };
    if(config.enable_mail) {
      await sendMail(mailer, require('./messages/agent_sys_chain_mismatch'), tokenObj);
    }
    return { local, remote, localtips: full_local, remotetips: full_remote };
  } else {
    console.log('Chain height and hash match.');
    return { local, remote, localtips: full_local, remotetips: full_remote  };
  }
}

async function checkEthereumChainHeight(mailer) {
  let local = await getLocalEthereumChainHeight();
  local = local.geth_current_block;

  let remote = await getRemoteEthereumChainHeight();
  remote = parseInt(remote.result, 16);

  if (local !== remote && (remote - local) >= config.eth_block_threshold) {
    console.log('Eth chain has fallen behind!');
    console.log('Local chain:', local);
    console.log('Remote chain:', remote);
    const tokenObj = {
      local: JSON.stringify(local),
      remote: JSON.stringify(remote)
    };
    if (config.enable_mail) {
      await sendMail(mailer, require('./messages/agent_eth_chain_height'), tokenObj);
    }
    return { local, remote };
  } else {
    let diff = remote - local;
    console.log(`Eth height within threshold, local/remote height difference: ${diff}`);
    return { local, remote };
  }
}

async function getLocalEthereumChainHeight() {
  try {
    return await syscoinClient.callRpc("getblockchaininfo", []).call();
  } catch (e) {
    console.log("ERR getChainTips", JSON.stringify(e.response.data.error));
  }
}

async function getRemoteEthereumChainHeight() {
  const options = {
    uri: `${config.infura_api}`,
    method: 'POST',
    body: {
      "jsonrpc": "2.0",
      "method": "eth_blockNumber",
      "params": [],
      "id": 1
    },
    json: true // Automatically parses the JSON string in the response
  };

  return await rp(options);
}

function configMailer(config) {
  let result = {
    host: config.smtp.host,
    secure: config.smtp.secure,
    port: config.smtp.port
  };

  // if we have non-empty auth, use it
  if (config.smtp.auth.user !== '' && config.smtp.auth.pass !== '') {
    result.auth = config.smtp.auth;
  }

  // if not secure
  if (!config.smtp.secure) {
    result.tls = {
      rejectUnauthorized: false
    };
  }

  return result;
}

async function getRemoteEthereumSuperblockContract() {
  const options = {
    uri: `${config.infura_api}`,
    method: 'POST',
    body: {
      "jsonrpc": "2.0",
      "method": "eth_getLogs",
      "params": [{
        "address": "0xd03a860F481e83a8659640dC75008e9FcDF5d879",
        "fromBlock": "0x8ce808"
      }],
      "id": 1
    },
    json: true // Automatically parses the JSON string in the response
  };

  return await rp(options);
}


module.exports = {
  checkProcessDown,
  writeFile,
  readFile,
  sendMail,
  checkSyscoinChainTips,
  checkEthereumChainHeight,
  configMailer
};
