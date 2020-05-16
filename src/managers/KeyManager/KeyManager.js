/* eslint-disable */
import AsyncStorage from '@react-native-community/async-storage';
import Reactotron from 'reactotron-react-native';
import config from 'config';
import crypto from 'react-native-crypto';
import bip39 from 'bip39';
import bip32 from 'bip32';

xpubKey = null
xprivKey = null

encryptText = (text, passphrase) => {
    let cipher = crypto.createCipher(config.encryptAlgo, passphrase)
    let crypted = cipher.update(text, 'utf8', 'hex')
    crypted += cipher.final('hex');
    return crypted;
}

decryptText = (text, passphrase) => {
    let decipher = crypto.createDecipher(config.encryptAlgo, passphrase)
    let dec = decipher.update(text, 'hex', 'utf8')
    dec += decipher.final('utf8');
    return dec;
}

storeKeys = async (publicKey, privateKey, mnemonic, pin) => {
    await AsyncStorage.setItem('xpub', publicKey)
    await AsyncStorage.setItem('xpriv', encryptText(privateKey, pin))
    await AsyncStorage.setItem('mnemonic', encryptText(mnemonic, pin))

    xpubKey = publicKey
    xprivKey = privateKey
}

doKeysExist = async () => {
    let publicKey = await AsyncStorage.getItem('xpub')
    let privateKey = await AsyncStorage.getItem('xpriv')
    if (publicKey && privateKey) {
        return {
            success: true
        }
    } else {
        return {
            success: false
        }
    }
}

getMnemonic = async (pin) => {
    let encryptedMnemonic = await AsyncStorage.getItem('mnemonic')
    let decryptedMnemonic = decryptText(encryptedMnemonic, pin)
    let validMnemonic = bip39.validateMnemonic(decryptedMnemonic)
    if (validMnemonic) {
        return {
            success: true,
            mnemonic: decryptedMnemonic
        }
    } else {
        return {
            success: false
        }
    }
}

checkPin = async (pin) => {
    let privateKey = await AsyncStorage.getItem('xpriv')
    let decryptedKey = decryptText(privateKey, pin)
    if (!(decryptedKey.startsWith('tprv') || decryptedKey.startsWith('xprv'))) {
        return {
            success: false
        }
    } else {
        return {
            success: true
        }
    }
}

setupKeys = async (pin) => {
    let publicKey = await AsyncStorage.getItem('xpub')
    let privateKey = await AsyncStorage.getItem('xpriv')
    let decryptedKey = decryptText(privateKey, pin)
    Reactotron.log({
        pin,
        publicKey,
        privateKey,
        decryptedKey
    })
    if (!(decryptedKey.startsWith('tprv') || decryptedKey.startsWith('xprv'))) {
        return {
            success: false
        }
    }
    if (publicKey && decryptedKey) {
        xpubKey = publicKey
        xprivKey = decryptedKey
        return {
            success: true
        }
    } else {
        return {
            success: false
        }
    }
}

changePin = async (pin, newPin) => {
    let checkResponse = await checkPin(pin)
    if (checkResponse.success === false) {
        return {
            success: false
        }
    }

    let mnemonic = await getMnemonic(pin)
    mnemonic = mnemonic.mnemonic
    await storeKeys(xpubKey, xprivKey, mnemonic, newPin)
    return {
        success: true
    }
}


saveMnemonic = async (mnemonic, encryptionPin, passphrase = '') => {
    mnemonic = mnemonic.join(' ')
    let seed

    if (passphrase.length > 0)
        seed = bip39.mnemonicToSeed(mnemonic, passphrase);
    else
        seed = bip39.mnemonicToSeed(mnemonic);

    Reactotron.log('seed: ', seed)

    const node = bip32.fromSeed(seed, config.bitcoinNetwork)
    Reactotron.log('node: ', node)
    const privateKey = node.toBase58()
    const publicKey = node.neutered().toBase58()

    Reactotron.log({ privateKey, publicKey })

    await storeKeys(publicKey, privateKey, mnemonic, encryptionPin)

}

getXpub = async () => xpubKey || await AsyncStorage.getItem('xpub')

getXpriv = () => xprivKey

export default {
    storeKeys,
    setupKeys,
    getXpub,
    getXpriv,
    doKeysExist,
    getMnemonic,
    checkPin,
    changePin,
    saveMnemonic
}