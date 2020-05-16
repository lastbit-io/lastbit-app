/* eslint-disable */
import { Clipboard } from 'react-native'
import AsyncStorage from '@react-native-community/async-storage';
import Reactotron from 'reactotron-react-native'
import bitcoin from "rn-bitcoinjs-lib"
import coinselect from 'coinselect/accumulative'
import bip32 from 'bip32'
import config from 'config'
import wallet from 'wallet-manager'
import bs58 from 'bs58'
import NetworkManager from '../NetworkManager'
import KeyManager from 'key-manager'

const BASE16 = '0123456789abcdef'
var bs16 = require('base-x')(BASE16)

const SCRIPT_TYPES = {
    MULTISIG: 'multisig',
    NONSTANDARD: 'nonstandard',
    NULLDATA: 'nulldata',
    P2PK: 'pubkey',
    P2PKH: 'pubkeyhash',
    P2SH: 'scripthash',
    P2WPKH: 'witnesspubkeyhash',
    P2WSH: 'witnessscripthash',
    WITNESS_COMMITMENT: 'witnesscommitment'
}

const fetchCachedConsolidatedTransactions = async () => {
    let transactions = await AsyncStorage.getItem('transactions')
    if (transactions) {
        transactions = JSON.parse(transactions)
        if (transactions.consolidatedTransactions) {
            return {
                success: true,
                consolidatedTransactions: transactions.consolidatedTransactions
            }
        } else {
            return {
                success: false
            }
        }
    } else {
        return {
            success: false
        }
    }
}

const fetchHostedApiTransactions = async () => {
    let xpub = wallet.getHardenedXpub();
    let hostedResponse = await fetch(`${config.apiRoot}/getTxs?xpub=${xpub}`);
    if (hostedResponse.status === 200) {
        let hostedJSONResponse = await hostedResponse.json()
        return {
            smartbit: hostedJSONResponse.payload.smartbit.address.transactions,
            insight: hostedJSONResponse.payload.insight
        }
    } else {
        return {
            success: false
        }
    }
}

const fetchBlockChainTransactions = async () => {

    let blockchainResponse = await fetch(`${config.blockchainRoot}multiaddr?active=${wallet.getHardenedXpub()}&max=100&offset=0`)
    if (blockchainResponse.status === 200) {
        let blockchainJSONResponse = await blockchainResponse.json()
        return blockchainJSONResponse.txs
    } else {
        return {
            success: false
        }
    }
}

