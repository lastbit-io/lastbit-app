/* eslint-disable */
import AsyncStorage from '@react-native-community/async-storage';
import bitcoin from "rn-bitcoinjs-lib";
import bip32 from 'bip32'
import config from 'config'
import bip39 from 'bip39'
import Reactotron from 'reactotron-react-native'
import bs58 from 'bs58'
import KeyManager from 'key-manager'
import NetworkManager from 'network-manager'

let xpubKey = null
let root = null
let derivationPath = null
let derivedBase = null

setupWalletManager = () => {
    xpubKey = KeyManager.getXpub()
    xprivKey = KeyManager.getXpriv()
    root = bip32.fromBase58(xprivKey, config.bitcoinNetwork)
    derivationPath = config.derivationPath
    // derivationPath = `m/44/1/0`
    derivedBase = root.derivePath(derivationPath)
}

getHardenedXpub = () => {
    xprivKey = KeyManager.getXpriv()
    let bipBase = bip32.fromBase58(xprivKey, config.bitcoinNetwork)
    let derivedXpriv = bipBase.derivePath(derivationPath)
    // Reactotron.log({hardenedXpub:derivedXpriv.neutered().toBase58()})
    return derivedXpriv.neutered().toBase58();
}

requestUpdateGeneratedAddressIndex = async (index) => {

    let wallet = await AsyncStorage.getItem('wallet')
    let topAddressUsed = false
    if (wallet) {
        wallet = JSON.parse(wallet)
        if (index > wallet.nextAddressIndex) {

            let addressMap = {}
            if(wallet.addressMap){
                addressMap = JSON.parse(JSON.stringify(wallet.addressMap))
            }

            let existingPaths = Object.keys(addressMap).filter(key => key.length < 20 ? true : false)
            let indexesOfPaths = existingPaths.map(existingPath => parseInt(existingPath.split('/')[1]))
            let maxGeneratedIndex = Math.max(...indexesOfPaths)

            if(maxGeneratedIndex < index){
                topAddressUsed = true
                for (let i = maxGeneratedIndex; i <= maxGeneratedIndex + 20; i++) {
                    addressMap[getAddressAtDerivationPath(`0/${i}`)] = `0/${i}`
                    addressMap[getAddressAtDerivationPath(`1/${i}`)] = `1/${i}`

                    addressMap[`0/${i}`] = getAddressAtDerivationPath(`0/${i}`)
                    addressMap[`1/${i}`] = getAddressAtDerivationPath(`1/${i}`)
                }
            }

            wallet.nextAddressIndex = index
            wallet.addressMap = addressMap
            await AsyncStorage.setItem('wallet', JSON.stringify(wallet))
            window.EventBus.trigger('newAddressesGenerated')
        }
    }
    return {topAddressUsed}
}

getAddressMap = async ()=>{
    let wallet = await AsyncStorage.getItem('wallet')
    if(wallet){
        wallet = JSON.parse(wallet)
        if(wallet.addressMap){
            return wallet.addressMap
        }
    }

    return null
}


getCurrentGeneratedAddressIndex = async () => {
    let wallet = await AsyncStorage.getItem('wallet')
    if (!wallet) {
        addressMap = {}

        for (let i = 0; i < 20; i++) {
            addressMap[getAddressAtDerivationPath(`0/${i}`)] = `0/${i}`
            addressMap[getAddressAtDerivationPath(`1/${i}`)] = `1/${i}`

            addressMap[`0/${i}`] = getAddressAtDerivationPath(`0/${i}`)
            addressMap[`1/${i}`] = getAddressAtDerivationPath(`1/${i}`)
        }

        wallet = {
            nextAddressIndex: 0,
            addressMap
        }
    }
    else {
        wallet = JSON.parse(wallet)
    }

    await AsyncStorage.setItem('wallet', JSON.stringify(wallet))

    return wallet.nextAddressIndex
}

getCurrentIndexPublicKeys = async () => {

    let currentAddressIndex = await getCurrentGeneratedAddressIndex()

    // Reactotron.log({currentAddressIndex})
    let receivingPubKey = derivedBase.derive(0).derive(currentAddressIndex)
    let changePubKey = derivedBase.derive(1).derive(currentAddressIndex)
    // Reactotron.log(receivingPubKey,changePubKey)

    return {
        receivingPubKey,
        changePubKey
    }
}

getCachedSatoshiBalance = async () => {
    let wallet = await AsyncStorage.getItem('wallet')
    wallet = JSON.parse(wallet)
    if (wallet.cachedSatoshiBalance) {
        return wallet.cachedSatoshiBalance
    } else {
        wallet.cachedSatoshiBalance = 0
        await AsyncStorage.setItem('wallet', JSON.stringify(wallet))
        return 0
    }
}

setCachedSatoshiBalance = async (balance) => {
    let wallet = await AsyncStorage.getItem('wallet')
    wallet = JSON.parse(wallet)
    wallet.cachedSatoshiBalance = balance
    await AsyncStorage.setItem('wallet', JSON.stringify(wallet))
}

getFlatAddressAtDerivedPath = async (path)=>{
    try {
        let xpub = await KeyManager.getXpub();
        var root = bip32.fromBase58(xpub, config.bitcoinNetwork)
        let derivedPubKey = root.derivePath(path)
        let address = bitcoin.payments.p2sh({network: config.bitcoinNetwork, redeem:bitcoin.payments.p2wpkh({ pubkey: derivedPubKey.publicKey, network: config.bitcoinNetwork})}).address
        return address
    } catch (error) {
        alert(error)
    }
}

getAddressAtDerivationPath = (path) => {
    if(!derivedBase){
        let xpub = KeyManager.getXpub();
        var root = bip32.fromBase58(xpub, config.bitcoinNetwork)
        derivedBase = root.derivePath(path)
    }
    let derivedPubKey = derivedBase.derivePath(path)
    let address = bitcoin.payments.p2sh({network: config.bitcoinNetwork, redeem:bitcoin.payments.p2wpkh({ pubkey: derivedPubKey.publicKey, network: config.bitcoinNetwork})}).address
    // let address = bitcoin.payments.p2wpkh({ pubkey: derivedPubKey.publicKey, network: config.bitcoinNetwork }).address
    return address
}

getPubkeyAtDerivationPath = (path) => {
    path = path.split('/');
    path = path[path.length - 2] + '/' + path[path.length - 1];
    let derivedPubKey = derivedBase.derivePath(path)

    return derivedPubKey;
}


export default {
    getCurrentGeneratedAddressIndex,
    getCurrentIndexPublicKeys,
    getCachedSatoshiBalance,
    setCachedSatoshiBalance,
    setupWalletManager,
    getHardenedXpub,
    derivationPath,
    getAddressAtDerivationPath,
    getPubkeyAtDerivationPath,
    requestUpdateGeneratedAddressIndex,
    getAddressMap,
    getFlatAddressAtDerivedPath
}