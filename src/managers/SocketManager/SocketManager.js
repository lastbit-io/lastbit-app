/* eslint-disable */

window.navigator.userAgent = "react-native";

import Reactotron from 'reactotron-react-native'
import io from 'socket.io-client'
import WalletManager from 'wallet-manager'
import config from 'config'
import bitcoin from "rn-bitcoinjs-lib";

let socket = null;

startListening = async (callback) => {

    window.EventBus.on('newAddressesGenerated', sendCurrentAddressToSocket)

    socket = new WebSocket(config.socketHost)

    socket.onerror = (e) => {
        Reactotron.log({ socketError: e.message })
    }

    socket.onopen = () => {
        this.sendCurrentAddressToSocket().done()

        socket.onmessage = (e) => {
            if (e.data) {
                let message = JSON.parse(e.data)
                if (message.type === 'address') {
                    callback(message.data)
                }
            }
        }
    }
}

sendCurrentAddressToSocket = async ()=>{
    if(socket){
        let {receivingPubKey} = await WalletManager.getCurrentIndexPublicKeys()
        let receivingAddress = bitcoin.payments.p2pkh({ pubkey: receivingPubKey.publicKey, network: config.bitcoinNetwork }).address
        let message = {
            network: config.bitcoinNetwork === bitcoin.networks.testnet ? "BTCTest" : 'BTC',
            type:"address",
            address:receivingAddress,
            api_key:"1960-cda9-aaa1-640c"
        }
        // Reactotron.log({socketMessage:message})
        socket.send(JSON.stringify(message))
    }
}

stopListening = () => {

    window.EventBus.off('newAddressesGenerated', sendCurrentAddressToSocket)
    if (socket) {
        socket.close()
    }
}

connectToTerraformServer = (access_key, cb) => {
    // alert(config.lightningNodeDeployer);
    var socket = io('http://35.161.21.125:6969');
    socket.on('connect', function () {
        // Connected, let's sign-up for to receive messages for this room
        socket.emit('room', access_key);
    });

    socket.on('connect_failed', function () {
        return -4;
    });

    socket.on('message', function (data) {
        cb(data);
    });
}

export default {
    startListening,
    stopListening,
    connectToTerraformServer
}