const convertInsightTransactionToConsolidatedTransaction = (blockchainTx) => {
    let addressesTransacted = []

    let path = 0
    let amountTransacted = 0
    let isSelfTransaction = true

    blockchainTx.vin.forEach((vin) => {
        if ('belongs_to_xpub' in vin) {
            amountTransacted = amountTransacted - (vin.value * 100000000)
            addressesTransacted.push(vin.addr);
            let txPaths = vin.path.split('/')
            if (txPaths[txPaths.length - 1] > path) {
                path = txPaths[txPaths.length - 1]
            }
        } else {
            isSelfTransaction = false
        }
    })

    blockchainTx.vout.forEach((vout) => {
        if ('belongs_to_xpub' in vout) {
            amountTransacted = amountTransacted + (vout.value * 100000000)
            addressesTransacted.push(vout.scriptPubKey.addresses[0]);
            let txPaths = vout.path.split('/')
            if (txPaths[txPaths.length - 1] > path) {
                path = txPaths[txPaths.length - 1]
            }
        } else {
            isSelfTransaction = false
        }
    })

    if (amountTransacted <= 0) {
        addressesTransacted = []
        blockchainTx.vout.forEach((vout) => {
            if (!('belongs_to_xpub' in vout)) {
                if (vout.scriptPubKey.addresses) {
                    addressesTransacted.push(vout.scriptPubKey.addresses[0])
                } else {
                    addressesTransacted.push('Not Available')
                }
            }
        })
    }

    let selfTrasactionAmount = 0;

    if (isSelfTransaction) {
        blockchainTx.vout.forEach((vout) => {
            if ('belongs_to_xpub' in vout) {
                let txPaths = vout.path.split('/')
                if (txPaths[0] === '0') {
                    selfTrasactionAmount = selfTrasactionAmount + (vout.value * 100000000)
                }
            }
        })
    }

    return {
        type: isSelfTransaction ?
            "self" :
            amountTransacted > 0 ? 'receive' : 'send',
        txid: blockchainTx.txid,
        time: blockchainTx.time,
        amount: isSelfTransaction ? selfTrasactionAmount : amountTransacted,
        fees: blockchainTx.fees * 100000000,
        confirmations: blockchainTx.confirmations,
        addresses: addressesTransacted,
        path: parseInt(path)
    }
}
const convertSmartbitApiTransactionToConsolidatedTransaction = (blockchainTx) => {
    let addressesTransacted = []

    let path = 0
    let amountTransacted = 0
    let isSelfTransaction = true

    blockchainTx.inputs.forEach((vin) => {
        if ('addresses' in vin) {
            if ('belongs_to_xpub' in vin) {
                amountTransacted = amountTransacted - vin.value_int
                addressesTransacted.push(vin.addresses[0]);
                let txPaths = vin.path.split('/')
                if (txPaths[txPaths.length - 1] > path) {
                    path = txPaths[txPaths.length - 1]
                }
            } else {
                isSelfTransaction = false
            }
        }
    })

    blockchainTx.outputs.forEach((vout) => {
        if ('belongs_to_xpub' in vout) {
            amountTransacted = amountTransacted + vout.value_int
            addressesTransacted.push(vout.addresses[0]);
            let txPaths = vout.path.split('/')
            if (txPaths[txPaths.length - 1] > path) {
                path = txPaths[txPaths.length - 1]
            }
        } else {
            isSelfTransaction = false
        }
    })

    if (amountTransacted <= 0) {
        addressesTransacted = []
        blockchainTx.outputs.forEach((vout) => {
            if (!('belongs_to_xpub' in vout)) {
                addressesTransacted.push(vout.addresses[0])
            }
        })
    }

    let selfTrasactionAmount = 0;

    if (isSelfTransaction) {
        blockchainTx.outputs.forEach((vout) => {
            if ('belongs_to_xpub' in vout) {
                let txPaths = vout.path.split('/')
                if (txPaths[0] === '0') {
                    selfTrasactionAmount = selfTrasactionAmount + vout.value_int
                }
            }
        })
    }

    return {
        type: isSelfTransaction ?
            "self" :
            amountTransacted > 0 ? 'receive' : 'send',
        txid: blockchainTx.txid,
        time: blockchainTx.first_seen,
        amount: isSelfTransaction ? selfTrasactionAmount : amountTransacted,
        fees: blockchainTx.fee_int,
        confirmations: blockchainTx.confirmations,
        addresses: addressesTransacted,
        path: parseInt(path)
    }
}


//FIXME Smartbit
const getTransactionConfirmations = async (txIds) => {
    try {
        let response = await fetch(`${config.smartBitRoot}tx/${txIds.join(',')}`)
        let jsonResponse = await response.json()
        if (jsonResponse.success === true) {
            let confirmationMap = {}

            txIds.forEach(txId => {
                if ('transaction' in jsonResponse) {
                    confirmationMap[txId] = jsonResponse.transaction.confirmations
                } else {
                    let foundTransaction = jsonResponse.transactions.find(trans => trans.txid === txId)
                    if (foundTransaction) {
                        confirmationMap[txId] = foundTransaction.confirmations
                    }
                }
            })

            return {
                success: true,
                confirmations: confirmationMap
            }

        } else {
            return {
                success: false
            }
        }
    } catch (error) {
        return {
            success: false
        }
    }
}

