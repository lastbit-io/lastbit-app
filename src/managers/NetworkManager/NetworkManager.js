/* eslint-disable */
import config from 'config';
import Reactotron from 'reactotron-react-native';
import WalletManager from 'wallet-manager';
import TransactionManager from 'transaction-manager';
import { Sentry } from 'react-native-sentry';

const getUTXOs = async ()=>{
    return await getAddressesbasedUTXOs()
    // await getSmartbitUTXOs()
}

const getAddressesbasedUTXOs = async ()=>{
    try {
        let addressMap = await WalletManager.getAddressMap()
        let addresses = Object.keys(addressMap).filter(key => key.length > 20)
        let response = await fetch(`${config.multiAddressHost}utxos?addrs=${addresses.join(',')}`)
        let combinedJsonResponse = await response.json()

        let satoshis = 0;
        let extendedSatoshis = 0;
        let greatestPath = 0;

        let consolidatedUTXOs = []

        for (const address in combinedJsonResponse.payload) {
            if (combinedJsonResponse.payload.hasOwnProperty(address)) {
                const jsonResponse = combinedJsonResponse.payload[address];
                jsonResponse.forEach((output, utxoIndex)=>{
                    extendedSatoshis = extendedSatoshis + output.value;

                    if(output.status.confirmed === true){
                        satoshis = satoshis + output.value;
                    }

                    let path = addressMap[address]
                    let lastIndex = 0
                    if(path){
                        lastIndex = path.split('/')[1]
                    }


                    lastIndex = parseInt(lastIndex)
                    if (greatestPath < lastIndex) {
                        greatestPath = lastIndex
                    }

                    consolidatedUTXOs.push({
                        txid: output.txid,
                        vout: output.vout,
                        // scriptPubKey: output.script_pub_key.hex,
                        amount: output.value,
                        satoshis: output.value,
                        confirmations: output.status.tip ? output.status.tip - output.status.block_height + 1:0,
                        address: address,
                        path
                    })
                })
            }
        }

        let finalUTXOOutput = {
            success: true,
            utxos: consolidatedUTXOs.filter(utxo => utxo.confirmations >= 1),
            extendedUtxos: consolidatedUTXOs,
            extendedSatoshis,
            satoshis,
            maxPath: greatestPath
        }

        Reactotron.log({finalUTXOOutput})

        return finalUTXOOutput

    } catch (error) {
        // alert(error)
    }
}

const getSmartbitUTXOs = async () => {
    try {
        let xpub = WalletManager.getHardenedXpub();
        let response = await fetch(`${config.apiRoot}/getUtxos?xpub=${xpub}`);
        let consolidatedUTXOs = [];
        let satoshis = 0;
        let extendedSatoshis = 0;
        let greatestPath = 0;
        if (response.ok) {
            let jsonResponse = await response.json()
            if (jsonResponse.payload.smartbit) {
                jsonResponse.payload.smartbit.forEach((output) => {
                    extendedSatoshis = extendedSatoshis + output.value_int;
                    if (output.confirmations >= 1) {
                        satoshis = satoshis + output.value_int;
                    }
                    let lastIndex = output.path.split('/')[1]
                    lastIndex = parseInt(lastIndex)
                    if (greatestPath < lastIndex) {
                        greatestPath = lastIndex
                    }
                    consolidatedUTXOs.push({
                        txid: output.txid,
                        vout: output.n,
                        scriptPubKey: output.script_pub_key.hex,
                        amount: output.value,
                        satoshis: output.value_int,
                        confirmations: output.confirmations,
                        address: WalletManager.getAddressAtDerivationPath(output.path),
                        path: config.derivationBase + '/' + output.path
                    })
                })
            }
            Reactotron.log(consolidatedUTXOs)
        }

        // TODO: Handle error cases without crashing app
        return {
            success: true,
            utxos: consolidatedUTXOs.filter(utxo => utxo.confirmations >= 1),
            extendedUtxos: consolidatedUTXOs,
            extendedSatoshis,
            satoshis,
            maxPath: greatestPath
        }
    } catch (error) {
        Sentry.captureException(error);
        Reactotron.log({ utxoError: error })
        return {
            success: false
        }
    }
}

const getBlockChainUTXOs = async () => {
    try {
        let response = await fetch(`${config.blockchainRoot}unspent?active=${WalletManager.getHardenedXpub()}`)

        let consolidatedUTXOs = [];
        let satoshis = 0;
        let greatestPath = 0;
        if (response.ok) {
            let jsonResponse = await response.json()
            if (jsonResponse.unspent_outputs) {

                let txids = jsonResponse.unspent_outputs.map(unspent => unspent.tx_hash_big_endian)
                // FIXME Don't rely only on Smartbit
                let confirmations = await TransactionManager.getTransactionConfirmations(txids)

                if (confirmations.success === true) {
                    jsonResponse.unspent_outputs.forEach(output => output.confirmations = confirmations.confirmations[output.tx_hash_big_endian])
                }

                jsonResponse.unspent_outputs.forEach((output) => {
                    if (parseInt(output.confirmations) >= 2) {
                        satoshis = satoshis + output.value
                    }
                    let lastIndex = output.xpub.path.replace('M/', '').split('/')[output.xpub.path.replace('M/', '').split('/').length - 1]
                    lastIndex = parseInt(lastIndex)
                    if (greatestPath < lastIndex) {
                        greatestPath = lastIndex
                    }
                    consolidatedUTXOs.push({
                        txid: output.tx_hash_big_endian,
                        vout: output.tx_output_n,
                        scriptPubKey: output.script,
                        amount: output.value / 100000000,
                        satoshis: output.value,
                        confirmations: output.confirmations,
                        address: WalletManager.getAddressAtDerivationPath(output.xpub.path.replace('M/', '')),
                        path: config.derivationBase + output.xpub.path.replace('M', '')
                    })
                })
            }
        }

        // TODO: Handle error cases without crashing app
        return {
            success: true,
            utxos: consolidatedUTXOs.filter(utxo => parseInt(utxo.confirmations) >= 2),
            satoshis,
            maxPath: greatestPath
        }
    } catch (error) {
        Sentry.captureException(error);
        return {
            success: false
        }
    }
}

const broadcastTransaction = async (hex) => {
    try {
        let response = await fetch(config.smartBitRoot + 'pushtx', {
            method: 'POST',
            body: JSON.stringify({
                hex
            }),
            headers: {
                'content-type': 'application/json'
            }
        })

        if (response.ok) {
            let responseJson = await response.json()
            if (responseJson.success) {
                return {
                    success: true,
                    txid: responseJson.txid
                }
            }
        } else {
            return {
                success: false
            }
        }

    } catch (error) {
        Sentry.captureException(error);
        return {
            success: false
        }
    }
}

callBlockcypherRequest = async (params) => {
    let response = await fetch(`${config.blockcypherRoot}${params.path}?token=${config.blockcypherToken}`, {
        method: params.method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: params.body ? JSON.stringify(params.body) : undefined
    })
}

getRecommendedBitcoinFee = async () => {
    try {
        let response = await fetch(`https://bitcoinfees.earn.com/api/v1/fees/recommended`)
        if (response.ok) {
            let responseJson = await response.json()
            return {
                success: true,
                fee: responseJson
            }
        } else {
            return {
                success: false
            }
        }
    } catch (error) {
        Sentry.captureException(error);
        return {
            success: false
        }
    }
}

export default {
    getUTXOs,
    broadcastTransaction,
    callBlockcypherRequest,
    getRecommendedBitcoinFee
}