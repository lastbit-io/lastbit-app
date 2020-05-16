/* eslint-disable */
import bitcoin from 'rn-bitcoinjs-lib';

const testnetConfig = {
  bitcoinNetwork: bitcoin.networks.testnet,
  multiAddressHost: 'https://pc.lastbit.io/multiaddr/'
}

const mainnetConfig = {
  bitcoinNetwork: bitcoin.networks.bitcoin,
  multiAddressHost: 'http://18.194.166.70:9612/'
}

derivationPath = "m/49'/1'/0'";
socketHost = 'wss://n.block.io';
blockcypherRoot = 'https://api.blockcypher.com/v1/btc/test3/';
blockcypherToken = '8a072efef56e4aef991a7ab15bfc9db2';
blockchainRoot = 'https://testnet.blockchain.info/';
smartBitRoot = 'https://testnet-api.smartbit.com.au/v1/blockchain/';
feedbackLink = 'https://pc.lastbit.io/feedback';
derivationBase = "m/44'/1'/0'";
lightningHostName = 'https://pc.lastbit.io/clnhub/api';
lightningNodeDeployer = 'http://35.161.21.125:6969';
blockExplorerTestNetURL = 'https://live.blockcypher.com/btc-testnet/tx/';
blockExplorerMainNetURL = 'https://live.blockcypher.com/btc/tx/';

encryptAlgo = 'aes-256-ctr';

export default {
  lightningHostName,
  blockchainRoot,
  blockExplorerTestNetURL,
  blockExplorerMainNetURL,
  socketHost,
  encryptAlgo,
  blockcypherRoot,
  blockcypherToken,
  feedbackLink,
  derivationBase,
  smartBitRoot,
  //apiRoot,
  blockchainRoot,
  derivationPath,
  // ...mainnetConfig,
  ...testnetConfig,
};