const convertBlockchainTransactionToConsolidatedTransaction = (blockchainTx) => {
    let addressesTransacted = []

    let path = 0
    let isSelfTransaction = true

    blockchainTx.inputs.forEach((vin) => {
        if ('xpub' in vin.prev_out) {
            if ('addr' in vin.prev_out) {
                addressesTransacted.push(vin.prev_out.addr);
                let txPaths = vin.prev_out.xpub.path.replace('M/', '').split('/')
                if (txPaths[txPaths.length - 1] > path) {
                    path = txPaths[txPaths.length - 1]
                }
            }
        }
        else {
            isSelfTransaction = false
        }
    })

    blockchainTx.out.forEach((vout) => {
        if ('xpub' in vout) {
            if ('addr' in vout) {
                addressesTransacted.push(vout.addr);
                let txPaths = vout.xpub.path.replace('M/', '').split('/')
                if (txPaths[txPaths.length - 1] > path) {
                    path = txPaths[txPaths.length - 1]
                }
            }
        }
        else {
            isSelfTransaction = false
        }
    })

    if (blockchainTx.result <= 0) {
        addressesTransacted = []
        blockchainTx.out.forEach((vout) => {
            if (!('xpub' in vout)) {
                addressesTransacted.push(vout.addr)
            }
        })
    }

    let selfTrasactionAmount = 0;

    if (isSelfTransaction) {
        blockchainTx.out.forEach((vout) => {
            if ('xpub' in vout) {
                let firstElementOfPath = vout.xpub.path.replace('M/', '').split('/')[0]
                if (firstElementOfPath === '0') {
                    selfTrasactionAmount = selfTrasactionAmount + vout.value
                }
            }
        })
    }

    let transactionReturned = {
        type: isSelfTransaction ?
            'self' :
            blockchainTx.result > 0 ? 'receive' : 'send',
        txid: blockchainTx.hash,
        time: blockchainTx.time,
        amount: isSelfTransaction ? selfTrasactionAmount : blockchainTx.result,
        fees: blockchainTx.fee,
        confirmations: 0,
        addresses: addressesTransacted,
        path: parseInt(path)
    }

    return transactionReturned
}

const convertMultiAddressTransactionToConsolidatedTransaction = (transaction, addressMap, addresses)=>{
    try {
        // let addressMap = await wallet.getAddressMap()
        // let addresses = Object.keys(addressMap).filter(key => key.length > 20)

        let addressesTransacted = []
        let isSelfTransaction = true
        let amount = 0

        transaction.vin.forEach((vin) => {
            if ('scriptpubkey_address' in vin.prevout) {
                let transactionAddress = vin.prevout.scriptpubkey_address
                // alert(JSON.stringify(addresses) + '\n\n' + transactionAddress)
                if(addresses.indexOf(transactionAddress) > -1){
                    addressesTransacted.push(vin.prevout.scriptpubkey_address);
                    amount = amount - vin.prevout.value
                }else{
                    isSelfTransaction = false
                }

            }
        })

        transaction.vout.forEach((vout) => {
            if ('scriptpubkey_address' in vout) {
                let transactionAddress = vout.scriptpubkey_address
                if(addresses.indexOf(transactionAddress) > -1){
                    addressesTransacted.push(vout.scriptpubkey_address);
                    amount = amount + vout.value
                }else{
                    isSelfTransaction = false
                }

            }
        })

        if (isSelfTransaction) {
            amount = 0
            transaction.vout.forEach((vout) => {
                amount = amount + vout.value
            })
        }

        paths = addressesTransacted.map(address => parseInt(addressMap[address].split('/')[1]))

        let transactionReturned = {
            type: isSelfTransaction ?
                'self' :
                amount > 0 ? 'receive' : 'send',
            txid: transaction.txid,
            time: transaction.status.block_time,
            amount: amount,
            fees: transaction.fee,
            confirmations: transaction.status.tip ? transaction.status.tip - transaction.status.block_height + 1:0,
            addresses: addressesTransacted,
            path: Math.max(...paths)
        }

        return transactionReturned
    } catch (error) {
        alert(error)
    }

}

