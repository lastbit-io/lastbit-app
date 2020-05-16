/* eslint-disable */

import config from 'config';
import Reactotron from 'reactotron-react-native';
import KeyManager from 'key-manager';
import WalletManager from 'wallet-manager';
import crypto from 'react-native-crypto';
import RNLocation from 'react-native-location';

// import crypto from 'crypto'

// Wrapper for all calls to ClnHub
apiToken = '';
const userNameDerivationPath = 'm/0/1/2/3/4';
const passwordDerivationPath = 'm/5/6/7/8/9';

getUserId = async () => {
  userId = await WalletManager.getFlatAddressAtDerivedPath(
    userNameDerivationPath
  );
  let hash = crypto
    .createHash('sha256')
    .update(userId)
    .digest('base64');
  return hash;
};

callLightningRequest = async (url, jsonBody = {}) => {
  try {
    let fetchParams = {
      method: 'POST',
    };
    fetchParams.headers = {
      'Content-Type': 'application/json',
    };
    fetchParams.body = JSON.stringify({
      ...jsonBody,
      serverVersion: 1,
      token: apiToken,
    });

    let response = await fetch(config.lightningHostName + url, fetchParams);

    if (response.ok) {
      let jsonResponse = await response.json();
      // FIXME Can move payload logic here and reuse?
      //if (response.result == 1)
      // return jsonResponse.payload;
      //else return errorHandling Whatever
      return jsonResponse;
    }

    if (response.status === 401) {
      // userId && password should be greater than 30 chars
      let userId = await this.getUserId();
      passwordPathAddress = await WalletManager.getFlatAddressAtDerivedPath(
        passwordDerivationPath
      );
      let password = crypto
        .createHash('sha256')
        .update(passwordPathAddress)
        .digest('base64');

      let loginResponse = await login(userId, password);
      if (loginResponse.success === true) {
        let recursiveResponse = await callLightningRequest(url, jsonBody);
        return recursiveResponse;
      }
    } else {
      return {
        result: -1,
      };
    }
  } catch (error) {
    return {
      result: -1,
    };
  }
};

login = async (username, password) => {
  try {
    signinUrl = config.lightningHostName + '/login';
    let signInResponse = await fetch(signinUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        serverVersion: 1,
        username,
        password,
      }),
    });

    if (signInResponse.ok) {
      let signinJson = await signInResponse.json();
      apiToken = signinJson.token;
      return {
        success: true,
      };
    } else {
      if (signInResponse.status === 400) {
        let signinJson = await signInResponse.json();
        if (signinJson.message === `Invalid user`) {
          let signupURL = config.lightningHostName + '/signup';
          let signupResponse = await fetch(signupURL, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              serverVersion: 1,
              username,
              password,
            }),
          });
          if (!signupResponse.ok) {
            return {
              success: false,
            };
          } else {
            let response = await login(username, password);
            return response;
          }
        } else {
          return {
            success: false,
          };
        }
      } else {
        return {
          success: false,
        };
      }
    }
  } catch (error) {
    Reactotron.log(error);
  }
};

getInfo = async () => {
  let response = await this.callLightningRequest('/getinfo');
  if (response.result == 1) return response.payload.data;
  else return response;
};

getUserBalance = async () => {
  let response = await this.callLightningRequest('/getbalance');
  Reactotron.log({ BALANCE: response });
  if (response.result == 1) return response.payload.balance;
  else return response;
};

getFundingAddress = async () => {
  let response = await this.callLightningRequest('/getdepositaddress');
  if (response.result == 1) return response.payload.address;
  else return response;
};

getUserInvoices = async () => {
  let response = await this.callLightningRequest('/getuserinvoices');
  Reactotron.log('invoices', response);
  if (response.result == 1) return response.payload.invoices;
  else return response;
};

getTxs = async () => {
  let txsResponse = await this.callLightningRequest('/gettxs');
  // Filter users' lightning invoices from onchain txs
  let invoices = [],
    transfers = [];
  if (txsResponse.result == 1) {
    txsResponse.payload.txs.map(tx =>
      tx.type == 'bitcoind_tx' ? transfers.push(tx) : invoices.push(tx)
    );
  }
  // Pending Tx's are onchain txs
  let pendingTxsResponse = await this.callLightningRequest('/getpending');
  if (
    pendingTxsResponse.result == 1 &&
    pendingTxsResponse.payload.txs.length > 0
  )
    pendingTxsResponse.payload.txs.map(tx => transfers.push(tx));

  return [transfers, invoices, txsResponse.payload.balance];
};

payInvoice = async bolt11 => {
  let response = await callLightningRequest('/payinvoice', { invoice: bolt11 });
  if (response.result == 1) return response.payload.payment;
  else return response;
};

payInvoiceless = async (recipient, satoshis) =>
  await callLightningRequest('/payinvoiceless', { recipient, satoshis });

getHId = async () => {
  let response = await callLightningRequest('/gethid');
  return response.payload.hid;
};

setHId = async newHId => await callLightningRequest('/sethid', { hid: newHId });

addInvoice = async (amount, description) => {
  let latitude = '0';
  let longitude = '0';
  let label = '';
  let possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  let granted = await RNLocation.requestPermission({
    ios: 'whenInUse',
    android: {
      detail: 'fine',
    },
  });

  if (granted) {
    let location = await RNLocation.getLatestLocation({ timeout: 30000 });
    if (location) {
      latitude = location.latitude;
      longitude = location.longitude;
    }
  }

  for (let i = 0; i < 10; i++) {
    label += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  let date = +new Date();
  // Random Label with timestamp
  label = label + '-' + date;

  let jsonBody = {
    satoshis: amount,
    label,
    description,
    expiry: 360,
    latitude,
    longitude,
  };

  let invoiceResponse = await this.callLightningRequest(
    '/addinvoice',
    jsonBody
  );

  if (invoiceResponse.result == 1) {
    return invoiceResponse.payload.invoice;
  } else {
    // TODO: Handle err responses
    return invoiceResponse;
  }
};

withdrawToAddress = async (address, satoshis) => {
  let response = await this.callLightningRequest('/withdraw', {
    address,
    satoshis,
  });
  if (response.result == 1)
    return {
      success: true,
    };
  else
    return {
      success: false,
    };
};

pingLightningAPI = async () => {
  let online = false;
  let response = await fetch(config.lightningHostName + '/ping');
  if (response.ok) {
    Reactotron.log('Lightning Server is online');
    online = true;
  } else {
    Reactotron.log('Error Connecting to Lightning server');
  }
  return online;
};

getNearbyInvoices = async () => {
  let granted = await RNLocation.requestPermission({
    ios: 'whenInUse',
    android: {
      detail: 'fine',
    },
  });

  let lat = 0,
    lng = 0;

  if (granted) {
    let location = await RNLocation.getLatestLocation({ timeout: 30000 });
    if (location) {
      lat = location.latitude;
      lng = location.longitude;
    } else {
      return {
        success: false,
      };
    }
  } else {
    return {
      success: false,
    };
  }

  let response = await callLightningRequest(`/getnearbyinvoices`, {
    latitude: lat,
    longitude: lng,
    radius: 100,
  });

  return { success: true, response };
};

export default {
  getInfo,
  getUserBalance,
  getFundingAddress,
  getUserInvoices,
  getTxs,
  payInvoice,
  addInvoice,
  withdrawToAddress,
  pingLightningAPI,
  payInvoiceless,
  getUserId,
  getHId,
  setHId,
  getNearbyInvoices,
};