const fetchMultiAddressTransactions = async ()=>{
    try {
        let addressMap = await wallet.getAddressMap()

        let existingPaths = Object.keys(addressMap).filter(key => key.length < 20 ? true : false)
        let indexesOfPaths = existingPaths.map(existingPath => parseInt(existingPath.split('/')[1]))
        let maxGeneratedIndex = Math.max(...indexesOfPaths)

        let reducedAddresses = []
        let relaventPaths = Object.keys(addressMap)
                                .filter(key => key.length < 20 ? true:false)
                                .filter(key => (maxGeneratedIndex - parseInt(key.split('/')[1])) < 20 ? true:false)

        relaventPaths.forEach(relavantPath => {
            reducedAddresses.push(addressMap[relavantPath])
        })

        Reactotron.log({relaventPaths})

        let response = await fetch(`${config.multiAddressHost}txs?addrs=${reducedAddresses.join(',')}`)
        let responseJSON = await response.json()
        let rawTransactions = []
        if(responseJSON.result === 0){
            let {payload} = responseJSON
            for (address in payload) {
                if(payload.hasOwnProperty(address)){
                    payload[address].forEach(apiTrasaction => {
                        let existingTransaction = rawTransactions.find(rawTransaction => rawTransaction.txid === apiTrasaction.txid)
                        if(!existingTransaction){
                            rawTransactions.push(apiTrasaction)
                        }
                    })
                }
            }
        }

        return {
            success:true,
            transactions:rawTransactions
        }


    } catch (error) {
        // alert(error)
        return{
            success:false
        }
    }
}

const generateConsolidatedTransactions = async (blockchainTransactions, mode) => {

    try {
        consolidatedTransactions = []
        let addressMap = await wallet.getAddressMap()
        let addresses = Object.keys(addressMap).filter(key => key.length > 20)

        blockchainTransactions.forEach((transaction, index) => {
            if (mode === 'blockchain') {
                consolidatedTransactions.push(convertBlockchainTransactionToConsolidatedTransaction(transaction))
            } else if (mode === 'smartbit') {
                consolidatedTransactions.push(convertSmartbitApiTransactionToConsolidatedTransaction(transaction))
            } else if (mode === 'insight') {
                consolidatedTransactions.push(convertInsightTransactionToConsolidatedTransaction(transaction))
            } else if (mode === 'multiAddress') {
                consolidatedTransactions.push(convertMultiAddressTransactionToConsolidatedTransaction(transaction,addressMap,addresses))
            }
        })


        return consolidatedTransactions
    }
    catch (error) {
        return []
    }
}

const fetchPreviousTransactions = async () => {

    window.EventBus.trigger('walletSyncTriggered', {
        completed:false
    });

    let multiAddressTransactions = await fetchMultiAddressTransactions()

    if(multiAddressTransactions.success === false){
        return await fetchPreviousTransactions()
    }

    let mergedConsolidatedTransactions = await generateConsolidatedTransactions(multiAddressTransactions.transactions, 'multiAddress')

    // let hostedAPITransactions = await fetchHostedApiTransactions()
    // let blockchainTransactions = await fetchBlockChainTransactions()


    // let blockchainConsolidatedTransactions = await generateConsolidatedTransactions(blockchainTransactions, 'blockchain')
    // let smartbitConsolidatedTransactions = await generateConsolidatedTransactions(hostedAPITransactions.smartbit, 'smartbit')

    // let insightConsolidatedTransactions = await generateConsolidatedTransactions(hostedAPITransactions.insight, 'insight')

    // smartbitConsolidatedTransactions.forEach(smartbitTransaction => {
    //     if (!mergedConsolidatedTransactions.find(mergedTransaction => mergedTransaction.txid === smartbitTransaction.txid)) {
    //         mergedConsolidatedTransactions.push(smartbitTransaction)
    //     }
    // })
    // insightConsolidatedTransactions.forEach(insightTransaction => {
    //     if (!mergedConsolidatedTransactions.find(mergedTransaction => mergedTransaction.txid === insightTransaction.txid)) {
    //         mergedConsolidatedTransactions.push(insightTransaction)
    //     }
    // })

    // let txIds = mergedConsolidatedTransactions.map(cons => cons.txid)
    // //FIXME Don't relt only on smartbit
    // let confirmationResponse = await getTransactionConfirmations(txIds)

    // if (confirmationResponse.success === true) {
    //     mergedConsolidatedTransactions.forEach(trans => {
    //         trans.confirmations = confirmationResponse.confirmations[trans.txid]
    //     })
    // }



    let maxPath = 0;
    if (mergedConsolidatedTransactions.length > 0) {
        mergedConsolidatedTransactions.forEach(trans => {
            if (parseInt(trans.path) > maxPath) {
                maxPath = trans.path
            }
        })

        Reactotron.log({MAXPATHUSED:maxPath})

        let {topAddressUsed} = await wallet.requestUpdateGeneratedAddressIndex(parseInt(maxPath) + 1)
        Reactotron.log({topAddressUsed})
        if(topAddressUsed === true){
            let newTransactions = await fetchPreviousTransactions()
            mergedConsolidatedTransactions = [...mergedConsolidatedTransactions, ...newTransactions.consolidatedTransactions]
        }
    }

    let transactions = await AsyncStorage.getItem('transactions')

    if (!transactions) {
        transactions = {
            consolidatedTransactions:[]
        }
    } else {
        transactions = JSON.parse(transactions)
    }

    mergedConsolidatedTransactions.forEach(newTransaction => {
        foundTransaction = transactions.consolidatedTransactions.find(storedTransaction => newTransaction.txid === storedTransaction.txid)
        if(!foundTransaction){
            transactions.consolidatedTransactions.push(newTransaction)
        }else{
            foundTransaction.confirmations = newTransaction.confirmations
            foundTransaction.time = newTransaction.time
        }
    })

    transactions.consolidatedTransactions = transactions.consolidatedTransactions.sort((a, b) => {
        if(!a.time){
            return -1
        }
        if(!b.time){
            return 1
        }
        return b.time - a.time
    })

    await AsyncStorage.setItem('transactions', JSON.stringify(transactions))

    window.EventBus.trigger('walletSyncTriggered', {
        completed:true
    });

    return {
        success: true,
        consolidatedTransactions: transactions.consolidatedTransactions
    }
}


const getUnsignedTransaction = async (utxos, targets, feePerByte = 55) => {

    let formattedUTXOs = []

    utxos.forEach(utxo => {
        formattedUTXOs.push({
            txId: utxo.txid,
            vout: utxo.vout,
            value: Math.round(utxo.satoshis)
        })
    });


    let {
        inputs,
        outputs,
        fee
    } = coinselect(formattedUTXOs, targets, feePerByte)

    if (!inputs || !outputs) {
        return {
            success: false,
            message: 'Insufficient Balance',
            fee
        }
    }

    let orderedUtxos = []

    let tb = new bitcoin.TransactionBuilder(config.bitcoinNetwork)

    tb.setVersion(2)
    // Add all the inputs after coin select
    inputs.forEach(input => {
        tb.addInput(input.txId, input.vout)

        let utxo = Object.values(utxos).find((utxo) => {
            if (input.txId === utxo.txid && input.vout == utxo.vout) {
                return true
            } else {
                return false
            }
        })

        orderedUtxos.push(utxo)
    })

    // Add all the outputs with the change addresses
    outputs.forEach(async output => {
        // Reactotron.log({'output CHANGE ADDRESS':output})
        if (!output.address) {
            let currentAddressIndex = await wallet.getCurrentGeneratedAddressIndex()
            let changeAddress = wallet.getAddressAtDerivationPath(`1/${currentAddressIndex}`)
            output.address = changeAddress
        }

        tb.addOutput(output.address, output.value)
    })

    return {
        // sighashes,
        tb,
        orderedUtxos,
        success: true,
        fee
    }
}

const inAppSignTransaction = (tb, orderedUtxos) => {
    // tb = new bitcoin.TransactionBuilder(config.bitcoinNetwork)
    let xpriv = KeyManager.getXpriv()
    const root = bip32.fromBase58(xpriv, config.bitcoinNetwork)


    orderedUtxos.forEach((utxo, index) => {

        let privateKey = root.derivePath(`${config.derivationPath}/${utxo.path}`)
        let wif = privateKey.toWIF()
        let ecPair = bitcoin.ECPair.fromWIF(wif, config.bitcoinNetwork)
        const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: ecPair.publicKey, network: config.bitcoinNetwork })
        const p2sh = bitcoin.payments.p2sh({ redeem: p2wpkh, network: config.bitcoinNetwork })

        // alert(JSON.stringify(tb))

        tb.sign(index, ecPair, p2sh.redeem.output, null, utxo.amount)
    })

    let hex = tb.build().toHex()
    return hex

}

const signBuildTransaction = async (tb, orderedUtxos, signatures) => {
    let orderedSignatures = [];

    orderedUtxos.forEach((input, index) => {
        let signature = signatures.find((signature, sigIndex) => {
            // let address = bitcoin.payments.p2pkh({ pubkey: Buffer(signature.pubkey, 'hex'), network: config.bitcoinNetwork }).address;
            if (signature.address === input.address) {
                return true;
            } else {
                return false;
            }
        });
        orderedSignatures.push(signature);
    });


    tb.__inputs.forEach((input, index) => {
        input.pubkeys = [Buffer(orderedSignatures[index].pubkey, 'hex')];
        input.signatures[0] = bitcoin.script.signature.encode(Buffer(orderedSignatures[index].signature, 'hex'), bitcoin.Transaction.SIGHASH_ALL);
    });

    return tb;
}

const addScriptToInput = (script) => {
    let buffer = Buffer(script, 'hex')
    return {
        prevOutType: SCRIPT_TYPES.P2PKH,
        prevOutScript: buffer,

        hasWitness: false,
        signScript: buffer,
        signType: SCRIPT_TYPES.P2PKH,
        signatures: [undefined],
    }
}

// Please note that every thing in 'buildTransaction' is in Satoshis and NOT BITCOIN

//Object.assign(input, prepareTransaction(Buffer(publicKeys[index], 'hex')))
//let scriptSig = bitcoin.script.signature.encode(Buffer(rsSignatures[index], 'hex'), bitcoin.Transaction.SIGHASH_ALL)
//input.signatures[0] = scriptSig

const buffTest = () => {
    let tb = new bitcoin.TransactionBuilder(config.bitcoinNetwork)
    tb.addInput('b6aebf69d7f4e8ffc439763ca6b35d4f5391babc6a45459f31f0616c5635676c', 1)
    tb.addOutput('mtzo1YmKjuWHB2QDxRFLcE66wmh9cuebCL', 10000)
    tb.addOutput('mu19UhqJwZrmsDQ81bkZgz5TApUdVmrvVf', 433412781)
    tb.setVersion(1)
    let privateKeyWIF = 'cTzQ1ajS3ZB9npCqsq4bGhEUqcirJSNiNiuEcF34tHhc9HxirnVL';
    let pair = bitcoin.ECPair.fromWIF(privateKeyWIF, config.bitcoinNetwork)
    Object.assign(tb.__inputs[0], prepareTransaction(pair.publicKey))
    let sighash = tb.__tx.hashForSignature(0, tb.__inputs[0].prevOutScript, bitcoin.Transaction.SIGHASH_ALL)
    let r = '596399c7a8c47676e8f1c55fcd7c3d33771359b5f168b18526bf46ec68abf8f3'
    let s = '1226a17297196c42328512ad8bab375ad145ab3000c55e7b8c0e29dd707e462e'
    let sig = r + s
    let scriptSig = bitcoin.script.signature.encode(Buffer(sig, 'hex'), bitcoin.Transaction.SIGHASH_ALL)

    tb.__inputs[0].signatures[0] = scriptSig
}

const prepareTransaction = (ourPubKey) => {
    const prevOutScript = bitcoin.payments.p2pkh({ pubkey: ourPubKey }).output

    let input = {
        prevOutType: SCRIPT_TYPES.P2PKH,
        prevOutScript: prevOutScript,

        hasWitness: false,
        signScript: prevOutScript,
        signType: SCRIPT_TYPES.P2PKH,
        signatures: [undefined],
        pubkeys: [ourPubKey]
    }
    return input
}

export default {
    getUnsignedTransaction,
    signBuildTransaction,
    fetchPreviousTransactions,
    inAppSignTransaction,
    fetchCachedConsolidatedTransactions,
    convertBlockchainTransactionToConsolidatedTransaction,
    getTransactionConfirmations
}
